"use client";

import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { X } from "@phosphor-icons/react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  busy?: boolean;
};

export function Button({ variant = "secondary", size = "md", busy, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={cx(
        "press inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium select-none",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-accent text-accent-ink hover:bg-accent-hover",
        variant === "secondary" && "border border-rule-strong bg-page text-ink hover:bg-sunk",
        variant === "ghost" && "text-ink-2 hover:bg-sunk hover:text-ink",
        variant === "danger" && "border border-rule-strong bg-page text-danger hover:bg-danger-soft hover:border-transparent",
        className
      )}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx("press inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:bg-sunk hover:text-ink disabled:opacity-40", className)}
    >
      {children}
    </button>
  );
}

export function Spinner() {
  return <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />;
}

const fieldBase =
  "w-full rounded-lg border border-rule-strong bg-page px-3 text-[15px] md:text-sm text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 hover:border-ink-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent-soft";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(fieldBase, "h-9", className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(fieldBase, "py-2 leading-relaxed", className)} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(fieldBase, "h-9 pr-8", className)}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

/** Round task checkbox. The tick draws itself on completion. */
export function Tick({ on, onChange, label, color, size = 20 }: { on: boolean; onChange: () => void; label: string; color?: string; size?: number }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="press group/tick relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size + 8, height: size + 8 }}
    >
      <span
        className="tick inline-flex items-center justify-center rounded-full border-[1.5px] transition-[background-color,border-color] duration-200"
        data-on={on}
        style={{
          width: size,
          height: size,
          borderColor: on ? (color ?? "var(--accent)") : "var(--rule-strong)",
          background: on ? (color ?? "var(--accent)") : "transparent",
        }}
      >
        <svg viewBox="0 0 16 16" width={size * 0.6} height={size * 0.6} fill="none" aria-hidden>
          <path d="M3.5 8.5l3 3 6-7" stroke="var(--page)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

/** Right-hand sheet on desktop, bottom sheet on phones. Escape and backdrop close it. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("input, textarea, select, button[data-autofocus]")?.focus());
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end md:items-stretch" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-ink/20 dark:bg-black/50" onClick={onClose} />
      <div
        ref={panel}
        className="anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-rule bg-page shadow-float md:m-2 md:max-h-none md:w-[420px] md:rounded-xl"
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex items-center gap-2 border-t border-rule px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-rule-strong px-5 py-6">
      <span className="text-ink-3">{icon}</span>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-[46ch] text-[13px] leading-relaxed text-ink-3">{body}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
      <span className="flex-1">{message}</span>
      {onRetry ? (
        <button className="font-medium underline" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Rows({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton size-5 rounded-full" />
          <div className="skeleton h-3.5" style={{ width: `${70 - i * 9}%` }} />
        </div>
      ))}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-rule bg-page", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2 md:px-5">
          <h2 className="text-[13px] font-semibold text-ink-2">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={title ? "px-4 pb-4 md:px-5" : "p-4 md:p-5"}>{children}</div>
    </section>
  );
}

/** Small transient confirmation. One at a time. */
let toastFn: ((msg: string) => void) | null = null;
export const toast = (msg: string) => toastFn?.(msg);

export function Toaster() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    toastFn = (msg) => {
      const el = ref.current;
      if (!el) return;
      el.textContent = msg;
      el.dataset.show = "true";
      clearTimeout(timer);
      timer = setTimeout(() => (el.dataset.show = "false"), 2400);
    };
    return () => {
      toastFn = null;
    };
  }, []);
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      data-show="false"
      className="pointer-events-none fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-medium text-page opacity-0 shadow-float transition-[opacity,transform] duration-200 data-[show=true]:opacity-100 data-[show=false]:translate-y-1 md:bottom-6"
    />
  );
}
