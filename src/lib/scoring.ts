/** Competition maths — pure and unit-tested. */

export type Criterion = { id: string; name: string; weight: number; minScore: number; maxScore: number };

/** Weighted score normalised to 0..100. Each criterion contributes weight × (score-min)/(max-min). */
export function weightedScore(criteria: Criterion[], scores: Record<string, number>): number {
  const totalWeight = criteria.reduce((a, c) => a + c.weight, 0);
  if (!totalWeight) return 0;
  let sum = 0;
  for (const c of criteria) {
    const raw = scores[c.id];
    if (raw == null || Number.isNaN(raw)) continue;
    const clamped = Math.min(c.maxScore, Math.max(c.minScore, raw));
    const span = c.maxScore - c.minScore || 1;
    sum += c.weight * ((clamped - c.minScore) / span);
  }
  return +((sum / totalWeight) * 100).toFixed(2);
}

export function validateScores(criteria: Criterion[], scores: Record<string, number>): string | null {
  for (const c of criteria) {
    const v = scores[c.id];
    if (v == null || Number.isNaN(v)) return `Score missing for “${c.name}”.`;
    if (v < c.minScore || v > c.maxScore) return `“${c.name}” must be between ${c.minScore} and ${c.maxScore}.`;
  }
  return null;
}

export type TeamResult = {
  teamId: string;
  average: number;
  judgeCount: number;
  rank: number;
  criteria: Record<string, number>; // criterion id → average raw score
};

/**
 * Rank teams by mean of submitted evaluations. Ties share a rank (1, 2, 2, 4).
 */
export function rankTeams(
  evals: { teamId: string; totalScore: number; scores: Record<string, number> }[],
): TeamResult[] {
  const byTeam = new Map<string, { totals: number[]; crit: Record<string, number[]> }>();
  for (const e of evals) {
    const t = byTeam.get(e.teamId) ?? { totals: [], crit: {} };
    t.totals.push(e.totalScore);
    for (const [cid, s] of Object.entries(e.scores)) (t.crit[cid] ??= []).push(s);
    byTeam.set(e.teamId, t);
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const rows = [...byTeam.entries()]
    .map(([teamId, t]) => ({
      teamId,
      average: +mean(t.totals).toFixed(2),
      judgeCount: t.totals.length,
      rank: 0,
      criteria: Object.fromEntries(Object.entries(t.crit).map(([k, v]) => [k, +mean(v).toFixed(2)])),
    }))
    .sort((a, b) => b.average - a.average);
  rows.forEach((r, i) => {
    r.rank = i > 0 && rows[i - 1]!.average === r.average ? rows[i - 1]!.rank : i + 1;
  });
  return rows;
}

/** Judge calibration: spread of judges' scores on the same team. */
export function scoreSpread(values: number[]) {
  if (values.length < 2) return { mean: values[0] ?? 0, stdev: 0, range: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return {
    mean: +mean.toFixed(2),
    stdev: +Math.sqrt(variance).toFixed(2),
    range: +(Math.max(...values) - Math.min(...values)).toFixed(2),
  };
}
