/**
 * Single-series horizontal bar chart (magnitude → one hue). Values are printed in
 * ink, the bar carries length only; each row is hoverable and doubles as a table row.
 */
export function BarList({ data, unit = "", max }: { data: { label: string; value: number; hint?: string }[]; unit?: string; max?: number }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {data.map((d) => (
          <tr key={d.label} className="group" title={`${d.label}: ${d.value}${unit}${d.hint ? ` · ${d.hint}` : ""}`}>
            <th scope="row" className="w-[38%] py-1.5 pr-3 text-left font-medium text-ink-2">
              {d.label}
            </th>
            <td className="py-1.5">
              <div className="flex items-center gap-2">
                <div className="h-3 flex-1 rounded-[4px] bg-paper-2/70">
                  <div className="h-3 rounded-[4px] bg-brand transition-opacity group-hover:opacity-80" style={{ width: `${Math.max(1.5, (d.value / top) * 100)}%` }} />
                </div>
                <span className="w-16 text-right tabular font-semibold text-ink">
                  {d.value}
                  {unit}
                </span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
