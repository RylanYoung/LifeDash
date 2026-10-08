"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Archive, ArrowBendUpLeft, ArrowLeft, ArrowSquareOut, EnvelopeSimple, EnvelopeSimpleOpen, MagnifyingGlass, NotePencil, PaperPlaneTilt, Star } from "@phosphor-icons/react";
import { PageHeader } from "@/components/Shell";
import { Button, Empty, ErrorNote, Field, IconButton, Input, Rows, Sheet, Textarea, cx, toast } from "@/components/ui";
import { useStore } from "@/lib/store";
import { api } from "@/lib/supabase";
import type { MailMessage, MailSummary, MailThread } from "@/lib/types";
import { fmtTime } from "@/lib/time";

const FOLDERS = [
  ["inbox", "Inbox"],
  ["unread", "Unread"],
  ["starred", "Starred"],
  ["sent", "Sent"],
] as const;

export default function MailPage() {
  return (
    <Suspense>
      <Mail />
    </Suspense>
  );
}

function Mail() {
  const { google } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const selected = params.get("thread");
  const [folder, setFolder] = useState<string>("inbox");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [threads, setThreads] = useState<MailSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setThreads(null);
    api<{ threads: MailSummary[] }>(`/api/mail?folder=${folder}&q=${encodeURIComponent(submitted)}`)
      .then((r) => setThreads(r.threads))
      .catch((e) => setError(e.message));
  }, [folder, submitted]);

  useEffect(() => {
    if (google?.connected) load();
  }, [google?.connected, load]);

  const select = (id: string | null) => router.replace(id ? `/mail?thread=${id}` : "/mail", { scroll: false });

  const patchThread = (id: string, patch: Partial<MailSummary> | null) =>
    setThreads((all) => (all ? (patch ? all.map((t) => (t.id === id ? { ...t, ...patch } : t)) : all.filter((t) => t.id !== id)) : all));

  if (google && !google.connected) {
    return (
      <>
        <title>Email · LifeDash</title>
        <PageHeader title="Email" />
        <div className="px-4 md:px-8">
          <Empty
            icon={<EnvelopeSimple size={20} />}
            title="Connect Gmail"
            body="Link your Google account once to read, search, reply and send email from here."
            action={
              <Link href="/settings#google">
                <Button variant="primary" size="sm">
                  Connect in Settings
                </Button>
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <title>Email · LifeDash</title>
      <div className={cx(selected && "hidden md:block")}>
        <PageHeader
          title="Email"
          sub={google?.email ?? undefined}
          actions={
            <Button variant="primary" onClick={() => setCompose(true)}>
              <NotePencil size={15} />
              <span className="hidden sm:inline">Compose</span>
            </Button>
          }
        />
      </div>

      <div className="px-0 pb-0 md:px-8 md:pb-8">
        <div className="grid overflow-hidden border-rule bg-page md:h-[calc(100dvh-150px)] md:grid-cols-[minmax(300px,380px)_1fr] md:rounded-xl md:border">
          {/* list */}
          <div className={cx("flex min-h-0 flex-col md:border-r md:border-rule", selected && "hidden md:flex")}>
            <div className="grid gap-2 border-b border-rule p-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(query);
                }}
                className="relative"
              >
                <MagnifyingGlass size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
                <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mail" aria-label="Search mail" className="pl-9" />
              </form>
              <div className="flex gap-1" role="tablist">
                {FOLDERS.map(([k, label]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={folder === k}
                    onClick={() => setFolder(k)}
                    className={cx("press h-8 rounded-lg px-2.5 text-[13px]", folder === k ? "bg-sunk font-medium text-ink" : "text-ink-3 hover:text-ink")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {error ? (
                <div className="p-3">
                  <ErrorNote message={error} onRetry={load} />
                </div>
              ) : !threads ? (
                <div className="p-4">
                  <Rows n={7} />
                </div>
              ) : !threads.length ? (
                <p className="p-6 text-sm text-ink-3">{submitted ? `Nothing matches "${submitted}".` : "Nothing here."}</p>
              ) : (
                <ul>
                  {threads.map((t) => (
                    <li key={t.id} className="border-b border-rule last:border-0">
                      <button
                        onClick={() => select(t.id)}
                        className={cx("block w-full px-4 py-3 text-left transition-colors duration-150", selected === t.id ? "bg-accent-soft" : "hover:bg-sunk/60")}
                      >
                        <span className="flex items-center gap-2">
                          {t.unread ? <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" /> : null}
                          <span className={cx("truncate text-sm", t.unread ? "font-semibold text-ink" : "text-ink-2")}>{t.from}</span>
                          {t.count > 1 ? <span className="text-xs text-ink-3 tnum">{t.count}</span> : null}
                          {t.starred ? <Star size={12} weight="fill" className="shrink-0 text-[var(--tab-ochre)]" /> : null}
                          <span className="ml-auto shrink-0 text-xs text-ink-3 tnum">{fmtTime(t.date, true)}</span>
                        </span>
                        <span className={cx("mt-0.5 block truncate text-[13px]", t.unread ? "font-medium text-ink" : "text-ink-2")}>{t.subject}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-ink-3">{t.snippet}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* reader */}
          <div className={cx("min-h-0", !selected && "hidden md:block")}>
            {selected ? (
              <Reader
                key={selected}
                id={selected}
                summary={threads?.find((t) => t.id === selected)}
                onBack={() => select(null)}
                onPatch={(p) => patchThread(selected, p)}
                onArchived={() => {
                  patchThread(selected, folder === "inbox" || folder === "unread" ? null : {});
                  select(null);
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-sm text-ink-3">Pick an email to read it.</div>
            )}
          </div>
        </div>
      </div>

      <Compose open={compose} onClose={() => setCompose(false)} />
    </>
  );
}

function Reader({
  id,
  summary,
  onBack,
  onPatch,
  onArchived,
}: {
  id: string;
  summary?: MailSummary;
  onBack: () => void;
  onPatch: (p: Partial<MailSummary>) => void;
  onArchived: () => void;
}) {
  const [thread, setThread] = useState<MailThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [sending, setSending] = useState(false);
  const [starred, setStarred] = useState(summary?.starred ?? false);
  const myEmail = useStore().google?.email;

  useEffect(() => {
    api<MailThread>(`/api/mail/${id}`)
      .then(setThread)
      .catch((e) => setError(e.message));
    // Opening it reads it.
    api("/api/mail", { method: "POST", body: JSON.stringify({ action: "modify", id, remove: ["UNREAD"] }) })
      .then(() => onPatch({ unread: false }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function modify(add: string[], remove: string[], done: string) {
    try {
      await api("/api/mail", { method: "POST", body: JSON.stringify({ action: "modify", id, add, remove }) });
      toast(done);
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update");
      return false;
    }
  }

  const last = thread?.messages.at(-1);
  // Reply to the other side: if the last message is mine, answer whoever it went to.
  const mine = Boolean(myEmail && last?.from.toLowerCase().includes(myEmail.toLowerCase()));
  const to = last ? (mine ? last.to : last.from) : "";

  async function send() {
    if (!thread || !last || !reply.trim()) return;
    setSending(true);
    try {
      await api("/api/mail", {
        method: "POST",
        body: JSON.stringify({
          action: "send",
          to,
          subject: /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`,
          body: reply,
          threadId: thread.id,
          inReplyTo: last.messageId,
          references: last.references,
        }),
      });
      toast("Reply sent");
      setReply("");
      setReplying(false);
      setThread(await api<MailThread>(`/api/mail/${id}`));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-[calc(100dvh-72px)] flex-col md:min-h-0">
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-rule bg-page px-2 py-2 md:px-4">
        <IconButton label="Back" onClick={onBack} className="md:hidden">
          <ArrowLeft size={18} />
        </IconButton>
        <Button size="sm" variant="ghost" onClick={() => setReplying(true)} disabled={!thread}>
          <ArrowBendUpLeft size={15} />
          Reply
        </Button>
        <Button size="sm" variant="ghost" onClick={async () => (await modify([], ["INBOX"], "Archived")) && onArchived()}>
          <Archive size={15} />
          Archive
        </Button>
        <IconButton
          label={starred ? "Unstar" : "Star"}
          onClick={async () => {
            const next = !starred;
            setStarred(next);
            onPatch({ starred: next });
            await modify(next ? ["STARRED"] : [], next ? [] : ["STARRED"], next ? "Starred" : "Unstarred");
          }}
        >
          <Star size={16} weight={starred ? "fill" : "regular"} className={starred ? "text-[var(--tab-ochre)]" : ""} />
        </IconButton>
        <IconButton
          label="Mark unread"
          onClick={async () => {
            if (await modify(["UNREAD"], [], "Marked unread")) {
              onPatch({ unread: true });
              onBack();
            }
          }}
        >
          <EnvelopeSimpleOpen size={16} />
        </IconButton>
        <a
          href={`https://mail.google.com/mail/u/0/#all/${id}`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex size-8 items-center justify-center rounded-lg text-ink-3 hover:bg-sunk hover:text-ink"
          aria-label="Open in Gmail"
          title="Open in Gmail"
        >
          <ArrowSquareOut size={16} />
        </a>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="p-4">
            <ErrorNote message={error} />
          </div>
        ) : !thread ? (
          <div className="p-6">
            <div className="skeleton mb-4 h-5 w-2/3" />
            <Rows n={6} />
          </div>
        ) : (
          <div className="px-4 py-5 md:px-6">
            <h2 className="text-lg font-semibold tracking-[-0.01em]">{thread.subject}</h2>
            <div className="mt-4 grid gap-3">
              {thread.messages.map((m, i) => (
                <Message key={m.id} m={m} defaultOpen={i === thread.messages.length - 1} />
              ))}
            </div>

            {replying ? (
              <div className="anim-pop mt-4 rounded-xl border border-rule-strong bg-page">
                <p className="border-b border-rule px-3.5 py-2 text-xs text-ink-3">To {to}</p>
                <textarea
                  autoFocus
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && send()}
                  rows={6}
                  placeholder="Write your reply"
                  aria-label="Reply"
                  className="w-full resize-y bg-transparent px-3.5 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none md:text-sm"
                />
                <div className="flex items-center gap-2 border-t border-rule px-3 py-2">
                  <span className="hidden text-xs text-ink-3 md:inline">Ctrl + Enter to send</span>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setReplying(false)}>
                    Discard
                  </Button>
                  <Button size="sm" variant="primary" busy={sending} disabled={!reply.trim()} onClick={send}>
                    <PaperPlaneTilt size={14} />
                    Send
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setReplying(true)}
                className="press mt-4 flex h-11 w-full items-center gap-2 rounded-xl border border-rule-strong px-4 text-left text-sm text-ink-3 hover:bg-sunk/60"
              >
                <ArrowBendUpLeft size={15} />
                Reply to {to.replace(/<.*>/, "").replace(/"/g, "").trim() || "sender"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Message({ m, defaultOpen }: { m: MailMessage; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const name = m.from.replace(/<.*>/, "").replace(/"/g, "").trim() || m.from;
  return (
    <article className="rounded-xl border border-rule">
      <button onClick={() => setOpen(!open)} className="flex w-full items-baseline gap-2 px-4 py-3 text-left">
        <span className="truncate text-sm font-medium">{name}</span>
        {!open ? <span className="truncate text-[13px] text-ink-3">{m.text.slice(0, 120)}</span> : null}
        <span className="ml-auto shrink-0 text-xs text-ink-3 tnum">
          {new Date(m.date).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
        </span>
      </button>
      {open ? (
        <div className="px-4 pb-4">
          <p className="mb-3 truncate text-xs text-ink-3">To {m.to}{m.cc ? `, cc ${m.cc}` : ""}</p>
          {m.html ? <HtmlBody html={m.html} /> : <div className="text-sm leading-relaxed whitespace-pre-wrap text-ink-2">{m.text}</div>}
        </div>
      ) : null}
    </article>
  );
}

/** HTML mail in a sandboxed frame: no scripts, links open in a new tab, height follows content. */
function HtmlBody({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(200);
  const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;font:14px/1.55 system-ui,sans-serif;color:#1d2026;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>${html}</body></html>`;
  return (
    <iframe
      ref={ref}
      title="Email content"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={doc}
      onLoad={() => {
        const b = ref.current?.contentDocument?.body;
        if (b) setH(Math.min(4000, b.scrollHeight + 8));
      }}
      className="w-full rounded-lg bg-white"
      style={{ height: h }}
    />
  );
}

function Compose({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/mail", { method: "POST", body: JSON.stringify({ action: "send", to, cc, subject, body }) });
      toast("Email sent");
      setTo("");
      setCc("");
      setSubject("");
      setBody("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New email"
      footer={
        <>
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} disabled={!to.trim()} onClick={send}>
            <PaperPlaneTilt size={14} />
            Send
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="To" htmlFor="c-to" hint="Separate several addresses with commas.">
          <Input id="c-to" type="text" inputMode="email" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Cc" htmlFor="c-cc">
          <Input id="c-cc" type="text" inputMode="email" value={cc} onChange={(e) => setCc(e.target.value)} />
        </Field>
        <Field label="Subject" htmlFor="c-subject">
          <Input id="c-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Message" htmlFor="c-body">
          <Textarea id="c-body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {error ? <ErrorNote message={error} /> : null}
      </div>
    </Sheet>
  );
}
