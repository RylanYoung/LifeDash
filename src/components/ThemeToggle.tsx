"use client";

import { useEffect, useState } from "react";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { cx } from "./ui";

type Choice = "light" | "dark" | "system";
const KEY = "lifedash.theme";

function read(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(choice: Choice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {}
  const w = window as Window & { __applyTheme?: () => void };
  if (w.__applyTheme) w.__applyTheme();
  else {
    const dark = choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }
}

const OPTIONS = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "Auto", icon: Desktop },
];

/** Light / Dark / Auto. Auto follows the phone or computer setting. */
export function ThemeToggle({ withLabels = false }: { withLabels?: boolean }) {
  const [choice, setChoice] = useState<Choice>("system");
  useEffect(() => setChoice(read()), []);

  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-lg bg-sunk p-0.5">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={label}
          title={label}
          onClick={() => {
            setChoice(value);
            apply(value);
          }}
          className={cx(
            "press inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs",
            choice === value ? "bg-page font-medium text-ink shadow-[0_0_0_1px_var(--rule)]" : "text-ink-3 hover:text-ink"
          )}
        >
          <Icon size={14} weight={choice === value ? "fill" : "regular"} />
          {withLabels ? label : null}
        </button>
      ))}
    </div>
  );
}
