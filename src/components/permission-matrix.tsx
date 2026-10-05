import { PERMISSION_MODULES } from "@/lib/permissions";

/** Checkbox grid of every permission, grouped like the platform hierarchy. */
export function PermissionMatrix({ selected, disabled }: { selected: Set<string>; disabled?: boolean }) {
  const groups = [...new Set(PERMISSION_MODULES.map((m) => m.group))];
  const all = selected.has("*");
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          <div className="eyebrow mb-2 !text-[0.62rem] text-brand-deep">{g}</div>
          <div className="grid gap-3 md:grid-cols-2">
            {PERMISSION_MODULES.filter((m) => m.group === g).map((m) => (
              <div key={m.key} className="rounded-lg border border-line bg-white/60 p-3">
                <div className="mb-1.5 text-sm font-bold text-ink">{m.label}</div>
                <div className="space-y-1">
                  {m.actions.map((a) => {
                    const p = `${m.key}.${a.action}`;
                    return (
                      <label key={p} className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
                        <input type="checkbox" name="permissions" value={p} defaultChecked={all || selected.has(p)} disabled={disabled} className="h-3.5 w-3.5 accent-[var(--color-brand)]" />
                        <span className="w-16 shrink-0 rounded bg-paper-2 px-1.5 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-muted">{a.action}</span>
                        {a.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
