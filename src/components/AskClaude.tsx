"use client";

import { useState } from "react";
import { ArrowUp, MoonStars, Sparkle, SunHorizon } from "@phosphor-icons/react";
import { MORNING, RECAP } from "@/lib/prompts";

/**
 * The home screen's search bar. It runs on the owner's Claude plan by opening
 * claude.ai with the question filled in; the LifeDash connector there gives
 * Claude the tasks, email and calendar. Briefs it saves show up on Today.
 */
const ask = (q: string) => window.open(`https://claude.ai/new?q=${encodeURIComponent(q)}`, "_blank", "noopener");

const withConnector = (q: string) => `Use the LifeDash connector to answer this about my tasks, email, calendar or business: ${q}`;

export function AskClaude() {
  const [q, setQ] = useState("");

  return (
    <section className="rounded-2xl border border-rule bg-page p-2 shadow-[0_1px_2px_rgb(11_13_12/0.04)]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!q.trim()) return;
          ask(withConnector(q.trim()));
          setQ("");
        }}
        className="flex items-center gap-2 pl-3"
      >
        <Sparkle size={18} weight="fill" className="shrink-0 text-accent-text" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask Claude anything about your day"
          aria-label="Ask Claude"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!q.trim()}
          aria-label="Ask"
          className="press inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink hover:bg-accent-hover disabled:bg-sunk disabled:text-ink-3"
        >
          <ArrowUp size={18} weight="bold" />
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-2 px-1 pt-2 pb-1">
        <Suggestion icon={<SunHorizon size={16} />} label="Morning brief" onClick={() => ask(MORNING)} />
        <Suggestion icon={<MoonStars size={16} />} label="Evening recap" onClick={() => ask(RECAP)} />
        <span className="ml-auto hidden pr-2 text-xs text-ink-3 sm:inline">Opens in Claude. Briefs land here.</span>
      </div>
    </section>
  );
}

function Suggestion({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press inline-flex h-9 items-center gap-2 rounded-full border border-rule-strong px-3.5 text-[13px] font-medium text-ink hover:border-accent hover:bg-accent-soft"
    >
      <span className="text-accent-text">{icon}</span>
      {label}
    </button>
  );
}
