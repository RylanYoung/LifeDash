"use client";

import { useEffect, useState } from "react";
import { Check, Copy, GoogleLogo, Plus, Trash, X } from "@phosphor-icons/react";
import { PageHeader } from "@/components/Shell";
import { Button, ErrorNote, IconButton, Input, Panel, Textarea, toast } from "@/components/ui";
import { addFact, deleteFact, deleteNote, loadFacts, loadNotes, saveNote } from "@/lib/data";
import { useStore } from "@/lib/store";
import { api, supabase } from "@/lib/supabase";
import { MORNING, RECAP } from "@/lib/prompts";
import type { ContextFact, ContextNote } from "@/lib/types";

export default function SettingsPage() {
  return (
    <>
      <title>Settings · LifeDash</title>
      <PageHeader title="Settings" />
      <div className="grid max-w-3xl gap-4 px-4 pb-16 md:px-8">
        <GoogleSection />
        <ClaudeSection />
        <ContextSection />
        <AccountSection />
      </div>
    </>
  );
}

function GoogleSection() {
  const { google, refreshGoogle } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const state = crypto.randomUUID();
      sessionStorage.setItem("google-oauth-state", state);
      const { url } = await api<{ url: string }>(`/api/google/auth-url?state=${state}`);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Google sign-in");
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Google? Email and calendar stop showing until you connect again.")) return;
    setBusy(true);
    try {
      await api("/api/google/disconnect", { method: "POST" });
      await refreshGoogle();
      toast("Google disconnected");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="google" className="scroll-mt-6">
      <Panel title="Google account">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-sunk">
            <GoogleLogo size={18} weight="bold" />
          </span>
          <div className="min-w-0 flex-1">
            {google?.connected ? (
              <>
                <p className="truncate text-sm font-medium">{google.email}</p>
                <p className="text-[13px] text-ink-3">Gmail and Calendar connected{google.timeZone ? `, ${google.timeZone}` : ""}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Not connected</p>
                <p className="text-[13px] text-ink-3">Connect once for Gmail and Google Calendar.</p>
              </>
            )}
          </div>
          {google?.connected ? (
            <Button variant="danger" size="sm" busy={busy} onClick={disconnect}>
              Disconnect
            </Button>
          ) : (
            <Button variant="primary" busy={busy} onClick={connect} disabled={!google}>
              Connect Google
            </Button>
          )}
        </div>
        {error ? (
          <div className="mt-3">
            <ErrorNote message={error} />
          </div>
        ) : null}
      </Panel>
    </section>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? "Copied" : label}
    </Button>
  );
}

function ClaudeSection() {
  const [link, setLink] = useState<{ url: string; ownerSet: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ url: string; ownerSet: boolean }>("/api/mcp-link")
      .then(setLink)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <section id="claude" className="scroll-mt-6">
      <Panel title="Claude">
        <div className="grid gap-5">
          <div>
            <p className="text-sm font-medium">1. Add LifeDash to Claude</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
              In Claude, open Settings, then Connectors, then Add custom connector. Paste this link. Claude can then add and tick off tasks, check your calendar and
              read your email in any chat. Treat the link like a password.
            </p>
            {error ? (
              <div className="mt-2">
                <ErrorNote message={error} />
              </div>
            ) : link ? (
              <>
                <div className="mt-2.5 flex gap-2">
                  <Input readOnly value={link.url.replace(/\/api\/mcp\/(.{4}).*/, "/api/mcp/$1••••••••")} aria-label="Connector link" className="font-mono text-xs" />
                  <CopyButton text={link.url} />
                </div>
                {!link.ownerSet ? (
                  <p className="mt-2 text-[13px] text-danger">Set OWNER_EMAIL and OWNER_PASSWORD on the server so the connector can sign in as you.</p>
                ) : null}
              </>
            ) : (
              <div className="skeleton mt-2.5 h-9 w-full" />
            )}
          </div>

          <div className="border-t border-rule pt-5">
            <p className="text-sm font-medium">2. Schedule your brief and recap</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
              These run on your Claude Pro plan, so there is no API cost. In Claude Code, type <code className="font-mono text-xs text-ink-2">/schedule</code>, choose a
              time (for example 7:00 on weekdays), and paste the prompt. Do the same for the recap at 18:00. Each one lands on your Today page.
            </p>
            <div className="mt-3 grid gap-3">
              <Prompt title="Morning brief" text={MORNING} />
              <Prompt title="Evening recap" text={RECAP} />
            </div>
          </div>
        </div>
      </Panel>
    </section>
  );
}

function Prompt({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-rule bg-sunk/50">
      <div className="flex items-center justify-between px-3.5 pt-2.5">
        <span className="text-[13px] font-medium">{title}</span>
        <CopyButton text={text} label="Copy prompt" />
      </div>
      <pre className="overflow-x-auto px-3.5 pt-2 pb-3 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-ink-2">{text}</pre>
    </div>
  );
}

const STARTERS = ["Offer", "Website", "Ideal client", "Goals this quarter", "Pricing"];

function ContextSection() {
  const [notes, setNotes] = useState<ContextNote[] | null>(null);
  const [facts, setFacts] = useState<ContextFact[] | null>(null);
  const [fact, setFact] = useState("");

  useEffect(() => {
    loadNotes().then(setNotes);
    loadFacts().then(setFacts);
  }, []);

  async function addNote(title: string) {
    const n = await saveNote({ title, body: "", position: (notes?.at(-1)?.position ?? 0) + 1 });
    setNotes([...(notes ?? []), n]);
  }

  const unused = STARTERS.filter((s) => !notes?.some((n) => n.title.toLowerCase() === s.toLowerCase()));

  return (
    <section id="context" className="scroll-mt-6">
      <Panel title="Business context">
        <p className="text-[13px] leading-relaxed text-ink-3">
          What Claude knows about your business: these notes, the facts below, and every list marked Business. Personal lists are never included.
        </p>

        <div className="mt-4 grid gap-3">
          {notes?.map((n) => (
            <NoteEditor
              key={n.id}
              note={n}
              onDelete={async () => {
                if (!confirm(`Delete the "${n.title}" note?`)) return;
                await deleteNote(n.id);
                setNotes(notes.filter((x) => x.id !== n.id));
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {unused.map((s) => (
            <button key={s} onClick={() => addNote(s)} className="press inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-rule-strong px-3 text-[13px] text-ink-2 hover:bg-sunk">
              <Plus size={12} />
              {s}
            </button>
          ))}
          <button
            onClick={() => {
              const t = prompt("Name this note");
              if (t?.trim()) addNote(t.trim());
            }}
            className="press inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] text-ink-3 hover:bg-sunk hover:text-ink"
          >
            <Plus size={12} />
            Other
          </button>
        </div>

        <div className="mt-6 border-t border-rule pt-4">
          <p className="text-sm font-medium">Facts learned</p>
          <p className="mt-0.5 text-[13px] text-ink-3">Claude adds these from your email during the morning brief. Remove anything that is wrong.</p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!fact.trim()) return;
              const f = await addFact(fact.trim());
              setFacts([f, ...(facts ?? [])]);
              setFact("");
            }}
          >
            <Input value={fact} onChange={(e) => setFact(e.target.value)} placeholder="Add a fact yourself" aria-label="New fact" />
            <Button type="submit" disabled={!fact.trim()}>
              Add
            </Button>
          </form>
          <ul className="mt-2 grid">
            {facts?.map((f) => (
              <li key={f.id} className="group flex items-start gap-2 border-b border-rule py-2 last:border-0">
                <span className="flex-1 text-sm text-ink-2">
                  {f.fact}
                  <span className="ml-2 text-xs text-ink-3">{f.source}</span>
                </span>
                <IconButton
                  label="Remove fact"
                  className="hover-only size-7 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={async () => {
                    await deleteFact(f.id);
                    setFacts(facts.filter((x) => x.id !== f.id));
                  }}
                >
                  <X size={13} />
                </IconButton>
              </li>
            ))}
            {facts && !facts.length ? <li className="py-2 text-[13px] text-ink-3">Nothing learned yet.</li> : null}
          </ul>
        </div>
      </Panel>
    </section>
  );
}

function NoteEditor({ note, onDelete }: { note: ContextNote; onDelete: () => void }) {
  const [body, setBody] = useState(note.body);
  const [saved, setSaved] = useState(note.body);
  return (
    <div className="rounded-lg border border-rule">
      <div className="flex items-center justify-between px-3.5 pt-2.5">
        <span className="text-[13px] font-medium">{note.title}</span>
        <span className="flex items-center gap-1">
          {body !== saved ? <span className="text-xs text-ink-3">Unsaved</span> : null}
          <IconButton label={`Delete ${note.title}`} onClick={onDelete} className="size-7">
            <Trash size={13} />
          </IconButton>
        </span>
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={async () => {
          if (body === saved) return;
          await saveNote({ id: note.id, title: note.title, body, position: note.position });
          setSaved(body);
          toast(`${note.title} saved`);
        }}
        rows={Math.min(10, Math.max(3, body.split("\n").length + 1))}
        placeholder={`Your ${note.title.toLowerCase()}, in your own words`}
        aria-label={note.title}
        className="border-0 bg-transparent hover:border-0 focus:ring-0"
      />
    </div>
  );
}

function AccountSection() {
  const { session } = useStore();
  return (
    <Panel title="Account">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">{session?.user.email}</p>
        <Button variant="secondary" size="sm" onClick={() => supabase().auth.signOut()}>
          Sign out
        </Button>
      </div>
    </Panel>
  );
}
