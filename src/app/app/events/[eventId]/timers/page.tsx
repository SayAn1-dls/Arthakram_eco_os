import Link from "next/link";
import { MonitorPlay } from "lucide-react";
import { eventAccess, roundsFor, timersFor } from "@/server/events";
import { adjustTimer, controlTimer, createTimer, deleteTimer } from "@/server/actions/operations";
import { ActionButton, ActionForm, Checkbox, Field, Input, Select, SubmitButton } from "@/components/forms";
import { LiveTimersProvider, TimerTick } from "@/components/live";
import { Badge, Card, EmptyState } from "@/components/ui";
import { fmtDuration, humanize } from "@/lib/format";
import { TIMER_KINDS } from "@/db/schema";

export const metadata = { title: "Timers" };

const CONTROLS: Record<string, { op: string; label: string; variant: "primary" | "outline" | "danger" }[]> = {
  idle: [{ op: "start", label: "Start", variant: "primary" }],
  running: [
    { op: "pause", label: "Pause", variant: "outline" },
    { op: "end", label: "End", variant: "danger" },
  ],
  paused: [
    { op: "resume", label: "Resume", variant: "primary" },
    { op: "end", label: "End", variant: "danger" },
  ],
  ended: [],
};

export default async function TimersPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { has } = await eventAccess(eventId);
  const canControl = has("timers.manage");
  const timers = timersFor(eventId);
  const rounds = roundsFor(eventId);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <LiveTimersProvider eventId={eventId} initial={timers} serverNow={Date.now()}>
        <div className="grid gap-4 md:grid-cols-2">
          {timers.length === 0 && <EmptyState title="No timers yet">Create event, round, submission, judging, presentation or break timers.</EmptyState>}
          {timers.map((t) => (
            <Card
              key={t.id}
              title={t.label}
              eyebrow={`${humanize(t.kind)} timer · ${fmtDuration(t.durationSec)}`}
              actions={
                <Link href={`/present/${eventId}/${t.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-deep hover:underline">
                  <MonitorPlay className="h-3.5 w-3.5" /> Projector
                </Link>
              }
            >
              <TimerTick id={t.id} />
              {canControl && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                  {(CONTROLS[t.status] ?? []).map((c) => (
                    <ActionButton key={c.op} action={controlTimer} hidden={{ eventId, timerId: t.id, op: c.op }} variant={c.variant} size="sm" confirm={c.op === "end" ? `End “${t.label}” now?` : undefined}>
                      {c.label}
                    </ActionButton>
                  ))}
                  {t.status !== "idle" && (
                    <ActionButton action={controlTimer} hidden={{ eventId, timerId: t.id, op: "reset" }} variant="ghost" confirm={`Reset “${t.label}”?`}>
                      Reset
                    </ActionButton>
                  )}
                  {t.status !== "ended" && (
                    <>
                      <ActionButton action={adjustTimer} hidden={{ eventId, timerId: t.id, minutes: 5 }} variant="ghost" title="Add 5 minutes">
                        +5m
                      </ActionButton>
                      <ActionButton action={adjustTimer} hidden={{ eventId, timerId: t.id, minutes: -5 }} variant="ghost" title="Remove 5 minutes">
                        −5m
                      </ActionButton>
                    </>
                  )}
                  <span className="ml-auto">
                    <ActionButton action={deleteTimer} hidden={{ eventId, timerId: t.id }} variant="ghost" confirm={`Delete “${t.label}”?`}>
                      Delete
                    </ActionButton>
                  </span>
                </div>
              )}
            </Card>
          ))}
        </div>
      </LiveTimersProvider>
      {canControl ? (
        <Card title="New timer">
          <ActionForm action={createTimer} hidden={{ eventId }} resetOnSuccess className="space-y-3">
            <Field label="Label">
              <Input name="label" required placeholder="Round 1 · Build" />
            </Field>
            <Field label="Kind">
              <Select name="kind" defaultValue="round" options={TIMER_KINDS.map((k) => ({ value: k, label: humanize(k) }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hours">
                <Input type="number" name="hours" min={0} max={240} defaultValue={1} />
              </Field>
              <Field label="Minutes">
                <Input type="number" name="minutes" min={0} max={59} defaultValue={0} />
              </Field>
            </div>
            <Field label="Linked round" hint="Ending a round/submission timer closes submissions for that round.">
              <Select name="roundId" options={rounds.map((r) => ({ value: r.id, label: r.name }))} placeholder="None" />
            </Field>
            <Checkbox name="visibleToParticipants" defaultChecked label="Show to participants" />
            <SubmitButton className="w-full">Create timer</SubmitButton>
          </ActionForm>
        </Card>
      ) : (
        <Card>
          <Badge>View only</Badge>
          <p className="mt-2 text-sm text-muted">Timers update live for everyone. Only people with timer access can control them.</p>
        </Card>
      )}
    </div>
  );
}
