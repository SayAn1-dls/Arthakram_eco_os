import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { colorFor, humanize, initials } from "@/lib/format";

/* ───────── Buttons ───────── */

const variants = {
  primary: "bg-brand text-white hover:bg-brand-deep shadow-[0_1px_0_rgba(0,0,0,.08)]",
  ink: "bg-ink text-white hover:bg-ink-2",
  outline: "border border-ink/15 bg-card text-ink hover:border-brand hover:text-brand-deep",
  ghost: "text-ink-2 hover:bg-paper-2",
  danger: "border border-bad/30 bg-card text-bad hover:bg-bad hover:text-white",
} as const;
const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" } as const;

export type ButtonStyle = { variant?: keyof typeof variants; size?: keyof typeof sizes };

export function buttonClass({ variant = "primary", size = "md" }: ButtonStyle = {}, extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link {...props} className={buttonClass({ variant, size }, className)} />;
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & ButtonStyle) {
  return <button {...props} className={buttonClass({ variant, size }, className)} />;
}

/* ───────── Typography & layout ───────── */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("eyebrow", className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <Eyebrow className="mb-2 text-brand-deep">{eyebrow}</Eyebrow>}
          <h1 className="text-[1.9rem] font-extrabold leading-tight tracking-tight text-ink sm:text-[2.2rem]">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-[15px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
      <hr className="rule mt-6" />
    </header>
  );
}

export function Card({
  children,
  className,
  title,
  eyebrow,
  actions,
  padded = true,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={cn("rounded-[var(--radius-card)] border border-line bg-card", className)}>
      {(title || eyebrow || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <Eyebrow className="mb-1 !text-[0.65rem]">{eyebrow}</Eyebrow>}
            {title && <h2 className="text-[15px] font-bold text-ink">{title}</h2>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}

export function Stat({
  value,
  label,
  hint,
  tone = "ink",
}: {
  value: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  tone?: "ink" | "brand";
}) {
  return (
    <div className="min-w-0">
      <div className={cn("tabular text-[2rem] font-extrabold leading-none tracking-tight", tone === "brand" ? "text-brand" : "text-ink")}>
        {value}
      </div>
      <div className="mt-1.5 text-[13px] leading-snug text-ink-2">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-6 rounded-[var(--radius-card)] border border-line bg-card p-5 sm:grid-cols-3 lg:grid-cols-5", className)}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line bg-card/60 px-6 py-12 text-center">
      <div className="mb-3 h-[3px] w-8 rounded bg-brand" />
      <p className="font-bold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ───────── Badges ───────── */

const tones = {
  neutral: "bg-paper-2 text-ink-2",
  brand: "bg-brand-wash text-brand-deep",
  solid: "bg-brand text-white",
  ok: "bg-green-50 text-ok",
  warn: "bg-amber-50 text-warn",
  bad: "bg-red-50 text-bad",
  info: "bg-blue-50 text-info",
  ink: "bg-ink text-white",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ children, tone = "neutral", className, title }: { children: ReactNode; tone?: Tone; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  draft: "neutral",
  published: "info",
  live: "solid",
  running: "solid",
  active: "ok",
  completed: "ink",
  archived: "neutral",
  submitted: "ok",
  final: "ink",
  reviewed: "ok",
  under_review: "info",
  not_started: "neutral",
  pending: "warn",
  accepted: "ok",
  declined: "bad",
  approved: "ok",
  paused: "warn",
  idle: "neutral",
  ended: "ink",
  upcoming: "info",
  judging: "brand",
  registered: "info",
  confirmed: "ok",
  waitlisted: "warn",
  withdrawn: "bad",
  disqualified: "bad",
  suspended: "bad",
  closed: "neutral",
  urgent: "bad",
  important: "warn",
  info: "info",
  internal: "neutral",
  participants: "brand",
  public: "ok",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"}>
      {(status === "live" || status === "running") && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
      {label ?? humanize(status)}
    </Badge>
  );
}

/* ───────── Misc ───────── */

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Progress({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const p = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-paper-2", className)} role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${p}%` }} />
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-[var(--radius-card)] border border-line bg-card", className)}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b border-line bg-paper-2/60 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2", className)}>{children}</th>;
}
export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("border-b border-line/70 px-4 py-3 align-middle text-ink-2", className)}>{children}</td>;
}

export function KV({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DashList({ items }: { items: { title: ReactNode; body?: ReactNode }[] }) {
  return (
    <ul className="space-y-4">
      {items.map((it, i) => (
        <li key={i}>
          <div className="dash text-[15px] font-bold text-ink">{it.title}</div>
          {it.body && <div className="mt-1 pl-[1.85rem] text-sm text-muted">{it.body}</div>}
        </li>
      ))}
    </ul>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-md border border-line bg-paper px-2 py-0.5 text-xs text-ink-2">{children}</span>;
}

export function Forbidden({ message }: { message?: string }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <div className="eyebrow mb-3 text-brand-deep">Access restricted</div>
      <h1 className="text-2xl font-extrabold">You don’t have access to this.</h1>
      <p className="mt-2 text-muted">
        {message ?? "Arthakram admins decide who can view and edit each module. Ask an admin or the event organizer to grant you access."}
      </p>
      <LinkButton href="/app" variant="outline" className="mt-6">
        Back to dashboard
      </LinkButton>
    </div>
  );
}
