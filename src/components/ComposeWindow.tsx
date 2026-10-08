"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown, CaretUp, PaperPlaneTilt, Trash, X } from "@phosphor-icons/react";
import { api } from "@/lib/supabase";
import { Spinner, cx, toast } from "./ui";

export type Draft = {
  to: string;
  cc?: string;
  subject: string;
  body?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
};

type SendAs = { email: string; name: string; signature: string };
let sendAsCache: Promise<SendAs | null> | null = null;
const loadSendAs = () => (sendAsCache ??= api<SendAs>("/api/mail/signature").catch(() => null));

/**
 * Gmail-style compose: a window docked bottom-right on desktop (full screen on
 * phones) with To / Cc / Bcc / Subject rows, the body, your Gmail signature
 * underneath, and Send. Ctrl/Cmd + Enter sends, Esc minimises.
 */
export function ComposeWindow({ draft, onClose, onSent }: { draft: Draft | null; onClose: () => void; onSent?: () => void }) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [useSig, setUseSig] = useState(true);
  const [me, setMe] = useState<SendAs | null>(null);
  const [min, setMin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!draft) return;
    setTo(draft.to);
    setCc(draft.cc ?? "");
    setBcc("");
    setShowCc(Boolean(draft.cc));
    setSubject(draft.subject);
    setBody(draft.body ?? "");
    setMin(false);
    setError(null);
    loadSendAs().then(setMe);
    requestAnimationFrame(() => (draft.to ? bodyRef.current : toRef.current)?.focus());
  }, [draft]);

  if (!draft) return null;
  const isReply = Boolean(draft.threadId);

  async function send() {
    if (!to.trim()) {
      setError("Add who it's going to.");
      toRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/mail", {
        method: "POST",
        body: JSON.stringify({
          action: "send",
          to,
          cc,
          bcc,
          subject,
          body,
          signature: useSig,
          threadId: draft!.threadId,
          inReplyTo: draft!.inReplyTo,
          references: draft!.references,
        }),
      });
      toast(isReply ? "Reply sent" : "Email sent");
      onSent?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  function discard() {
    if ((body.trim() || subject !== draft!.subject) && !confirm("Discard this email?")) return;
    onClose();
  }

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
    if (e.key === "Escape") setMin(true);
  };

  const row = "flex items-center gap-2 border-b border-rule px-4";
  const field = "h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-3 focus:outline-none md:text-sm";

  return (
    <div
      role="dialog"
      aria-label={isReply ? "Reply" : "New message"}
      onKeyDown={onKey}
      className={cx(
        "anim-pop fixed z-50 flex flex-col overflow-hidden bg-page shadow-float",
        "inset-0 md:inset-auto md:right-6 md:bottom-0 md:rounded-t-xl md:border md:border-b-0 md:border-rule",
        min ? "md:h-11 md:w-[300px] max-md:hidden" : "md:h-[min(620px,calc(100dvh-80px))] md:w-[560px]"
      )}
      style={{ transformOrigin: "bottom right" }}
    >
      <header
        className="flex h-11 shrink-0 cursor-pointer items-center gap-1 bg-ink pr-1.5 pl-4 text-page"
        onClick={() => min && setMin(false)}
      >
        <span className="flex-1 truncate text-sm font-medium">{subject.trim() || (isReply ? "Reply" : "New message")}</span>
        <button
          type="button"
          aria-label={min ? "Expand" : "Minimise"}
          onClick={(e) => {
            e.stopPropagation();
            setMin(!min);
          }}
          className="hidden size-8 items-center justify-center rounded-md hover:bg-page/15 md:inline-flex"
        >
          {min ? <CaretUp size={15} /> : <CaretDown size={15} />}
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={(e) => {
            e.stopPropagation();
            discard();
          }}
          className="inline-flex size-8 items-center justify-center rounded-md hover:bg-page/15"
        >
          <X size={16} />
        </button>
      </header>

      {!min ? (
        <>
          <div className={row}>
            <label htmlFor="cw-to" className="w-12 shrink-0 text-sm text-ink-3">
              To
            </label>
            <input ref={toRef} id="cw-to" value={to} onChange={(e) => setTo(e.target.value)} className={field} inputMode="email" autoComplete="email" />
            {!showCc ? (
              <button type="button" onClick={() => setShowCc(true)} className="shrink-0 text-[13px] text-ink-3 hover:text-ink hover:underline">
                Cc Bcc
              </button>
            ) : null}
          </div>
          {showCc ? (
            <>
              <div className={row}>
                <label htmlFor="cw-cc" className="w-12 shrink-0 text-sm text-ink-3">
                  Cc
                </label>
                <input id="cw-cc" value={cc} onChange={(e) => setCc(e.target.value)} className={field} inputMode="email" />
              </div>
              <div className={row}>
                <label htmlFor="cw-bcc" className="w-12 shrink-0 text-sm text-ink-3">
                  Bcc
                </label>
                <input id="cw-bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} className={field} inputMode="email" />
              </div>
            </>
          ) : null}
          <div className={row}>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" className={field} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-label="Message"
              rows={8}
              className="block min-h-[180px] w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink placeholder:text-ink-3 focus:outline-none md:text-sm"
              style={{ height: Math.max(180, body.split("\n").length * 22 + 40) }}
            />
            {useSig && me?.signature ? <Signature html={me.signature} /> : null}
            {useSig && me && !me.signature ? (
              <p className="mt-2 text-xs text-ink-3">No signature set in Gmail. Add one in Gmail settings and it shows up here.</p>
            ) : null}
          </div>

          {error ? <p className="mx-4 mb-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p> : null}

          <footer className="flex shrink-0 items-center gap-3 border-t border-rule px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className="press inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60"
            >
              {busy ? <Spinner /> : <PaperPlaneTilt size={16} weight="fill" />}
              Send
            </button>
            <label className="flex items-center gap-2 text-[13px] text-ink-3">
              <input type="checkbox" checked={useSig} onChange={(e) => setUseSig(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Signature
            </label>
            <span className="hidden text-xs text-ink-3 md:inline">Ctrl + Enter</span>
            <button type="button" onClick={discard} aria-label="Discard" title="Discard" className="press ml-auto inline-flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-danger-soft hover:text-danger">
              <Trash size={17} />
            </button>
          </footer>
        </>
      ) : null}
    </div>
  );
}

/** Your Gmail signature exactly as recipients see it, in a sandboxed frame. */
function Signature({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(60);
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><base target="_blank"><style>body{margin:0;font:13px/1.5 system-ui,sans-serif;color:#3d4542;background:#fff}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
  return (
    <div className="mt-3 border-t border-dashed border-rule pt-3">
      <iframe
        ref={ref}
        title="Your signature"
        sandbox="allow-same-origin"
        srcDoc={doc}
        onLoad={() => {
          const b = ref.current?.contentDocument?.body;
          if (b) setH(Math.min(400, b.scrollHeight + 4));
        }}
        className="w-full rounded-md bg-white"
        style={{ height: h }}
      />
    </div>
  );
}
