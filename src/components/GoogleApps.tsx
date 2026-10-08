"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarBlank, DotsNine, EnvelopeSimple, FileDoc, GoogleDriveLogo, Plus, PresentationChart, Table } from "@phosphor-icons/react";
import { useStore } from "@/lib/store";
import { cx } from "./ui";

/**
 * One-tap launcher into the owner's Google account. Every link carries
 * authuser=<email> so it opens the connected account even when the browser
 * is signed into several.
 */
function links(email: string | null) {
  const u = email ? `authuser=${encodeURIComponent(email)}` : "";
  return {
    apps: [
      { label: "Gmail", href: `https://mail.google.com/mail/?${u}`, icon: EnvelopeSimple, color: "var(--tab-rose)" },
      { label: "Calendar", href: `https://calendar.google.com/calendar/r?${u}`, icon: CalendarBlank, color: "var(--tab-ink)" },
      { label: "Drive", href: `https://drive.google.com/drive/my-drive?${u}`, icon: GoogleDriveLogo, color: "var(--tab-ochre)" },
      { label: "Docs", href: `https://docs.google.com/document/u/0/?${u}`, icon: FileDoc, color: "var(--tab-ink)" },
      { label: "Sheets", href: `https://docs.google.com/spreadsheets/u/0/?${u}`, icon: Table, color: "var(--tab-moss)" },
      { label: "Slides", href: `https://docs.google.com/presentation/u/0/?${u}`, icon: PresentationChart, color: "var(--tab-ochre)" },
    ],
    create: [
      { label: "New doc", href: `https://docs.google.com/document/create?${u}` },
      { label: "New sheet", href: `https://docs.google.com/spreadsheets/create?${u}` },
    ],
  };
}

export function GoogleApps({ variant }: { variant: "sidebar" | "icon" }) {
  const { google } = useStore();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { apps, create } = links(google?.email ?? null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      {variant === "sidebar" ? (
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={cx("flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm", open ? "bg-page text-ink shadow-[0_0_0_1px_var(--rule)]" : "text-ink-2 hover:bg-sunk hover:text-ink")}
        >
          <DotsNine size={18} weight="bold" />
          Google apps
        </button>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label="Google apps"
          className="press inline-flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-sunk"
        >
          <DotsNine size={20} weight="bold" />
        </button>
      )}

      {open ? (
        <div
          className={cx(
            "anim-pop absolute z-40 w-[288px] rounded-xl border border-rule bg-page p-3 shadow-float",
            variant === "sidebar" ? "bottom-full left-0 mb-2 origin-bottom-left" : "right-0 top-full mt-1"
          )}
        >
          <p className="truncate px-1 pb-2 text-xs text-ink-3">{google?.email ?? "Opens your default Google account"}</p>
          <div className="grid grid-cols-3 gap-1">
            {apps.map(({ label, href, icon: Icon, color }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="press flex flex-col items-center gap-1.5 rounded-lg py-3 text-xs text-ink-2 hover:bg-sunk hover:text-ink"
              >
                <Icon size={22} style={{ color }} />
                {label}
              </a>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-rule pt-3">
            {create.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="press inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rule-strong text-[13px] font-medium text-ink hover:bg-sunk"
              >
                <Plus size={13} weight="bold" />
                {label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
