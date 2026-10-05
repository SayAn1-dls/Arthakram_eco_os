import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { problemStatements, scheduleItems } from "@/db/schema";
import { eventAccess, roundsFor } from "@/server/events";
import {
  addScheduleItem,
  deleteProblemStatement,
  deleteRound,
  deleteScheduleItem,
  saveProblemStatement,
  saveRound,
  setRoundStatus,
} from "@/server/actions/events";
import { ActionButton, ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Badge, Card, EmptyState, StatusBadge } from "@/components/ui";
import { toLocalInput } from "@/lib/datetime";
import { fmtDateTime, fmtTime, humanize } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Rounds & schedule" };

const ROUND_NEXT: Record<string, { to: string; label: string }[]> = {
  upcoming: [{ to: "active", label: "Start round" }],
  active: [{ to: "judging", label: "Close & start judging" }],
  judging: [{ to: "completed", label: "Complete round" }],
  completed: [{ to: "judging", label: "Reopen judging" }],
};

export default async function SchedulePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, has } = await eventAccess(eventId);
  const canEdit = has("schedule.manage");
  const rounds = roundsFor(eventId);
  const items = db.select().from(scheduleItems).where(eq(scheduleItems.eventId, eventId)).orderBy(asc(scheduleItems.startsAt)).all();
  const ps = db.select().from(problemStatements).where(eq(problemStatements.eventId, eventId)).orderBy(asc(problemStatements.code)).all();
  const now = Date.now();

  return (
    <div className="space-y-8">
      <Card title="Rounds" eyebrow={`${rounds.length} rounds`}>
        {rounds.length === 0 && <EmptyState title="No rounds yet">Rounds structure submissions, judging and timers.</EmptyState>}
        <ol className="space-y-3">
          {rounds.map((r) => (
            <li key={r.id} className={cn("rounded-xl border p-4", r.id === event.currentRoundId ? "border-brand bg-brand-wash/40" : "border-line bg-white/60")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{r.name}</span>
                    <StatusBadge status={r.status} />
                    {r.isFinal && <Badge tone="ink">Final</Badge>}
                    {r.id === event.currentRoundId && <Badge tone="solid">Current</Badge>}
                  </div>
                  {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
                  <div className="mt-1 text-xs text-muted">
                    {r.startsAt ? `${fmtDateTime(r.startsAt)} → ${fmtDateTime(r.endsAt)}` : "Not scheduled"}
                    {r.submissionDeadline && ` · submissions close ${fmtDateTime(r.submissionDeadline)}`}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    {(ROUND_NEXT[r.status] ?? []).map((n) => (
                      <ActionButton key={n.to} action={setRoundStatus} hidden={{ eventId, roundId: r.id, status: n.to }} variant="primary">
                        {n.label}
                      </ActionButton>
                    ))}
                    <ActionButton action={deleteRound} hidden={{ eventId, roundId: r.id }} variant="ghost" confirm={`Delete ${r.name}? Its submissions and evaluations will be deleted too.`}>
                      Delete
                    </ActionButton>
                  </div>
                )}
              </div>
              {canEdit && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand-deep">Edit round</summary>
                  <RoundForm eventId={eventId} round={r} />
                </details>
              )}
            </li>
          ))}
        </ol>
        {canEdit && (
          <details className="mt-4 rounded-xl border border-dashed border-line p-4">
            <summary className="cursor-pointer font-semibold text-ink">+ Add round</summary>
            <RoundForm eventId={eventId} nextOrder={rounds.length + 1} />
          </details>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Schedule" eyebrow="Run of show">
          {items.length === 0 ? (
            <EmptyState title="Nothing scheduled" />
          ) : (
            <ol className="relative border-l-2 border-line pl-5">
              {items.map((it) => {
                const past = (it.endsAt ?? it.startsAt).getTime() < now;
                const live = it.startsAt.getTime() <= now && (it.endsAt?.getTime() ?? it.startsAt.getTime()) >= now;
                return (
                  <li key={it.id} className={cn("relative mb-5", past && "opacity-55")}>
                    <span className={cn("absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-paper", live ? "bg-brand" : past ? "bg-line" : "bg-ink")} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm">
                        <span className="font-bold text-ink tabular">{fmtTime(it.startsAt)}</span>
                        {it.endsAt && <span className="text-muted"> – {fmtTime(it.endsAt)}</span>}
                        <span className="ml-2 text-xs text-muted">{fmtDateTime(it.startsAt).split(",")[0]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {live && <Badge tone="solid">Now</Badge>}
                        <Badge>{humanize(it.kind)}</Badge>
                        {canEdit && (
                          <ActionButton action={deleteScheduleItem} hidden={{ eventId, id: it.id }} variant="ghost" confirm="Remove from schedule?">
                            ×
                          </ActionButton>
                        )}
                      </div>
                    </div>
                    <div className="font-semibold text-ink">{it.title}</div>
                    {it.location && <div className="text-xs text-muted">{it.location}</div>}
                  </li>
                );
              })}
            </ol>
          )}
          {canEdit && (
            <ActionForm action={addScheduleItem} hidden={{ eventId }} resetOnSuccess className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <Input name="title" required />
              </Field>
              <Field label="Starts (IST)">
                <Input type="datetime-local" name="startsAt" required />
              </Field>
              <Field label="Ends (optional)">
                <Input type="datetime-local" name="endsAt" />
              </Field>
              <Field label="Kind">
                <Select name="kind" options={["session", "break", "deadline", "judging", "ceremony"].map((k) => ({ value: k, label: humanize(k) }))} />
              </Field>
              <Field label="Location">
                <Input name="location" />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton size="sm">Add to schedule</SubmitButton>
              </div>
            </ActionForm>
          )}
        </Card>

        <Card title="Problem statements" eyebrow={`${ps.length} statements`}>
          <ul className="space-y-4">
            {ps.map((p) => (
              <li key={p.id} className="border-b border-line/70 pb-4 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone="brand">{p.code}</Badge>
                      {p.track && <span className="text-xs text-muted">{p.track}</span>}
                    </div>
                    <div className="mt-1 font-bold text-ink">{p.title}</div>
                    {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
                  </div>
                  {canEdit && (
                    <ActionButton action={deleteProblemStatement} hidden={{ eventId, id: p.id }} variant="ghost" confirm="Delete this problem statement?">
                      ×
                    </ActionButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {canEdit && (
            <ActionForm action={saveProblemStatement} hidden={{ eventId }} resetOnSuccess className="mt-2 grid gap-3 border-t border-line pt-4 sm:grid-cols-[100px_1fr]">
              <Field label="Code">
                <Input name="code" required placeholder={`PS-0${ps.length + 1}`} />
              </Field>
              <Field label="Title">
                <Input name="title" required />
              </Field>
              <Field label="Track">
                <Input name="track" />
              </Field>
              <Field label="Description">
                <Textarea name="description" rows={2} />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton size="sm">Add problem statement</SubmitButton>
              </div>
            </ActionForm>
          )}
        </Card>
      </div>
    </div>
  );
}

function RoundForm({
  eventId,
  round,
  nextOrder,
}: {
  eventId: string;
  round?: { id: string; name: string; description: string | null; order: number; startsAt: Date | null; endsAt: Date | null; submissionDeadline: Date | null; isFinal: boolean };
  nextOrder?: number;
}) {
  return (
    <ActionForm action={saveRound} hidden={{ eventId, roundId: round?.id }} resetOnSuccess={!round} className="mt-3 grid gap-3 sm:grid-cols-4">
      <Field label="Name" className="sm:col-span-3">
        <Input name="name" required defaultValue={round?.name} />
      </Field>
      <Field label="Order">
        <Input type="number" name="order" min={0} defaultValue={round?.order ?? nextOrder ?? 1} />
      </Field>
      <Field label="Description" className="sm:col-span-4">
        <Textarea name="description" rows={2} defaultValue={round?.description ?? ""} />
      </Field>
      <Field label="Starts">
        <Input type="datetime-local" name="startsAt" defaultValue={toLocalInput(round?.startsAt)} />
      </Field>
      <Field label="Ends">
        <Input type="datetime-local" name="endsAt" defaultValue={toLocalInput(round?.endsAt)} />
      </Field>
      <Field label="Submission deadline" className="sm:col-span-2">
        <Input type="datetime-local" name="submissionDeadline" defaultValue={toLocalInput(round?.submissionDeadline)} />
      </Field>
      <div className="flex items-center justify-between gap-3 sm:col-span-4">
        <Checkbox name="isFinal" defaultChecked={round?.isFinal} label="Final round (used for final results)" />
        <SubmitButton size="sm">{round ? "Save round" : "Add round"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
