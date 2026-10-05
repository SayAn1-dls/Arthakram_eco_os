import { Badge, Table, Td, Th } from "./ui";
import { fmtDateTime } from "@/lib/format";

type Row = { id: string; summary: string; action: string; resourceType: string; createdAt: Date; actor: string | null; before: unknown; after: unknown };

function Diff({ before, after }: { before: unknown; after: unknown }) {
  if (!before && !after) return null;
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const isObj = (x: unknown) => x && typeof x === "object" && !Array.isArray(x);
  if (!isObj(b) || !isObj(a)) return <pre className="mt-1 max-w-xl overflow-x-auto text-[11px] text-muted">{JSON.stringify(after ?? before)}</pre>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-brand-deep">Show change</summary>
      <table className="mt-1 text-[11px]">
        <tbody>
          {keys.map((k) => (
            <tr key={k} className="align-top">
              <td className="pr-3 font-semibold text-ink-2">{k}</td>
              <td className="pr-3 text-bad line-through decoration-bad/40">{fmt(b[k])}</td>
              <td className="text-ok">{fmt(a[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
const fmt = (v: unknown) => (v === undefined ? "—" : typeof v === "string" ? (v.length > 80 ? v.slice(0, 80) + "…" : v) : JSON.stringify(v));

export function AuditTable({ rows }: { rows: Row[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>When</Th>
          <Th>Who</Th>
          <Th>What happened</Th>
          <Th>Action</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <Td colSpan={4} className="py-8 text-center text-muted">
              No activity recorded.
            </Td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id}>
            <Td className="whitespace-nowrap text-xs">{fmtDateTime(r.createdAt)}</Td>
            <Td className="whitespace-nowrap font-semibold text-ink">{r.actor ?? "System"}</Td>
            <Td>
              {r.summary}
              <Diff before={r.before} after={r.after} />
            </Td>
            <Td>
              <Badge>{r.action}</Badge>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
