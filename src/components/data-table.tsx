"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { ArrowDownUp, Download, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { humanize } from "@/lib/format";
import { buttonClass, StatusBadge } from "./ui";
import { SubmitButton, type FormAction } from "./forms";

export type Column = {
  key: string;
  label: string;
  kind?: "text" | "status" | "number" | "muted" | "tags";
  sortable?: boolean;
  className?: string;
};

export type Row = { id: string; href?: string } & Record<string, string | number | null | undefined | string[]>;

export type BulkAction = {
  label: string;
  action: FormAction;
  confirm?: string;
  variant?: "primary" | "outline" | "danger";
  select?: { name: string; placeholder: string; options: { value: string; label: string }[] };
  hidden?: Record<string, string>;
};

export function DataTable({
  columns,
  rows,
  filters = [],
  bulkActions = [],
  exportHref,
  searchPlaceholder = "Search…",
  empty = "Nothing here yet.",
}: {
  columns: Column[];
  rows: Row[];
  filters?: { key: string; label: string; options: string[] }[];
  bulkActions?: BulkAction[];
  exportHref?: string;
  searchPlaceholder?: string;
  empty?: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [active, setActive] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      for (const [k, v] of Object.entries(active)) if (v && String(r[k] ?? "") !== v) return false;
      if (!needle) return true;
      return columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(needle));
    });
    if (sort) {
      out = [...out].sort((a, b) => {
        const av = a[sort.key] ?? "";
        const bv = b[sort.key] ?? "";
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
        return String(av).localeCompare(String(bv), undefined, { numeric: true }) * sort.dir;
      });
    }
    return out;
  }, [rows, q, active, sort, columns]);

  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visible.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm focus:border-brand focus:outline-none"
          />
        </div>
        {filters.map((f) => (
          <select
            key={f.key}
            value={active[f.key] ?? ""}
            onChange={(e) => setActive((a) => ({ ...a, [f.key]: e.target.value }))}
            className="h-9 rounded-lg border border-line bg-white px-2 text-sm"
            aria-label={f.label}
          >
            <option value="">All {f.label.toLowerCase()}</option>
            {f.options.map((o) => (
              <option key={o} value={o}>
                {humanize(o)}
              </option>
            ))}
          </select>
        ))}
        <span className="ml-auto text-xs text-muted tabular">
          {visible.length} of {rows.length}
        </span>
        {exportHref && (
          <a href={exportHref} className={buttonClass({ variant: "outline", size: "sm" })}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </a>
        )}
      </div>

      {bulkActions.length > 0 && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-brand-wash/60 px-3 py-2">
          <span className="text-sm font-semibold text-brand-deep">{selected.size} selected</span>
          {bulkActions.map((b) => (
            <BulkForm key={b.label} bulk={b} ids={[...selected]} onDone={() => setSelected(new Set())} />
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {bulkActions.length > 0 && (
                <th className="w-10 border-b border-line bg-paper-2/60 px-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" className="accent-[var(--color-brand)]" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={cn("border-b border-line bg-paper-2/60 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2", c.className)}>
                  {c.sortable !== false ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 uppercase hover:text-brand-deep"
                      onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 }))}
                    >
                      {c.label}
                      <ArrowDownUp className={cn("h-3 w-3", sort?.key === c.key ? "text-brand" : "opacity-40")} />
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-10 text-center text-muted">
                  {empty}
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr key={r.id} className={cn("transition-colors hover:bg-brand-wash/40", selected.has(r.id) && "bg-brand-wash/50")}>
                {bulkActions.length > 0 && (
                  <td className="border-b border-line/70 px-3">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label="Select row" className="accent-[var(--color-brand)]" />
                  </td>
                )}
                {columns.map((c, i) => (
                  <td key={c.key} className={cn("border-b border-line/70 px-4 py-2.5 align-middle text-ink-2", c.className)}>
                    <Cell col={c} row={r} first={i === 0} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ col, row, first }: { col: Column; row: Row; first: boolean }) {
  const v = row[col.key];
  if (v == null || v === "") return <span className="text-muted/60">—</span>;
  let content: React.ReactNode;
  switch (col.kind) {
    case "status":
      content = <StatusBadge status={String(v)} />;
      break;
    case "number":
      content = <span className="tabular">{v}</span>;
      break;
    case "muted":
      content = <span className="text-muted">{v}</span>;
      break;
    case "tags":
      content = (
        <span className="flex flex-wrap gap-1">
          {(Array.isArray(v) ? v : String(v).split(",")).map((t) => (
            <span key={t} className="rounded bg-paper-2 px-1.5 py-0.5 text-xs">
              {t}
            </span>
          ))}
        </span>
      );
      break;
    default:
      content = String(v);
  }
  if (first && row.href)
    return (
      <Link href={row.href} className="font-semibold text-ink hover:text-brand-deep">
        {content}
      </Link>
    );
  return first ? <span className="font-semibold text-ink">{content}</span> : content;
}

function BulkForm({ bulk, ids, onDone }: { bulk: BulkAction; ids: string[]; onDone: () => void }) {
  const [state, formAction] = useActionState(async (prev: Awaited<ReturnType<FormAction>> | undefined, fd: FormData) => {
    const r = await bulk.action(prev, fd);
    if (r.ok) onDone();
    return r;
  }, undefined);
  return (
    <form
      action={formAction}
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        if (bulk.confirm && !window.confirm(bulk.confirm)) e.preventDefault();
      }}
    >
      <input type="hidden" name="ids" value={ids.join(",")} />
      {bulk.hidden && Object.entries(bulk.hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {bulk.select && (
        <select name={bulk.select.name} required className="h-8 rounded-lg border border-line bg-white px-2 text-sm">
          <option value="">{bulk.select.placeholder}</option>
          {bulk.select.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      <SubmitButton size="sm" variant={bulk.variant ?? "outline"}>
        {bulk.label}
      </SubmitButton>
      {state?.error && <span className="text-xs text-bad">{state.error}</span>}
    </form>
  );
}
