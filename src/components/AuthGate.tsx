"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button, ErrorNote, Field, Input } from "./ui";

/** Email + password. One owner; "Create account" is there for the very first sign-in. */
export function AuthGate() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const sb = supabase();
      if (mode === "up") {
        // The confirmation link brings you back to wherever LifeDash is running.
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setNote("Check your inbox and click the confirmation link. It signs you straight in. You only do this once.");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(/Invalid login/i.test(msg) ? "That email and password don't match." : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={submit} className="anim-pop w-full max-w-[360px] rounded-2xl border border-rule bg-page p-6 shadow-float">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">{mode === "in" ? "Open your LifeDash" : "Create your LifeDash"}</h1>
        <p className="mt-1 text-sm text-ink-3">Tasks, calendar and email in one place.</p>
        <div className="mt-6 grid gap-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error ? <ErrorNote message={error} /> : null}
          {note ? <p className="rounded-lg bg-accent-soft px-3.5 py-2.5 text-[13px] text-ink">{note}</p> : null}
          <Button type="submit" variant="primary" busy={busy} className="w-full">
            {mode === "in" ? "Sign in" : "Create account"}
          </Button>
        </div>
        <p className="mt-5 text-center text-[13px] text-ink-3">
          {mode === "in" ? "First time here?" : "Already set up?"}{" "}
          <button type="button" className="font-medium text-accent hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "Create account" : "Sign in"}
          </button>
        </p>
      </form>
    </div>
  );
}
