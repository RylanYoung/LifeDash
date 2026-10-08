"use client";

import { Briefcase, User } from "@phosphor-icons/react";
import { cx } from "./ui";
import type { ListKind } from "@/lib/types";

export function KindBadge({ kind }: { kind: ListKind }) {
  return (
    <span className={cx("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs", kind === "business" ? "bg-accent-soft text-ink" : "bg-sunk text-ink-2")}>
      {kind === "business" ? <Briefcase size={12} /> : <User size={12} />}
      {kind === "business" ? "Business" : "Personal"}
    </span>
  );
}

export function KindPicker({ value, onChange }: { value: ListKind; onChange: (k: ListKind) => void }) {
  const opts = [
    { k: "business" as const, icon: Briefcase, label: "Business", body: "Claude reads it as context" },
    { k: "personal" as const, icon: User, label: "Personal", body: "Kept out of context" },
  ];
  return (
    <div role="radiogroup" aria-label="List type" className="grid grid-cols-2 gap-2">
      {opts.map(({ k, icon: Icon, label, body }) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={cx(
            "press flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left",
            value === k ? "border-accent bg-accent-soft" : "border-rule-strong hover:bg-sunk"
          )}
        >
          <Icon size={16} className={cx("mt-0.5", value === k ? "text-accent-text" : "text-ink-3")} />
          <span>
            <span className="block text-sm font-medium">{label}</span>
            <span className="block text-xs text-ink-3">{body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
