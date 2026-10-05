import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { evaluations, judgeAssignments, teams, users } from "@/db/schema";
import { eventAccess, eventRoleHolders, roundsFor } from "@/server/events";
import { autoAssignJudges, inviteJudge, removeJudge, toggleAssignment } from "@/server/actions/competition";
import { ActionButton, ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Card, EmptyState, Forbidden, Progress } from "@/components/ui";
import { scoreSpread } from "@/lib/scoring";
import { cn } from "@/lib/cn";

export const metadata = { title: "Judges" };

export default async function JudgesPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ round?: string }> }) {
  const { eventId } = await params;
  const { round: roundParam } = await searchParams;
  const { event, has } = await eventAccess(eventId);
  if (!has("judges.manage")) return <Forbidden />;
  const rounds = roundsFor(eventId);
  const round = rounds.find((r) => r.id === roundParam) ?? rounds.find((r) => r.id === event.currentRoundId) ?? rounds[0];
  const judges = eventRoleHolders(eventId, "judge");
  const teamRows = db.select().from(teams).where(and(eq(teams.eventId, eventId), eq(teams.status, "active"))).all().sort((a, b) => a.code.localeCompare(b.code));
  const assigns = round ? db.select().from(judgeAssignments).where(eq(judgeAssignments.roundId, round.id)).all() : [];
  const evals = round ? db.select().from(evaluations).where(eq(evaluations.roundId, round.id)).all() : [];
  const key = (t: string, j: string) => `${t}:${j}`;
  const assigned = new Set(assigns.map((a) => key(a.teamId, a.judgeUserId)));
  const evalOf = new Map(evals.map((e) => [key(e.teamId, e.judgeUserId), e]));

  // Calibration: how far each judge sits from the panel average on shared teams, and per-team disagreement.
  const submitted = evals.filter((e) => e.status === "submitted" && e.totalScore != null);
  const teamMean = new Map<string, number>();
  for (const t of teamRows) {
    const xs = submitted.filter((e) => e.teamId === t.id).map((e) => e.totalScore!);
    if (xs.length) teamMean.set(t.id, xs.reduce((a, b) => a + b, 0) / xs.length);
  }
  const calibration = judges.map((j) => {
    const mine = submitted.filter((e) => e.judgeUserId === j.id && (submitted.filter((x) => x.teamId === e.teamId).length > 1));
    const bias = mine.length ? mine.reduce((a, e) => a + (e.totalScore! - teamMean.get(e.teamId)!), 0) / mine.length : null;
    return { ...j, bias, n: mine.length, avg: mine.length ? mine.reduce((a, e) => a + e.totalScore!, 0) / mine.length : null };
  });
  const disagreements = teamRows
    .map((t) => ({ t, s: scoreSpread(submitted.filter((e) => e.teamId === t.id).map((e) => e.totalScore!)) }))
    .filter((x) => x.s.range >= 15)
    .sort((a, b) => b.s.range - a.s.range);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title="Judging panel" eyebrow={`${judges.length} judges`}>
          {judges.length === 0 ? (
            <EmptyState title="No judges yet">Invite judges by email. They get a dedicated dashboard with only their assigned teams.</EmptyState>
          ) : (
            <ul className="divide-y divide-line/70">
              {judges.map((j) => {
                const mine = assigns.filter((a) => a.judgeUserId === j.id);
                const done = mine.filter((a) => evalOf.get(key(a.teamId, j.id))?.status === "submitted").length;
                return (
                  <li key={j.id} className="flex items-center gap-3 py-3">
                    <Avatar name={j.name} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ink">{j.name}</div>
                      <div className="text-xs text-muted">{j.headline ?? j.email}</div>
                      <Progress value={done} max={mine.length || 1} className="mt-1.5 max-w-60" />
                    </div>
                    <span className="tabular text-sm text-muted">
                      {done}/{mine.length} scored
                    </span>
                    <ActionButton action={removeJudge} hidden={{ eventId, userId: j.id }} variant="ghost" confirm={`Remove ${j.name} as judge? Their submitted scores are kept.`}>
                      Remove
                    </ActionButton>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="Invite judge">
            <ActionForm action={inviteJudge} hidden={{ eventId }} resetOnSuccess className="space-y-3">
              <Field label="Email" hint="Grants the Judge role on this event only.">
                <Input type="email" name="email" required />
              </Field>
              <SubmitButton className="w-full">Invite</SubmitButton>
            </ActionForm>
          </Card>
          {round && (
            <Card title="Auto-assign" eyebrow={round.name}>
              <ActionForm action={autoAssignJudges} hidden={{ eventId, roundId: round.id }} className="flex items-end gap-2">
                <Field label="Judges per team" className="flex-1">
                  <Input type="number" name="perTeam" min={1} max={10} defaultValue={2} />
                </Field>
                <SubmitButton variant="outline">Balance</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>

      {round && judges.length > 0 && (
        <Card
          title="Assignment matrix"
          eyebrow="Click a cell to assign / unassign"
          actions={
            <form className="flex items-center gap-2">
              <Select name="round" defaultValue={round.id} options={rounds.map((r) => ({ value: r.id, label: r.name }))} className="!h-8 text-xs" />
              <button className="text-xs font-semibold text-brand-deep">Show</button>
            </form>
          }
          padded={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card px-4 py-2 text-left text-[11px] uppercase tracking-wider text-muted">Team</th>
                  {judges.map((j) => (
                    <th key={j.id} className="px-2 py-2 text-center text-[11px] font-semibold text-ink-2">
                      {j.name.split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamRows.map((t) => (
                  <tr key={t.id} className="border-t border-line/70">
                    <td className="sticky left-0 bg-card px-4 py-1.5 font-semibold text-ink">
                      {t.name} <span className="text-xs text-muted">{t.code}</span>
                    </td>
                    {judges.map((j) => {
                      const on = assigned.has(key(t.id, j.id));
                      const ev = evalOf.get(key(t.id, j.id));
                      return (
                        <td key={j.id} className="px-2 py-1.5 text-center">
                          <ActionButton
                            action={toggleAssignment}
                            hidden={{ eventId, roundId: round.id, teamId: t.id, judgeId: j.id }}
                            variant={on ? "primary" : "ghost"}
                            className={cn("!h-7 !min-w-12 !px-2 text-[11px]", ev?.status === "submitted" && "!bg-ok")}
                            title={ev ? `${ev.status} · ${ev.totalScore?.toFixed(1) ?? "-"}` : on ? "Assigned — click to remove" : "Click to assign"}
                          >
                            {ev?.status === "submitted" ? ev.totalScore?.toFixed(0) : ev ? "draft" : on ? "✓" : "·"}
                          </ActionButton>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Judge calibration" eyebrow="Scoring tendency vs. panel average">
          {calibration.every((c) => c.bias == null) ? (
            <p className="text-sm text-muted">Calibration appears once two or more judges have scored the same team.</p>
          ) : (
            <ul className="space-y-3">
              {calibration.map((c) => (
                <li key={c.id} className="flex items-center gap-3 text-sm">
                  <span className="w-32 truncate font-semibold text-ink">{c.name}</span>
                  <div className="relative h-2 flex-1 rounded bg-paper-2">
                    <span className="absolute left-1/2 top-[-3px] h-3.5 w-px bg-ink/40" />
                    {c.bias != null && (
                      <span
                        className={cn("absolute top-0 h-2 rounded", c.bias >= 0 ? "left-1/2 bg-brand" : "right-1/2 bg-info")}
                        style={{ width: `${Math.min(50, Math.abs(c.bias) * 2)}%` }}
                      />
                    )}
                  </div>
                  <span className="w-28 text-right tabular text-xs text-muted">
                    {c.bias == null ? "—" : `${c.bias >= 0 ? "+" : ""}${c.bias.toFixed(1)} pts · ${c.n} teams`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">Positive = scores higher than co-judges on the same teams. Use a shared sample submission to recalibrate before the next round.</p>
        </Card>
        <Card title="Large disagreements" eyebrow="Range ≥ 15 points">
          {disagreements.length === 0 ? (
            <p className="text-sm text-muted">Judges broadly agree on every team so far.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {disagreements.map(({ t, s }) => (
                <li key={t.id} className="flex justify-between">
                  <span className="font-semibold text-ink">{t.name}</span>
                  <Badge tone="warn">
                    range {s.range} · σ {s.stdev}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
