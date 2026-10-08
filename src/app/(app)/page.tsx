"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import { CalendarBlank, CheckCircle, EnvelopeSimple, Sparkle } from "@phosphor-icons/react";
import { PageHeader } from "@/components/Shell";
import { TaskRow } from "@/components/TaskRow";
import { Button, Empty, ErrorNote, Panel, Rows, cx } from "@/components/ui";
import { latestBriefs, loadDoneSince, loadDue, localDate, type TaskWithSteps } from "@/lib/data";
import { useStore } from "@/lib/store";
import { api } from "@/lib/supabase";
import type { Brief, CalEvent, MailSummary } from "@/lib/types";
import { fmtTime } from "@/lib/time";

export default function TodayPage() {
  const { openQuickAdd, taskVersion, google } = useStore();
  const today = localDate();
  const [due, setDue] = useState<TaskWithSteps[] | null>(null);
  const [doneCount, setDoneCount] = useState(0);
  const [briefs, setBriefs] = useState<Brief[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const [d, done, b] = await Promise.all([loadDue(today), loadDoneSince(midnight.toISOString()), latestBriefs()]);
      setDue(d);
      setDoneCount(done.length);
      setBriefs(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load today");
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load, taskVersion]);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const overdue = due?.filter((t) => t.due_date! < today).length ?? 0;

  return (
    <>
      <title>Today · LifeDash</title>
      <PageHeader title={dateLabel} sub={greeting} />
      <div className="grid gap-4 px-4 pb-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 content-start gap-4">
          {error ? <ErrorNote message={error} onRetry={load} /> : null}
          <BriefPanel briefs={briefs} today={today} />

          <Panel
            title={due && due.length ? `Due today${overdue ? `, ${overdue} overdue` : ""}` : "Due today"}
            action={
              <Button size="sm" variant="ghost" onClick={() => openQuickAdd()}>
                Add
              </Button>
            }
          >
            {!due ? (
              <Rows n={3} />
            ) : due.length ? (
              <ul className="-mx-1.5 grid">
                {due.map((t) => (
                  <TaskRow key={t.id} task={t} showList onChange={(n) => setDue((all) => (n ? all!.map((x) => (x.id === t.id ? n : x)) : all!.filter((x) => x.id !== t.id)))} />
                ))}
              </ul>
            ) : (
              <Empty
                icon={<CheckCircle size={20} />}
                title={doneCount ? `All clear. ${doneCount} done today.` : "Nothing due today"}
                body="Give a task a due date and it shows up here on the day. Press N anywhere to add one."
              />
            )}
            {due?.length && doneCount ? <p className="mt-3 text-xs text-ink-3 tnum">{doneCount} done today</p> : null}
          </Panel>
        </div>

        <div className="grid content-start gap-4">
          <SchedulePanel connected={google?.connected} />
          <InboxPanel connected={google?.connected} />
        </div>
      </div>
    </>
  );
}

function BriefPanel({ briefs, today }: { briefs: Brief[] | null; today: string }) {
  const todays = useMemo(() => (briefs ?? []).filter((b) => b.for_date === today), [briefs, today]);
  const recap = todays.find((b) => b.kind === "recap");
  const morning = todays.find((b) => b.kind === "morning");
  const [tab, setTab] = useState<"morning" | "recap" | null>(null);
  const active = tab === "recap" ? recap : tab === "morning" ? morning : (recap ?? morning);

  if (!briefs) {
    return (
      <Panel>
        <div className="grid gap-2.5">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-4/5" />
        </div>
      </Panel>
    );
  }

  if (!active) {
    const last = briefs[0];
    return (
      <Panel>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-accent">
            <Sparkle size={18} weight="fill" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">No brief yet today</p>
            <p className="mt-1 max-w-[56ch] text-[13px] leading-relaxed text-ink-3">
              {last
                ? `Your last ${last.kind === "morning" ? "brief" : "recap"} was on ${new Date(`${last.for_date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}. Claude writes the next one on its schedule.`
                : "Claude writes a morning brief and an evening recap here, using your Pro plan. Set up the two routines once in Settings."}
            </p>
            {!last ? (
              <Link href="/settings#claude" className="mt-2 inline-block text-[13px] font-medium text-accent hover:underline">
                Set up briefs
              </Link>
            ) : null}
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <section className="rounded-xl border border-rule bg-page">
      <header className="flex items-center gap-2 px-4 pt-3.5 md:px-5">
        <Sparkle size={16} weight="fill" className="text-accent" />
        <h2 className="text-[13px] font-semibold text-ink-2">{active.kind === "morning" ? "Morning brief" : "Evening recap"}</h2>
        {morning && recap ? (
          <div className="ml-auto flex rounded-lg bg-sunk p-0.5 text-xs">
            {(["morning", "recap"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cx("press rounded-md px-2.5 py-1", active.kind === k ? "bg-page font-medium text-ink shadow-[0_0_0_1px_var(--rule)]" : "text-ink-3")}
              >
                {k === "morning" ? "Brief" : "Recap"}
              </button>
            ))}
          </div>
        ) : (
          <span className="ml-auto text-xs text-ink-3 tnum">{fmtTime(active.created_at)}</span>
        )}
      </header>
      <div className="prose-brief px-4 pt-2 pb-4 md:px-5">
        <Markdown>{active.content}</Markdown>
      </div>
    </section>
  );
}

function ConnectGoogle({ what }: { what: string }) {
  return (
    <Empty
      icon={what === "calendar" ? <CalendarBlank size={20} /> : <EnvelopeSimple size={20} />}
      title="Connect Google"
      body={`Link your Google account once to see your ${what} here.`}
      action={
        <Link href="/settings#google">
          <Button size="sm" variant="secondary">
            Connect in Settings
          </Button>
        </Link>
      }
    />
  );
}

function SchedulePanel({ connected }: { connected?: boolean }) {
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!connected) return;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 86_400_000);
    api<{ events: CalEvent[] }>(`/api/calendar?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((r) => setEvents(r.events))
      .catch((e) => setError(e.message));
  }, [connected]);

  const timed = events?.filter((e) => !e.allDay) ?? [];
  const allDay = events?.filter((e) => e.allDay) ?? [];
  const nowIndex = timed.findIndex((e) => new Date(e.end).getTime() > now);

  return (
    <Panel
      title="Schedule"
      action={
        <Link href="/calendar" className="text-xs font-medium text-ink-3 hover:text-ink">
          Week
        </Link>
      }
    >
      {connected === false ? (
        <ConnectGoogle what="calendar" />
      ) : error ? (
        <ErrorNote message={error} />
      ) : !events ? (
        <Rows n={3} />
      ) : !events.length ? (
        <p className="py-2 text-sm text-ink-3">Nothing on the calendar today.</p>
      ) : (
        <ol className="grid">
          {allDay.map((e) => (
            <li key={e.id} className="mb-1 flex items-center gap-3 rounded-md bg-accent-soft px-2.5 py-1.5 text-[13px] text-ink">
              <span className="w-12 text-xs text-ink-3">All day</span>
              <span className="truncate">{e.title}</span>
            </li>
          ))}
          {timed.map((e, i) => {
            const past = new Date(e.end).getTime() <= now;
            const live = new Date(e.start).getTime() <= now && !past;
            return (
              <li key={e.id}>
                {i === nowIndex && !live ? <NowLine /> : null}
                <a href={e.link} target="_blank" rel="noreferrer" className={cx("flex gap-3 rounded-md px-1 py-2 hover:bg-sunk/70", past && "opacity-55")}>
                  <span className={cx("w-12 shrink-0 pt-px font-mono text-xs tnum", live ? "font-medium text-accent" : "text-ink-3")}>{fmtTime(e.start)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{e.title}</span>
                    <span className="block text-xs text-ink-3 tnum">
                      {fmtTime(e.start)} to {fmtTime(e.end)}
                      {e.location ? `, ${e.location}` : ""}
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
          {nowIndex === -1 && timed.length ? <NowLine /> : null}
        </ol>
      )}
    </Panel>
  );
}

function NowLine() {
  return (
    <div className="flex items-center gap-2 py-1" aria-label="Now">
      <span className="w-12 font-mono text-[11px] font-medium text-accent tnum">{fmtTime(new Date().toISOString())}</span>
      <span className="size-1.5 rounded-full bg-accent" />
      <span className="h-px flex-1 bg-accent/60" />
    </div>
  );
}

function InboxPanel({ connected }: { connected?: boolean }) {
  const [threads, setThreads] = useState<MailSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return;
    api<{ threads: MailSummary[] }>("/api/mail?folder=unread")
      .then((r) => setThreads(r.threads))
      .catch((e) => setError(e.message));
  }, [connected]);

  return (
    <Panel
      title={threads?.length ? `Unread, ${threads.length}${threads.length >= 30 ? "+" : ""}` : "Unread"}
      action={
        <Link href="/mail" className="text-xs font-medium text-ink-3 hover:text-ink">
          Inbox
        </Link>
      }
    >
      {connected === false ? (
        <ConnectGoogle what="email" />
      ) : error ? (
        <ErrorNote message={error} />
      ) : !threads ? (
        <Rows n={3} />
      ) : !threads.length ? (
        <p className="py-2 text-sm text-ink-3">Inbox zero. Nothing unread.</p>
      ) : (
        <ul className="-mx-1 grid">
          {threads.slice(0, 6).map((t) => (
            <li key={t.id}>
              <Link href={`/mail?thread=${t.id}`} className="block rounded-md px-1 py-2 hover:bg-sunk/70">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium text-ink">{t.from}</span>
                  <span className="ml-auto shrink-0 text-xs text-ink-3 tnum">{fmtTime(t.date, true)}</span>
                </span>
                <span className="block truncate text-[13px] text-ink-2">{t.subject}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
