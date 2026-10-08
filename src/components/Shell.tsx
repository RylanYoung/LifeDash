"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CalendarBlank, CheckCircle, EnvelopeSimple, GearSix, Plus, SunHorizon } from "@phosphor-icons/react";
import { useStore } from "@/lib/store";
import { isConfigured } from "@/lib/supabase";
import { AuthGate } from "./AuthGate";
import { QuickAdd } from "./QuickAdd";
import { Toaster, cx } from "./ui";
import { ListDot } from "./ListDot";
import { GoogleApps } from "./GoogleApps";

const NAV = [
  { href: "/", label: "Today", icon: SunHorizon },
  { href: "/tasks", label: "Tasks", icon: CheckCircle },
  { href: "/calendar", label: "Calendar", icon: CalendarBlank },
  { href: "/mail", label: "Email", icon: EnvelopeSimple },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function Shell({ children }: { children: ReactNode }) {
  const { session, ready, lists, openQuickAdd } = useStore();
  const path = usePathname();

  // N anywhere (outside a field) opens quick add.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openQuickAdd();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openQuickAdd]);

  if (!isConfigured) return <NotConfigured />;
  if (!ready) return <div className="min-h-dvh" />;
  if (!session) return <AuthGate />;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[236px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-rule bg-rail md:flex">
        <div className="flex items-center gap-2 px-5 pt-5 pb-4">
          <Mark />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Daybook</span>
        </div>

        <div className="px-3 pb-3">
          <button
            onClick={() => openQuickAdd()}
            className="press flex h-9 w-full items-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink hover:bg-accent-hover"
          >
            <Plus size={15} weight="bold" />
            New task
            <kbd className="ml-auto rounded border border-current/30 px-1.5 font-mono text-[11px] leading-[18px] opacity-80">N</kbd>
          </button>
        </div>

        <nav className="grid gap-0.5 px-3" aria-label="Main">
          {NAV.map(({ href, label, icon: Icon }) => {
            const on = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-150",
                  on ? "bg-page font-medium text-ink shadow-[0_0_0_1px_var(--rule)]" : "text-ink-2 hover:bg-sunk hover:text-ink"
                )}
              >
                <Icon size={18} weight={on ? "fill" : "regular"} className={on ? "text-accent" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 flex items-center justify-between px-5 pb-1.5">
          <span className="text-xs font-medium text-ink-3">Lists</span>
          <Link href="/tasks?new=1" className="text-ink-3 hover:text-ink" aria-label="New list" title="New list">
            <Plus size={14} />
          </Link>
        </div>
        <nav className="grid min-h-0 gap-0.5 overflow-y-auto px-3" aria-label="Lists">
          {lists.map((l) => {
            const on = path === `/tasks/${l.id}`;
            return (
              <Link
                key={l.id}
                href={`/tasks/${l.id}`}
                className={cx(
                  "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150",
                  on ? "bg-page font-medium text-ink shadow-[0_0_0_1px_var(--rule)]" : "text-ink-2 hover:bg-sunk hover:text-ink"
                )}
              >
                <ListDot color={l.color} />
                <span className="truncate">{l.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto grid gap-0.5 border-t border-rule p-3">
          <GoogleApps variant="sidebar" />
          <Link
            href="/settings"
            className={cx(
              "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm",
              path.startsWith("/settings") ? "bg-page font-medium text-ink shadow-[0_0_0_1px_var(--rule)]" : "text-ink-2 hover:bg-sunk hover:text-ink"
            )}
          >
            <GearSix size={18} />
            Settings
          </Link>
        </div>
      </aside>

      <main className="min-w-0 pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0">{children}</main>

      <MobileBar path={path} />
      <QuickAdd />
      <Toaster />
    </div>
  );
}

function MobileBar({ path }: { path: string }) {
  const { openQuickAdd } = useStore();
  const items = [...NAV.slice(0, 2), null, ...NAV.slice(2)];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-rule bg-page/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      {items.map((item) =>
        item ? (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(path, item.href) ? "page" : undefined}
            className={cx("flex h-[60px] flex-col items-center justify-center gap-1 text-[11px]", isActive(path, item.href) ? "text-accent" : "text-ink-3")}
          >
            <item.icon size={22} weight={isActive(path, item.href) ? "fill" : "regular"} />
            {item.label}
          </Link>
        ) : (
          <div key="add" className="flex items-center justify-center">
            <button
              onClick={() => openQuickAdd()}
              aria-label="New task"
              className="press flex size-11 items-center justify-center rounded-full bg-accent text-accent-ink shadow-float"
            >
              <Plus size={20} weight="bold" />
            </button>
          </div>
        )
      )}
    </nav>
  );
}

/** Mobile page header with a Settings shortcut (desktop has the sidebar). */
export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 px-4 pt-6 pb-4 md:px-8 md:pt-8 md:pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink md:text-[26px]">{title}</h1>
        {sub ? <div className="mt-1 text-sm text-ink-3">{sub}</div> : null}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <div className="md:hidden">
          <GoogleApps variant="icon" />
        </div>
        <Link href="/settings" className="press inline-flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-sunk md:hidden" aria-label="Settings">
          <GearSix size={20} />
        </Link>
      </div>
    </header>
  );
}

function Mark() {
  // A planner page with a ribbon marker.
  return (
    <span className="relative inline-flex h-[22px] w-[18px] rounded-[4px] border-[1.5px] border-ink bg-page" aria-hidden>
      <span className="absolute -bottom-[3px] right-[3px] h-[9px] w-[4px] bg-accent [clip-path:polygon(0_0,100%_0,100%_100%,50%_70%,0_100%)]" />
    </span>
  );
}

function NotConfigured() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <div className="mx-auto max-w-lg px-6 py-20">
      <h1 className="text-xl font-semibold">Daybook needs its Supabase keys</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Add <code className="font-mono text-[13px]">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono text-[13px]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
        <code className="font-mono text-[13px]">.env.local</code> (or your Vercel project settings), then restart. {origin ? `This app is running at ${origin}.` : ""}
      </p>
    </div>
  );
}
