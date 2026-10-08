import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "./auth";
import type { CalEvent, MailMessage, MailSummary, MailThread } from "../types";

/**
 * Gmail + Google Calendar over plain REST. The refresh token lives in the
 * google_accounts row (RLS: owner only); access tokens are minted on demand
 * and cached in memory for their lifetime.
 */

export const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

function creds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new HttpError(500, "Server is missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.");
  return { id, secret };
}

export function authUrl(redirectUri: string, state: string) {
  const p = new URLSearchParams({
    client_id: creds().id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const { id, secret } = creds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new HttpError(400, `Google: ${data.error_description ?? data.error ?? res.status}`);
  return data as { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string };
}

/** Swap the one-time code for tokens and store the account against the user. */
export async function connect(sb: SupabaseClient, userId: string, code: string, redirectUri: string) {
  const t = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!t.refresh_token) throw new HttpError(400, "Google did not return a refresh token. Remove the app's access at myaccount.google.com/permissions and connect again.");
  const email = t.id_token ? JSON.parse(Buffer.from(t.id_token.split(".")[1], "base64url").toString()).email : "";
  tokens.set(userId, { token: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000 });
  const tz = await gfetch(userId, sb, "https://www.googleapis.com/calendar/v3/users/me/settings/timezone")
    .then((r) => (r as { value: string }).value)
    .catch(() => "UTC");
  const { error } = await sb.from("google_accounts").upsert({
    user_id: userId,
    email,
    refresh_token: t.refresh_token,
    scope: t.scope ?? "",
    time_zone: tz,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new HttpError(500, error.message);
  return { email, timeZone: tz };
}

export async function account(sb: SupabaseClient) {
  const { data } = await sb.from("google_accounts").select("email, refresh_token, time_zone").maybeSingle();
  return data as { email: string; refresh_token: string; time_zone: string } | null;
}

const tokens = new Map<string, { token: string; exp: number }>();

async function accessToken(userId: string, sb: SupabaseClient) {
  const hit = tokens.get(userId);
  if (hit && hit.exp > Date.now()) return hit.token;
  const acc = await account(sb);
  if (!acc) throw new HttpError(409, "Google is not connected yet. Connect it in Settings.");
  const t = await tokenRequest({ refresh_token: acc.refresh_token, grant_type: "refresh_token" });
  tokens.set(userId, { token: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000 });
  return t.access_token;
}

async function gfetch(userId: string, sb: SupabaseClient, url: string, init: RequestInit = {}): Promise<unknown> {
  const token = await accessToken(userId, sb);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (res.status === 204) return {};
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) tokens.delete(userId);
    throw new HttpError(res.status === 401 ? 409 : 502, `Google: ${data?.error?.message ?? res.status}`);
  }
  return data;
}

export function disconnect(userId: string) {
  tokens.delete(userId);
}

/* ------------------------------------------------------------------ Gmail */

const GM = "https://gmail.googleapis.com/gmail/v1/users/me";

type Header = { name: string; value: string };
type Part = { mimeType: string; body?: { data?: string }; parts?: Part[]; headers?: Header[] };
type GMessage = { id: string; threadId: string; labelIds?: string[]; snippet: string; internalDate: string; payload: Part };

const header = (h: Header[] | undefined, name: string) =>
  h?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? "";

function splitFrom(raw: string) {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  return m ? { name: m[1].trim() || m[2], email: m[2] } : { name: raw, email: raw };
}

const decode = (data?: string) => (data ? Buffer.from(data, "base64url").toString("utf8") : "");

function findPart(p: Part, type: string): string | null {
  if (p.mimeType === type && p.body?.data) return decode(p.body.data);
  for (const c of p.parts ?? []) {
    const hit = findPart(c, type);
    if (hit) return hit;
  }
  return null;
}

/** Folder presets the UI offers, mapped to Gmail search. */
const FOLDERS: Record<string, string> = {
  inbox: "in:inbox",
  unread: "in:inbox is:unread",
  starred: "is:starred",
  sent: "in:sent",
};

export async function listThreads(userId: string, sb: SupabaseClient, opts: { folder?: string; q?: string; max?: number }) {
  const q = [FOLDERS[opts.folder ?? "inbox"] ?? "", opts.q ?? ""].join(" ").trim();
  const list = (await gfetch(userId, sb, `${GM}/threads?${new URLSearchParams({ q, maxResults: String(opts.max ?? 30) })}`)) as {
    threads?: { id: string }[];
  };
  const ids = list.threads?.map((t) => t.id) ?? [];
  const threads = await Promise.all(
    ids.map(
      (id) =>
        gfetch(userId, sb, `${GM}/threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`) as Promise<{
          id: string;
          messages: GMessage[];
        }>
    )
  );
  return threads.map((t): MailSummary => {
    const first = t.messages[0];
    const last = t.messages[t.messages.length - 1];
    const from = splitFrom(header(last.payload.headers, "From"));
    const labels = new Set(t.messages.flatMap((m) => m.labelIds ?? []));
    return {
      id: t.id,
      subject: header(first.payload.headers, "Subject") || "(no subject)",
      from: from.name,
      fromEmail: from.email,
      date: new Date(Number(last.internalDate)).toISOString(),
      snippet: decodeEntities(last.snippet),
      unread: labels.has("UNREAD"),
      starred: labels.has("STARRED"),
      count: t.messages.length,
    };
  });
}

function decodeEntities(s: string) {
  return s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export async function getThread(userId: string, sb: SupabaseClient, id: string): Promise<MailThread> {
  const t = (await gfetch(userId, sb, `${GM}/threads/${id}?format=full`)) as { id: string; messages: GMessage[] };
  const messages = t.messages.map((m): MailMessage => {
    const h = m.payload.headers;
    const html = findPart(m.payload, "text/html");
    const text = findPart(m.payload, "text/plain") ?? (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : m.snippet);
    return {
      id: m.id,
      from: header(h, "From"),
      to: header(h, "To"),
      cc: header(h, "Cc"),
      subject: header(h, "Subject"),
      date: new Date(Number(m.internalDate)).toISOString(),
      messageId: header(h, "Message-ID") || header(h, "Message-Id"),
      references: header(h, "References"),
      html,
      text,
    };
  });
  return { id: t.id, subject: messages[0]?.subject || "(no subject)", messages };
}

export async function modifyThread(userId: string, sb: SupabaseClient, id: string, add: string[] = [], remove: string[] = []) {
  await gfetch(userId, sb, `${GM}/threads/${id}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }),
  });
  return { ok: true };
}

/** RFC 2047 encode a header value only when it needs it. */
const encHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);

/** The account's Gmail "Send as" identity: display name and signature (HTML), cached briefly. */
const sendAsCache = new Map<string, { at: number; value: SendAs }>();
export type SendAs = { email: string; name: string; signature: string };

export async function getSendAs(userId: string, sb: SupabaseClient): Promise<SendAs> {
  const hit = sendAsCache.get(userId);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.value;
  const data = (await gfetch(userId, sb, `${GM}/settings/sendAs`)) as {
    sendAs?: { sendAsEmail: string; displayName?: string; signature?: string; isPrimary?: boolean; isDefault?: boolean }[];
  };
  const list = data.sendAs ?? [];
  const main = list.find((s) => s.isDefault) ?? list.find((s) => s.isPrimary) ?? list[0];
  const value = { email: main?.sendAsEmail ?? "", name: main?.displayName ?? "", signature: main?.signature ?? "" };
  sendAsCache.set(userId, { at: Date.now(), value });
  return value;
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const htmlToText = (h: string) =>
  h
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const b64lines = (s: string) => Buffer.from(s).toString("base64").replace(/(.{76})/g, "$1\r\n");

export async function sendMail(
  userId: string,
  sb: SupabaseClient,
  m: { to: string; cc?: string; bcc?: string; subject: string; body: string; threadId?: string; inReplyTo?: string; references?: string; signature?: boolean }
) {
  if (!m.to?.trim()) throw new HttpError(400, "Add at least one recipient.");
  const me = await getSendAs(userId, sb).catch(() => null);
  const sig = m.signature !== false && me?.signature ? me.signature : "";

  // Plain text and HTML versions, like Gmail sends. The signature goes on both.
  const text = sig ? `${m.body}\r\n\r\n--\r\n${htmlToText(sig)}` : m.body;
  const html =
    `<div dir="ltr">${escapeHtml(m.body).replace(/\r?\n/g, "<br>")}</div>` +
    (sig ? `<br><div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature">${sig}</div>` : "");

  const boundary = `lifedash_${crypto.randomUUID().replace(/-/g, "")}`;
  const headers = [
    me?.email ? `From: ${me.name ? `${encHeader(me.name)} ` : ""}<${me.email}>` : "",
    `To: ${m.to}`,
    m.cc ? `Cc: ${m.cc}` : "",
    m.bcc ? `Bcc: ${m.bcc}` : "",
    `Subject: ${encHeader(m.subject || "")}`,
    m.inReplyTo ? `In-Reply-To: ${m.inReplyTo}` : "",
    m.inReplyTo ? `References: ${[m.references, m.inReplyTo].filter(Boolean).join(" ")}` : "",
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const raw = [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64lines(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64lines(html),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const out = (await gfetch(userId, sb, `${GM}/messages/send`, {
    method: "POST",
    body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url"), ...(m.threadId ? { threadId: m.threadId } : {}) }),
  })) as { id: string; threadId: string };
  return { id: out.id, threadId: out.threadId };
}

/* --------------------------------------------------------------- Calendar */

const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

type GEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink: string;
  hangoutLink?: string;
  status?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; responseStatus?: string; self?: boolean; organizer?: boolean }[];
  organizer?: { email: string; self?: boolean };
};

const toEvent = (e: GEvent): CalEvent => ({
  id: e.id,
  title: e.summary || "(no title)",
  description: e.description ?? "",
  location: e.location ?? "",
  start: e.start.dateTime ?? e.start.date ?? "",
  end: e.end.dateTime ?? e.end.date ?? "",
  allDay: !e.start.dateTime,
  link: e.htmlLink,
  meet: e.hangoutLink ?? "",
  attendees: (e.attendees ?? [])
    .filter((a) => !a.self)
    .map((a) => ({ email: a.email, name: a.displayName ?? "", status: (a.responseStatus ?? "needsAction") as CalEvent["attendees"][number]["status"] })),
  isOrganizer: e.organizer?.self ?? true,
});

export async function listEvents(userId: string, sb: SupabaseClient, from: string, to: string) {
  const p = new URLSearchParams({ timeMin: from, timeMax: to, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
  const data = (await gfetch(userId, sb, `${CAL}?${p}`)) as { items?: GEvent[] };
  return (data.items ?? []).filter((e) => e.status !== "cancelled").map(toEvent);
}

export type EventInput = {
  title?: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  timeZone?: string;
  /** Guest emails. Replaces the guest list when given. */
  attendees?: string[];
  /** true adds a Google Meet link, false removes it, undefined leaves it alone. */
  meet?: boolean;
};

function eventBody(e: EventInput) {
  const body: Record<string, unknown> = {};
  if (e.title !== undefined) body.summary = e.title;
  if (e.description !== undefined) body.description = e.description;
  if (e.location !== undefined) body.location = e.location;
  if (e.start) body.start = e.allDay ? { date: e.start.slice(0, 10) } : { dateTime: e.start, ...(e.timeZone ? { timeZone: e.timeZone } : {}) };
  if (e.end) body.end = e.allDay ? { date: e.end.slice(0, 10) } : { dateTime: e.end, ...(e.timeZone ? { timeZone: e.timeZone } : {}) };
  if (e.attendees) body.attendees = [...new Set(e.attendees.map((a) => a.trim().toLowerCase()).filter(Boolean))].map((email) => ({ email }));
  if (e.meet === true) body.conferenceData = { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } };
  if (e.meet === false) body.conferenceData = null;
  return body;
}

// Guests get Google's own invite, update and cancellation emails, like in Google Calendar.
const WRITE = "conferenceDataVersion=1&sendUpdates=all";

export async function createEvent(userId: string, sb: SupabaseClient, e: EventInput) {
  if (!e.start || !e.end) throw new HttpError(400, "An event needs a start and an end.");
  return toEvent((await gfetch(userId, sb, `${CAL}?${WRITE}`, { method: "POST", body: JSON.stringify(eventBody(e)) })) as GEvent);
}

export async function updateEvent(userId: string, sb: SupabaseClient, id: string, e: EventInput) {
  return toEvent(
    (await gfetch(userId, sb, `${CAL}/${encodeURIComponent(id)}?${WRITE}`, { method: "PATCH", body: JSON.stringify(eventBody(e)) })) as GEvent
  );
}

export async function deleteEvent(userId: string, sb: SupabaseClient, id: string) {
  await gfetch(userId, sb, `${CAL}/${encodeURIComponent(id)}?sendUpdates=all`, { method: "DELETE" });
  return { ok: true };
}
