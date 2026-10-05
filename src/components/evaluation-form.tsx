"use client";

import { useActionState, useMemo, useState } from "react";
import { weightedScore } from "@/lib/scoring";
import { cn } from "@/lib/cn";
import { FormMessage, SubmitButton, Textarea, type FormAction } from "./forms";
import { Badge } from "./ui";

type Crit = { id: string; name: string; description: string | null; instructions: string | null; weight: number; minScore: number; maxScore: number };

export function EvaluationForm({
  action,
  hidden,
  criteria,
  rubricName,
  initial,
  locked,
}: {
  action: FormAction;
  hidden: Record<string, string>;
  criteria: Crit[];
  rubricName: string;
  initial: { scores: Record<string, number>; comments: Record<string, string>; feedback: string; privateNotes: string; status: string | null };
  locked: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [scores, setScores] = useState<Record<string, number | undefined>>(initial.scores);
  const total = useMemo(() => weightedScore(criteria, Object.fromEntries(Object.entries(scores).filter(([, v]) => v != null)) as Record<string, number>), [scores, criteria]);
  const filled = criteria.filter((c) => scores[c.id] != null).length;

  return (
    <form action={formAction} className="rounded-[var(--radius-card)] border border-line bg-card">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="sticky top-14 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-[var(--radius-card)] border-b border-line bg-card/95 px-5 py-4 backdrop-blur">
        <div>
          <div className="eyebrow !text-[0.65rem]">Rubric · {rubricName}</div>
          <div className="text-sm text-muted">
            {filled}/{criteria.length} criteria scored {initial.status && <Badge tone={initial.status === "submitted" ? "ok" : "warn"}>{initial.status}</Badge>}
          </div>
        </div>
        <div className="text-right">
          <div className="tabular text-3xl font-extrabold text-ink">{total.toFixed(1)}</div>
          <div className="text-xs text-muted">weighted / 100</div>
        </div>
      </div>
      <fieldset disabled={locked} className="divide-y divide-line/70">
        {criteria.map((c) => {
          const v = scores[c.id];
          const steps = Array.from({ length: c.maxScore - c.minScore + 1 }, (_, i) => c.minScore + i);
          return (
            <div key={c.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-ink">{c.name}</div>
                  {c.description && <div className="text-sm text-muted">{c.description}</div>}
                </div>
                <Badge tone="brand">{c.weight}%</Badge>
              </div>
              {c.instructions && <p className="mt-2 rounded-md bg-paper-2/70 px-3 py-2 text-xs text-ink-2">{c.instructions}</p>}
              <input type="hidden" name={`score_${c.id}`} value={v ?? ""} />
              <div className="mt-3 flex flex-wrap gap-1" role="radiogroup" aria-label={c.name}>
                {steps.length <= 11 ? (
                  steps.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={v === s}
                      onClick={() => setScores((x) => ({ ...x, [c.id]: s }))}
                      className={cn("h-9 w-9 rounded-lg border text-sm font-bold tabular transition-colors", v === s ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-2 hover:border-brand")}
                    >
                      {s}
                    </button>
                  ))
                ) : (
                  <input type="number" min={c.minScore} max={c.maxScore} value={v ?? ""} onChange={(e) => setScores((x) => ({ ...x, [c.id]: e.target.value === "" ? undefined : Number(e.target.value) }))} className="h-9 w-24 rounded-lg border border-line px-2" />
                )}
              </div>
              <input name={`comment_${c.id}`} defaultValue={initial.comments[c.id] ?? ""} placeholder="Optional note on this criterion" className="mt-2 h-8 w-full rounded-md border border-line bg-white px-2 text-xs" />
            </div>
          );
        })}
        <div className="space-y-3 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink-2">Feedback for the team</span>
            <Textarea name="feedback" defaultValue={initial.feedback} rows={3} placeholder="One thing to keep, one thing to change." />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink-2">Private notes (organizers only)</span>
            <Textarea name="privateNotes" defaultValue={initial.privateNotes} rows={2} />
          </label>
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4">
        {locked ? (
          <span className="text-sm text-muted">Submitted and locked. Ask the organizer to reopen it if something needs to change.</span>
        ) : (
          <>
            <SubmitButton name="op" value="draft" variant="outline">
              Save draft
            </SubmitButton>
            <SubmitButton name="op" value="submit" pendingText="Submitting…">
              Submit evaluation
            </SubmitButton>
          </>
        )}
      </div>
      <div className="px-5 pb-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
