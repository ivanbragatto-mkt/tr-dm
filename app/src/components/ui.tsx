"use client";
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Loader2, X } from "lucide-react";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "dark" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: "bg-signature text-on-signature hover:ring-2 hover:ring-signature hover:ring-offset-2",
    secondary: "text-accent border-[1.5px] border-accent hover:bg-accent-soft",
    dark: "bg-accent text-on-accent hover:ring-2 hover:ring-accent hover:ring-offset-2",
    ghost: "text-text hover:bg-surface",
    danger: "bg-danger text-white hover:opacity-90",
  }[variant];
  const s = { sm: "h-10 px-[18px] text-sm", md: "h-12 px-6 text-base", lg: "h-12 px-7 text-base" }[size];
  return (
    <button
      {...p}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed",
        v,
        s,
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Status pill: a dot and a label. success = green (live), danger = red (paused), muted = grey (draft), warning = amber. */
export function Badge({ tone = "muted", children }: { tone?: "muted" | "success" | "warning" | "info" | "danger"; children: ReactNode }) {
  const t = {
    success: ["bg-success-soft text-success", "bg-success"],
    muted: ["bg-canvas text-text-muted", "bg-text-muted"],
    warning: ["bg-warning-soft text-warning", "bg-warning"],
    info: ["bg-info-soft text-info", "bg-info"],
    danger: ["bg-danger-soft text-danger", "bg-danger"],
  }[tone];
  return (
    <span className={cx("inline-flex items-center gap-2 whitespace-nowrap rounded-pill px-3 py-1 text-sm font-medium", t[0])}>
      <span aria-hidden className={cx("h-2 w-2 shrink-0 rounded-pill", t[1])} />
      {children}
    </span>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-base">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-[30px] w-[52px] shrink-0 rounded-pill transition-colors duration-fast disabled:opacity-50",
          checked ? "bg-accent" : "bg-border-input",
        )}
      >
        <span className={cx("absolute top-1 h-[22px] w-[22px] rounded-pill bg-white transition-all duration-fast", checked ? "left-[26px]" : "left-1")} />
      </button>
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-accent">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const inputBase =
  "w-full border-[1.5px] border-accent bg-bg text-base text-text placeholder:text-text-muted focus-visible:outline-accent disabled:opacity-60";
export function Input({ invalid, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...p} aria-invalid={invalid || undefined} className={cx(inputBase, "h-12 rounded-pill px-5", invalid && "border-danger", className)} />;
}
export function Textarea({ invalid, className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea {...p} aria-invalid={invalid || undefined} className={cx(inputBase, "rounded-[20px] px-[18px] py-3.5 leading-[1.55]", invalid && "border-danger", className)} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-xl bg-surface-raised", className)}>{children}</div>;
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div aria-hidden className="grid h-14 w-14 place-items-center rounded-pill bg-accent-soft text-accent text-2xl font-bold">
        ·
      </div>
      <h2 className="text-xl font-medium text-accent">{title}</h2>
      <p className="max-w-sm text-sm text-text-muted">{text}</p>
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, closeLabel }: { open: boolean; onClose: () => void; title: string; children: ReactNode; closeLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-bg shadow-pop outline-none">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id={id} className="text-xl font-medium text-accent">
            {title}
          </h2>
          <button onClick={onClose} aria-label={closeLabel} className="grid h-8 w-8 place-items-center rounded-md hover:bg-surface">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; dot?: boolean }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex gap-1 rounded-pill bg-surface-raised p-1.5">
      {items.map((i) => (
        <button
          key={i.value}
          role="tab"
          aria-selected={value === i.value}
          onClick={() => onChange(i.value)}
          className={cx(
            "relative h-10 rounded-pill px-5 text-[15px] font-medium transition-colors duration-fast",
            value === i.value ? "bg-accent text-on-accent" : "text-accent hover:bg-accent-soft",
          )}
        >
          {i.label}
          {i.dot && <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-pill bg-warning" />}
        </button>
      ))}
    </div>
  );
}

export function timeAgo(t: number, tr: (k: "common.now" | "common.minutes", v?: Record<string, number>) => string, lang: string) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return tr("common.now");
  if (m < 60) return tr("common.minutes", { n: m });
  return new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(t);
}

/** The automation's path: dots joined by a line, as in the design. */
export function FlowPath({ steps, small, nowrap, dots }: { steps: string[]; small?: boolean; nowrap?: boolean; dots?: boolean }) {
  if (dots)
    return (
      <ol aria-label={steps.join(" → ")} title={steps.join(" → ")} className="flex items-center">
        {steps.map((s, i) => (
          <li key={i} className="inline-flex items-center">
            {i > 0 && <span aria-hidden className="h-0.5 w-3.5 bg-accent" />}
            <span aria-hidden className="box-border h-2.5 w-2.5 rounded-pill border-[2.5px] border-accent bg-surface-raised" />
            <span className="sr-only">{s}</span>
          </li>
        ))}
      </ol>
    );
  return (
    <ol className={cx("flex items-center gap-x-2.5 gap-y-1.5", nowrap ? "flex-nowrap" : "flex-wrap", small ? "text-sm" : "text-[15px]")}>
      {steps.map((s, i) => (
        <li key={i} className="inline-flex items-center gap-2.5">
          {i > 0 && <span aria-hidden className={cx("h-0.5 rounded-sm bg-accent", small ? "w-5" : "w-7")} />}
          <span aria-hidden className={cx("box-border rounded-pill border-[2.5px] border-accent bg-surface-raised", small ? "h-2.5 w-2.5" : "h-3 w-3")} />
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}
