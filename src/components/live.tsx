"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { fmtDuration } from "@/lib/format";
import { remainingSec, type TimerState } from "@/lib/timer";

export type LiveTimer = TimerState & { id: string; label: string; kind: string };

/** Re-render server components on an interval (keeps dashboards live). */
export function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(t);
  }, [router, intervalMs]);
  return null;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/**
 * Polls /api/events/:id/live for timer state and ticks locally between polls.
 * Server time offset is applied so every screen shows the same countdown.
 */
export function useLiveTimers(eventId: string, initial: LiveTimer[], initialServerNow: number) {
  const [timers, setTimers] = useState(initial);
  const offset = useRef(initialServerNow - Date.now());
  useEffect(() => setTimers(initial), [initial]);
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/live`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { timers: LiveTimer[]; serverNow: number };
        if (stop) return;
        offset.current = data.serverNow - Date.now();
        setTimers(data.timers);
      } catch {
        /* offline — keep ticking locally */
      }
    };
    const t = setInterval(() => document.visibilityState === "visible" && poll(), 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [eventId]);
  const anyRunning = timers.some((t) => t.status === "running");
  const now = useNow(anyRunning) + offset.current;
  return { timers, now };
}

export function TimerFace({ timer, now, size = "md" }: { timer: LiveTimer; now: number; size?: "sm" | "md" | "xl" }) {
  const rem = remainingSec(timer, now);
  const up = timer.status === "running" && rem <= 0;
  const warn = timer.status === "running" && rem > 0 && rem <= 300;
  const state =
    timer.status === "running" ? (up ? "TIME UP" : "RUNNING") : timer.status === "paused" ? "PAUSED" : timer.status === "ended" ? "ENDED" : "NOT STARTED";
  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em]",
            timer.status === "running" ? "text-brand-deep" : "text-muted",
          )}
        >
          {timer.status === "running" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />}
          {state}
        </span>
      </div>
      <div
        className={cn(
          "tabular font-bold leading-none",
          size === "xl" ? "text-[clamp(3rem,10vw,7rem)]" : size === "md" ? "text-4xl" : "text-xl",
          up ? "text-bad" : warn ? "text-brand-deep" : "text-ink",
        )}
      >
        {fmtDuration(rem)}
      </div>
      <div className="mt-1 text-xs text-muted">{size === "sm" ? null : "remaining"}</div>
    </div>
  );
}

export function LiveTimerStrip({
  eventId,
  initial,
  serverNow,
  emptyText = "No timers yet.",
  size = "md",
}: {
  eventId: string;
  initial: LiveTimer[];
  serverNow: number;
  emptyText?: string;
  size?: "sm" | "md";
}) {
  const { timers, now } = useLiveTimers(eventId, initial, serverNow);
  if (!timers.length) return <p className="text-sm text-muted">{emptyText}</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {timers.map((t) => (
        <div key={t.id} className="rounded-xl border border-line bg-white/70 p-4">
          <div className="mb-2 text-sm font-semibold text-ink">{t.label}</div>
          <TimerFace timer={t} now={now} size={size} />
        </div>
      ))}
    </div>
  );
}

/** Full-screen projector view for a single timer. */
export function LiveTimerFocus({ eventId, initial, serverNow, timerId }: { eventId: string; initial: LiveTimer[]; serverNow: number; timerId: string }) {
  const { timers, now } = useLiveTimers(eventId, initial, serverNow);
  const t = timers.find((x) => x.id === timerId);
  if (!t) return <p>Timer removed.</p>;
  return (
    <div className="text-center">
      <div className="eyebrow mb-4 text-brand-deep">{t.label}</div>
      <div className="inline-block">
        <TimerFace timer={t} now={now} size="xl" />
      </div>
    </div>
  );
}

/* ───────── Shared polling context: one poll per page, many faces ───────── */


const LiveCtx = createContext<{ timers: LiveTimer[]; now: number } | null>(null);

export function LiveTimersProvider({ eventId, initial, serverNow, children }: { eventId: string; initial: LiveTimer[]; serverNow: number; children: React.ReactNode }) {
  const value = useLiveTimers(eventId, initial, serverNow);
  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

export function TimerTick({ id, size = "md" }: { id: string; size?: "sm" | "md" | "xl" }) {
  const ctx = useContext(LiveCtx);
  const t = ctx?.timers.find((x) => x.id === id);
  if (!ctx || !t) return null;
  return <TimerFace timer={t} now={ctx.now} size={size} />;
}
