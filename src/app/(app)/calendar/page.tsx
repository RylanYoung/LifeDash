"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowSquareOut, CalendarBlank, CaretLeft, CaretRight, Check, CheckCircle, Copy, Plus, Question, Trash, VideoCamera, X, XCircle } from "@phosphor-icons/react";
import { PageHeader } from "@/components/Shell";
import { Button, Empty, ErrorNote, Field, IconButton, Input, Rows, Sheet, Textarea, cx, toast } from "@/components/ui";
import { useStore } from "@/lib/store";
import { api } from "@/lib/supabase";
import type { CalEvent } from "@/lib/types";
import { addDays, fmtTime, startOfWeek, toLocalInput } from "@/lib/time";
import { localDate } from "@/lib/data";

const HOUR = 48; // px per hour in the week grid

type Guest = CalEvent["attendees"][number];
type Draft = {
  id?: string;
  title: string;
  allDay: boolean;
  start: string;
  end: string;
  location: string;
  description: string;
  link?: string;
  meet?: string;
  guests: Guest[];
  /** Pending Meet change: add a link, remove the existing one, or leave it. */
  meetChange?: "add" | "remove";
  isOrganizer: boolean;
};

export default function CalendarPage() {
  const { google } = useStore();
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);

  const load = useCallback(() => {
    setError(null);
    setEvents(null);
    api<{ events: CalEvent[] }>(`/api/calendar?from=${week.toISOString()}&to=${addDays(week, 7).toISOString()}`)
      .then((r) => setEvents(r.events))
      .catch((e) => setError(e.message));
  }, [week]);

  useEffect(() => {
    if (google?.connected) load();
  }, [google?.connected, load]);

  const newAt = (d: Date) => {
    const end = new Date(d.getTime() + 3_600_000);
    setDraft({ title: "", allDay: false, start: toLocalInput(d), end: toLocalInput(end), location: "", description: "", guests: [], isOrganizer: true });
  };

  const openEvent = (e: CalEvent) =>
    setDraft({
      id: e.id,
      title: e.title,
      allDay: e.allDay,
      start: e.allDay ? e.start : toLocalInput(new Date(e.start)),
      end: e.allDay ? localDate(addDays(new Date(`${e.end}T00:00:00`), -1)) : toLocalInput(new Date(e.end)),
      location: e.location,
      description: e.description,
      link: e.link,
      meet: e.meet,
      guests: e.attendees,
      isOrganizer: e.isOrganizer,
    });

  const label = `${days[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} to ${days[6].toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <title>Calendar · LifeDash</title>
      <PageHeader
        title="Calendar"
        sub={label}
        actions={
          <>
            <div className="flex items-center rounded-lg border border-rule-strong bg-page">
              <IconButton label="Previous week" onClick={() => setWeek(addDays(week, -7))}>
                <CaretLeft size={15} />
              </IconButton>
              <button className="press h-8 px-2 text-[13px] font-medium" onClick={() => setWeek(startOfWeek(new Date()))}>
                Today
              </button>
              <IconButton label="Next week" onClick={() => setWeek(addDays(week, 7))}>
                <CaretRight size={15} />
              </IconButton>
            </div>
            <Button variant="primary" onClick={() => newAt(nextHalfHour())} disabled={!google?.connected}>
              <Plus size={14} weight="bold" />
              <span className="hidden sm:inline">New event</span>
            </Button>
          </>
        }
      />

      <div className="px-4 pb-10 md:px-8">
        {google && !google.connected ? (
          <Empty
            icon={<CalendarBlank size={20} />}
            title="Connect Google Calendar"
            body="Link your Google account once and your calendar shows up here. You can add, move and delete events without leaving LifeDash."
            action={
              <Link href="/settings#google">
                <Button variant="primary" size="sm">
                  Connect in Settings
                </Button>
              </Link>
            }
          />
        ) : error ? (
          <ErrorNote message={error} onRetry={load} />
        ) : (
          <>
            <div className="hidden md:block">
              <WeekGrid days={days} events={events} onSlot={newAt} onEvent={openEvent} />
            </div>
            <div className="md:hidden">{events ? <Agenda days={days} events={events} onEvent={openEvent} onAdd={newAt} /> : <Rows n={5} />}</div>
          </>
        )}
      </div>

      <EventSheet
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={() => {
          setDraft(null);
          load();
        }}
      />
    </>
  );
}

function nextHalfHour() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Events for one day, with overlap columns so concurrent events sit side by side. */
function layoutDay(events: CalEvent[]) {
  const sorted = [...events].sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const out: { e: CalEvent; col: number; cols: number }[] = [];
  let cluster: typeof out = [];
  let clusterEnd = 0;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    cluster.forEach((c) => (c.cols = cols));
    out.push(...cluster);
    cluster = [];
  };
  for (const e of sorted) {
    const s = +new Date(e.start);
    if (cluster.length && s >= clusterEnd) flush();
    const used = new Set(cluster.filter((c) => +new Date(c.e.end) > s).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ e, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, +new Date(e.end));
  }
  flush();
  return out;
}

function WeekGrid({ days, events, onSlot, onEvent }: { days: Date[]; events: CalEvent[] | null; onSlot: (d: Date) => void; onEvent: (e: CalEvent) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: HOUR * 7 - 8 });
  }, []);

  const allDay = (d: Date) =>
    (events ?? []).filter((e) => e.allDay && e.start <= localDate(d) && e.end > localDate(d));

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-page">
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-rule">
        <div />
        {days.map((d) => {
          const today = sameDay(d, now);
          return (
            <div key={d.toISOString()} className="border-l border-rule px-2 py-2.5">
              <div className={cx("text-xs", today ? "font-medium text-accent-text" : "text-ink-3")}>{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
              <div className={cx("mt-0.5 inline-flex size-7 items-center justify-center rounded-full text-[15px] font-semibold tnum", today && "bg-accent text-accent-ink")}>
                {d.getDate()}
              </div>
              <div className="mt-1 grid gap-1">
                {allDay(d).map((e) => (
                  <button key={e.id} onClick={() => onEvent(e)} className="press truncate rounded-md bg-accent-soft px-1.5 py-0.5 text-left text-xs text-ink">
                    {e.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={scroller} className="relative max-h-[calc(100dvh-230px)] min-h-[420px] overflow-y-auto">
        {!events ? <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden"><div className="skeleton h-full w-full" /></div> : null}
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]" style={{ height: HOUR * 24 }}>
          <div className="relative">
            {Array.from({ length: 23 }, (_, h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 font-mono text-[11px] text-ink-3 tnum" style={{ top: (h + 1) * HOUR }}>
                {new Date(2000, 0, 1, h + 1).toLocaleTimeString(undefined, { hour: "numeric" })}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const dayEvents = layoutDay((events ?? []).filter((e) => !e.allDay && sameDay(new Date(e.start), d)));
            const today = sameDay(d, now);
            return (
              <div
                key={d.toISOString()}
                className="relative border-l border-rule"
                style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR - 1}px, var(--rule) ${HOUR - 1}px ${HOUR}px)` }}
                onClick={(ev) => {
                  if (ev.target !== ev.currentTarget) return;
                  const y = ev.nativeEvent.offsetY;
                  const mins = Math.floor((y / HOUR) * 2) * 30;
                  const at = new Date(d);
                  at.setHours(0, mins, 0, 0);
                  onSlot(at);
                }}
              >
                {dayEvents.map(({ e, col, cols }) => {
                  const s = new Date(e.start);
                  const top = (s.getHours() + s.getMinutes() / 60) * HOUR;
                  const height = Math.max(22, ((+new Date(e.end) - +s) / 3_600_000) * HOUR - 2);
                  const past = +new Date(e.end) < +now;
                  return (
                    <button
                      key={e.id}
                      onClick={() => onEvent(e)}
                      className={cx(
                        "press absolute overflow-hidden rounded-md bg-accent-soft px-1.5 shadow-[inset_0_0_0_1px_var(--page)] py-1 text-left text-xs leading-tight text-ink hover:brightness-[0.98]",
                        past && "opacity-60"
                      )}
                      style={{ top: top + 1, height, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}
                    >
                      <span className="block truncate font-medium">{e.title}</span>
                      {height > 34 ? <span className="block truncate text-ink-3 tnum">{fmtTime(e.start)}</span> : null}
                    </button>
                  );
                })}
                {today ? (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (now.getHours() + now.getMinutes() / 60) * HOUR }}>
                    <span className="-ml-1 size-2 rounded-full bg-accent" />
                    <span className="h-[1.5px] flex-1 bg-accent" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Agenda({ days, events, onEvent, onAdd }: { days: Date[]; events: CalEvent[]; onEvent: (e: CalEvent) => void; onAdd: (d: Date) => void }) {
  const now = new Date();
  return (
    <div className="grid gap-4">
      {days.map((d) => {
        const ds = localDate(d);
        const list = events.filter((e) => (e.allDay ? e.start <= ds && e.end > ds : sameDay(new Date(e.start), d)));
        const today = sameDay(d, now);
        return (
          <section key={ds}>
            <div className="mb-1.5 flex items-center gap-2">
              <h2 className={cx("text-sm font-semibold", today && "text-accent-text")}>
                {today ? "Today" : d.toLocaleDateString(undefined, { weekday: "long" })}
                <span className="ml-1.5 font-normal text-ink-3">{d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
              </h2>
              <button
                onClick={() => {
                  const at = new Date(d);
                  at.setHours(today ? Math.min(23, now.getHours() + 1) : 9, 0, 0, 0);
                  onAdd(at);
                }}
                className="ml-auto text-ink-3"
                aria-label={`Add event on ${ds}`}
              >
                <Plus size={16} />
              </button>
            </div>
            {list.length ? (
              <ul className="overflow-hidden rounded-xl border border-rule bg-page">
                {list.map((e, i) => (
                  <li key={e.id} className={cx(i > 0 && "border-t border-rule")}>
                    <button onClick={() => onEvent(e)} className="flex w-full gap-3 px-4 py-3 text-left">
                      <span className="w-14 shrink-0 font-mono text-xs text-ink-3 tnum">{e.allDay ? "All day" : fmtTime(e.start)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] text-ink">{e.title}</span>
                        {!e.allDay ? (
                          <span className="block text-xs text-ink-3 tnum">
                            to {fmtTime(e.end)}
                            {e.location ? `, ${e.location}` : ""}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-rule px-4 py-3 text-[13px] text-ink-3">Free</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function EventSheet({ draft, onClose, onSaved }: { draft: Draft | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft | null>(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setD(draft);
    setError(null);
  }, [draft]);

  if (!d) return null;

  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });

  async function save() {
    if (!d) return;
    setBusy(true);
    setError(null);
    try {
      // Only the organiser can change the guest list or the Meet link.
      const extras = d.isOrganizer
        ? { attendees: d.guests.map((g) => g.email), meet: d.meetChange === "add" ? true : d.meetChange === "remove" ? false : undefined }
        : {};
      const body = d.allDay
        ? { title: d.title || "(no title)", allDay: true, start: d.start.slice(0, 10), end: localDate(addDays(new Date(`${d.end.slice(0, 10)}T00:00:00`), 1)), location: d.location, description: d.description, ...extras }
        : {
            title: d.title || "(no title)",
            allDay: false,
            start: new Date(d.start).toISOString(),
            end: new Date(d.end).toISOString(),
            location: d.location,
            description: d.description,
            ...extras,
          };
      if (!d.allDay && +new Date(d.end) <= +new Date(d.start)) throw new Error("The end has to be after the start.");
      await api(d.id ? `/api/calendar/${encodeURIComponent(d.id)}` : "/api/calendar", { method: d.id ? "PATCH" : "POST", body: JSON.stringify(body) });
      toast(d.guests.length && d.isOrganizer ? (d.id ? "Saved. Guests notified" : "Event added. Invites sent") : d.id ? "Event updated" : "Event added");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!d?.id || !confirm(d.guests.length ? `Delete "${d.title}"? Guests will get a cancellation email.` : `Delete "${d.title}"?`)) return;
    setBusy(true);
    try {
      await api(`/api/calendar/${encodeURIComponent(d.id)}`, { method: "DELETE" });
      toast("Event deleted");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={d.id ? "Edit event" : "New event"}
      footer={
        <>
          {d.id ? (
            <button onClick={remove} disabled={busy} className="press inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-ink-3 hover:bg-danger-soft hover:text-danger">
              <Trash size={15} />
              Delete
            </button>
          ) : null}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" busy={busy} onClick={save}>
              {d.id ? "Save" : d.guests.length ? "Add and invite" : "Add event"}
            </Button>
          </div>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Input value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Event title" aria-label="Title" className="h-11 text-base" />
        <label className="flex items-center gap-2.5 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={d.allDay}
            onChange={(e) => set({ allDay: e.target.checked, start: d.start.slice(0, 10) + (e.target.checked ? "" : "T09:00"), end: d.end.slice(0, 10) + (e.target.checked ? "" : "T10:00") })}
            className="size-4 accent-[var(--accent)]"
          />
          All day
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Starts" htmlFor="ev-start">
            <Input
              id="ev-start"
              type={d.allDay ? "date" : "datetime-local"}
              value={d.allDay ? d.start.slice(0, 10) : d.start}
              onChange={(e) => {
                const v = e.target.value;
                if (d.allDay) return set({ start: v, end: d.end < v ? v : d.end });
                const dur = +new Date(d.end) - +new Date(d.start);
                set({ start: v, end: toLocalInput(new Date(+new Date(v) + (dur > 0 ? dur : 3_600_000))) });
              }}
            />
          </Field>
          <Field label="Ends" htmlFor="ev-end">
            <Input id="ev-end" type={d.allDay ? "date" : "datetime-local"} value={d.allDay ? d.end.slice(0, 10) : d.end} onChange={(e) => set({ end: e.target.value })} />
          </Field>
        </div>
        <GuestField guests={d.guests} disabled={!d.isOrganizer} onChange={(guests) => set({ guests })} />

        <MeetField
          link={d.meetChange === "remove" ? "" : d.meet ?? ""}
          pending={d.meetChange === "add"}
          disabled={!d.isOrganizer}
          onAdd={() => set({ meetChange: d.meet ? undefined : "add" })}
          onRemove={() => set({ meetChange: d.meet ? "remove" : undefined })}
        />

        <Field label="Location" htmlFor="ev-loc">
          <Input id="ev-loc" value={d.location} onChange={(e) => set({ location: e.target.value })} placeholder="Add location" />
        </Field>
        <Field label="Description" htmlFor="ev-notes">
          <Textarea id="ev-notes" rows={4} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Add description" />
        </Field>
        {!d.isOrganizer ? <p className="text-[13px] text-ink-3">Someone else organises this event, so only they can change the guests or the Meet link.</p> : null}
        {error ? <ErrorNote message={error} /> : null}
        {d.link ? (
          <a href={d.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink">
            <ArrowSquareOut size={14} /> Open in Google Calendar
          </a>
        ) : null}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const STATUS: Record<Guest["status"], { label: string; icon: React.ReactNode }> = {
  accepted: { label: "Going", icon: <CheckCircle size={15} weight="fill" className="text-accent-text" /> },
  declined: { label: "Not going", icon: <XCircle size={15} weight="fill" className="text-danger" /> },
  tentative: { label: "Maybe", icon: <Question size={15} weight="bold" className="text-[var(--tab-ochre)]" /> },
  needsAction: { label: "Awaiting reply", icon: <span className="inline-block size-[13px] rounded-full border-[1.5px] border-rule-strong" /> },
};

/** Type an email, press Enter (or comma) and it becomes a guest. Backspace on empty removes the last one. */
function GuestField({ guests, onChange, disabled }: { guests: Guest[]; onChange: (g: Guest[]) => void; disabled: boolean }) {
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);

  function commit(raw = text) {
    const emails = raw.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    if (!emails.length) return;
    const valid = emails.filter((x) => EMAIL.test(x) && !guests.some((g) => g.email.toLowerCase() === x.toLowerCase()));
    setBad(emails.some((x) => !EMAIL.test(x)));
    if (valid.length) onChange([...guests, ...valid.map((email) => ({ email, name: "", status: "needsAction" as const }))]);
    setText(emails.filter((x) => !EMAIL.test(x)).join(" "));
  }

  return (
    <Field label="Guests" htmlFor="ev-guest" hint={guests.length && !disabled ? "Google emails each guest an invite when you save." : undefined}>
      {!disabled ? (
        <Input
          id="ev-guest"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={text}
          placeholder="Add guests by email"
          onChange={(e) => {
            setBad(false);
            const v = e.target.value;
            if (/[,;]$/.test(v)) commit(v);
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Backspace" && !text && guests.length) onChange(guests.slice(0, -1));
          }}
          onBlur={() => commit()}
          aria-invalid={bad}
        />
      ) : null}
      {bad ? <p className="text-xs text-danger">That does not look like an email address.</p> : null}
      {guests.length ? (
        <ul className="grid gap-0.5">
          {guests.map((g) => (
            <li key={g.email} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
              <span title={STATUS[g.status].label} className="inline-flex w-4 justify-center">
                {STATUS[g.status].icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{g.name || g.email}</span>
                <span className="block truncate text-xs text-ink-3">
                  {g.name ? `${g.email}, ` : ""}
                  {STATUS[g.status].label}
                </span>
              </span>
              {!disabled ? (
                <IconButton label={`Remove ${g.email}`} className="size-7" onClick={() => onChange(guests.filter((x) => x.email !== g.email))}>
                  <X size={13} />
                </IconButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Field>
  );
}

function MeetField({ link, pending, disabled, onAdd, onRemove }: { link: string; pending: boolean; disabled: boolean; onAdd: () => void; onRemove: () => void }) {
  const [copied, setCopied] = useState(false);
  if (link) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent-soft px-3 py-2.5">
        <VideoCamera size={18} weight="fill" className="text-accent-text" />
        <a href={link} target="_blank" rel="noreferrer" className="press inline-flex h-8 items-center rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-ink hover:bg-accent-hover">
          Join with Google Meet
        </a>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-3">{link.replace("https://", "")}</span>
        <IconButton
          label="Copy Meet link"
          className="size-8"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </IconButton>
        {!disabled ? (
          <IconButton label="Remove Google Meet" className="size-8" onClick={onRemove}>
            <X size={15} />
          </IconButton>
        ) : null}
      </div>
    );
  }
  if (pending) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-[13px] text-ink">
        <VideoCamera size={18} weight="fill" className="text-accent-text" />
        <span className="flex-1">A Google Meet link is created when you save.</span>
        <IconButton label="Do not add Google Meet" className="size-8" onClick={onRemove}>
          <X size={15} />
        </IconButton>
      </div>
    );
  }
  if (disabled) return null;
  return (
    <button
      type="button"
      onClick={onAdd}
      className="press inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-rule-strong px-3.5 text-sm font-medium text-ink hover:bg-sunk"
    >
      <VideoCamera size={17} className="text-accent-text" />
      Add Google Meet video conferencing
    </button>
  );
}
