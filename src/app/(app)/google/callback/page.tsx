"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ErrorNote, Spinner } from "@/components/ui";
import { useStore } from "@/lib/store";
import { api } from "@/lib/supabase";

/** Google sends the user back here with a one-time code; trade it for tokens server-side. */
export default function GoogleCallback() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}

function Callback() {
  const params = useSearchParams();
  const router = useRouter();
  const { refreshGoogle } = useStore();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = params.get("code");
    const state = params.get("state");
    const expected = sessionStorage.getItem("google-oauth-state");
    sessionStorage.removeItem("google-oauth-state");
    if (params.get("error")) return setError(`Google said: ${params.get("error")}`);
    if (!code || !state || state !== expected) return setError("This sign-in link is invalid or expired. Start again from Settings.");
    api("/api/google/exchange", { method: "POST", body: JSON.stringify({ code }) })
      .then(async () => {
        await refreshGoogle();
        router.replace("/");
      })
      .catch((e) => setError(e.message));
  }, [params, router, refreshGoogle]);

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      {error ? (
        <div className="grid gap-3">
          <ErrorNote message={error} />
          <a href="/settings#google" className="text-sm font-medium text-accent-text">
            Back to Settings
          </a>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <Spinner /> Connecting Google
        </p>
      )}
    </div>
  );
}
