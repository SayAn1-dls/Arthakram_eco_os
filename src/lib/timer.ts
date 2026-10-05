/** Timer state maths, shared by server (actions) and client (live display). */

export type TimerState = {
  status: "idle" | "running" | "paused" | "ended";
  durationSec: number;
  elapsedBeforeSec: number;
  startedAt: number | null; // epoch ms of the current running segment
};

export function elapsedSec(t: TimerState, now = Date.now()) {
  const running = t.status === "running" && t.startedAt != null ? (now - t.startedAt) / 1000 : 0;
  return Math.min(t.durationSec, t.elapsedBeforeSec + running);
}

export function remainingSec(t: TimerState, now = Date.now()) {
  if (t.status === "ended") return 0;
  return Math.max(0, t.durationSec - elapsedSec(t, now));
}

export type TimerAction = "start" | "pause" | "resume" | "reset" | "end";

/** Pure transition. Returns the patch to persist, or an error string. */
export function transition(
  t: TimerState,
  action: TimerAction,
  now = Date.now(),
): { patch: Partial<TimerState> & { endedAt?: number | null } } | { error: string } {
  switch (action) {
    case "start":
      if (t.status !== "idle") return { error: "Timer already started. Reset it first." };
      return { patch: { status: "running", startedAt: now, elapsedBeforeSec: 0, endedAt: null } };
    case "pause":
      if (t.status !== "running") return { error: "Only a running timer can be paused." };
      return {
        patch: { status: "paused", elapsedBeforeSec: Math.round(elapsedSec(t, now)), startedAt: null },
      };
    case "resume":
      if (t.status !== "paused") return { error: "Only a paused timer can be resumed." };
      return { patch: { status: "running", startedAt: now } };
    case "reset":
      return { patch: { status: "idle", startedAt: null, elapsedBeforeSec: 0, endedAt: null } };
    case "end":
      if (t.status === "ended") return { error: "Timer already ended." };
      return {
        patch: { status: "ended", elapsedBeforeSec: Math.round(elapsedSec(t, now)), startedAt: null, endedAt: now },
      };
  }
}
