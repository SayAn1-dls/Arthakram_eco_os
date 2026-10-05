import { test } from "node:test";
import assert from "node:assert/strict";
import { rankTeams, validateScores, weightedScore } from "../src/lib/scoring";
import { remainingSec, transition, type TimerState } from "../src/lib/timer";

const criteria = [
  { id: "a", name: "Problem", weight: 20, minScore: 0, maxScore: 10 },
  { id: "b", name: "Innovation", weight: 80, minScore: 0, maxScore: 10 },
];

test("weighted score normalises to 100", () => {
  assert.equal(weightedScore(criteria, { a: 10, b: 10 }), 100);
  assert.equal(weightedScore(criteria, { a: 10, b: 0 }), 20);
  assert.equal(weightedScore(criteria, { a: 5, b: 5 }), 50);
});

test("score validation enforces bounds", () => {
  assert.match(validateScores(criteria, { a: 11, b: 2 })!, /between/);
  assert.match(validateScores(criteria, { a: 1 })!, /missing/);
  assert.equal(validateScores(criteria, { a: 1, b: 2 }), null);
});

test("ranking averages judges and shares tied ranks", () => {
  const r = rankTeams([
    { teamId: "x", totalScore: 80, scores: {} },
    { teamId: "x", totalScore: 60, scores: {} },
    { teamId: "y", totalScore: 70, scores: {} },
    { teamId: "z", totalScore: 90, scores: {} },
  ]);
  assert.deepEqual(r.map((t) => [t.teamId, t.rank]), [["z", 1], ["x", 2], ["y", 2]]);
});

test("timer lifecycle", () => {
  let t: TimerState = { status: "idle", durationSec: 600, elapsedBeforeSec: 0, startedAt: null };
  const apply = (a: Parameters<typeof transition>[1], now: number) => {
    const r = transition(t, a, now);
    assert.ok("patch" in r, JSON.stringify(r));
    t = { ...t, ...(r as { patch: Partial<TimerState> }).patch };
  };
  apply("start", 0);
  assert.equal(remainingSec(t, 60_000), 540);
  apply("pause", 60_000);
  assert.equal(remainingSec(t, 999_999), 540);
  apply("resume", 100_000);
  assert.equal(remainingSec(t, 160_000), 480);
  assert.ok("error" in transition(t, "start", 0));
  apply("end", 160_000);
  assert.equal(remainingSec(t, 170_000), 0);
});
