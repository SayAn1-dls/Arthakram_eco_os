import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { evaluations, rubricCriteria, rubrics } from "@/db/schema";
import { eventAccess, roundsFor } from "@/server/events";
import { deleteCriterion, deleteRubric, saveCriterion, saveRubric } from "@/server/actions/competition";
import { ActionButton, ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Badge, Card, EmptyState, Forbidden, Table, Td, Th } from "@/components/ui";
import { cn } from "@/lib/cn";

export const metadata = { title: "Rubrics" };

export default async function RubricsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { has } = await eventAccess(eventId);
  if (!has("rubrics.view")) return <Forbidden />;
  const canEdit = has("rubrics.manage");
  const rounds = roundsFor(eventId);
  const list = db.select().from(rubrics).where(eq(rubrics.eventId, eventId)).orderBy(asc(rubrics.createdAt)).all();
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-ink-2">
        Rubrics are controlled by admins and authorised organizers. <b>Judges only score against them</b> — they can’t create or modify criteria. Weighted totals are calculated automatically on a 0–100 scale.
      </div>
      {list.length === 0 && <EmptyState title="No rubric yet">Create one before assigning judges.</EmptyState>}
      {list.map((r) => {
        const crit = db.select().from(rubricCriteria).where(eq(rubricCriteria.rubricId, r.id)).orderBy(asc(rubricCriteria.order)).all();
        const total = crit.reduce((a, c) => a + c.weight, 0);
        const used = db.select({ id: evaluations.id }).from(evaluations).where(and(eq(evaluations.rubricId, r.id), eq(evaluations.status, "submitted"))).all().length;
        return (
          <Card
            key={r.id}
            title={r.name}
            eyebrow={r.roundId ? `Round: ${rounds.find((x) => x.id === r.roundId)?.name ?? "?"}` : "Default for all rounds"}
            actions={
              <div className="flex items-center gap-2">
                <Badge tone={total === 100 ? "ok" : "warn"}>Weights total {total}%</Badge>
                {used > 0 && <Badge tone="info">{used} scores submitted · ranges locked</Badge>}
              </div>
            }
          >
            {r.description && <p className="mb-4 text-sm text-muted">{r.description}</p>}
            <Table className="border-0">
              <thead>
                <tr>
                  <Th>Criterion</Th>
                  <Th className="w-24">Weight</Th>
                  <Th className="w-28">Score range</Th>
                  <Th>Scoring guidance</Th>
                  {canEdit && <Th />}
                </tr>
              </thead>
              <tbody>
                {crit.map((c) => (
                  <tr key={c.id}>
                    <Td>
                      <div className="font-semibold text-ink">{c.name}</div>
                      {c.description && <div className="text-xs text-muted">{c.description}</div>}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="tabular font-bold text-ink">{c.weight}%</span>
                      </div>
                      <div className="mt-1 h-1 w-16 rounded bg-paper-2">
                        <div className="h-1 rounded bg-brand" style={{ width: `${Math.min(100, c.weight * 2)}%` }} />
                      </div>
                    </Td>
                    <Td className="tabular">
                      {c.minScore}–{c.maxScore}
                    </Td>
                    <Td className="text-xs">{c.instructions ?? "—"}</Td>
                    {canEdit && (
                      <Td className="text-right">
                        <details className="inline-block text-left">
                          <summary className="cursor-pointer text-xs font-semibold text-brand-deep">Edit</summary>
                          <CriterionForm eventId={eventId} rubricId={r.id} c={c} />
                          <ActionButton action={deleteCriterion} hidden={{ eventId, criterionId: c.id }} variant="ghost" confirm={`Remove “${c.name}”?`}>
                            Remove
                          </ActionButton>
                        </details>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
            {canEdit && (
              <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-t border-line pt-4">
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-ink">+ Add criterion</summary>
                  <CriterionForm eventId={eventId} rubricId={r.id} nextOrder={crit.length} />
                </details>
                <ActionButton action={deleteRubric} hidden={{ eventId, rubricId: r.id }} variant="ghost" confirm={`Delete rubric ${r.name}?`}>
                  Delete rubric
                </ActionButton>
              </div>
            )}
          </Card>
        );
      })}
      {canEdit && (
        <Card title="Create rubric">
          <ActionForm action={saveRubric} hidden={{ eventId }} resetOnSuccess className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <Field label="Name">
              <Input name="name" required placeholder="Final round rubric" />
            </Field>
            <Field label="Applies to">
              <Select name="roundId" options={rounds.map((r) => ({ value: r.id, label: r.name }))} placeholder="All rounds (default)" />
            </Field>
            <SubmitButton>Create</SubmitButton>
            <Field label="Description" className="md:col-span-3">
              <Input name="description" />
            </Field>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

function CriterionForm({
  eventId,
  rubricId,
  c,
  nextOrder,
}: {
  eventId: string;
  rubricId: string;
  c?: { id: string; name: string; description: string | null; instructions: string | null; weight: number; minScore: number; maxScore: number; order: number };
  nextOrder?: number;
}) {
  return (
    <ActionForm action={saveCriterion} hidden={{ eventId, rubricId, criterionId: c?.id }} resetOnSuccess={!c} className={cn("mt-3 grid w-[min(560px,80vw)] gap-2 sm:grid-cols-4")}>
      <Field label="Name" className="sm:col-span-4">
        <Input name="name" required defaultValue={c?.name} />
      </Field>
      <Field label="Weight %">
        <Input type="number" name="weight" min={0} max={100} step="0.5" required defaultValue={c?.weight ?? 20} />
      </Field>
      <Field label="Min">
        <Input type="number" name="minScore" min={0} defaultValue={c?.minScore ?? 0} />
      </Field>
      <Field label="Max">
        <Input type="number" name="maxScore" min={1} defaultValue={c?.maxScore ?? 10} />
      </Field>
      <Field label="Order">
        <Input type="number" name="order" min={0} defaultValue={c?.order ?? nextOrder ?? 0} />
      </Field>
      <Field label="Description" className="sm:col-span-4">
        <Input name="description" defaultValue={c?.description ?? ""} />
      </Field>
      <Field label="Scoring instructions for judges" className="sm:col-span-4">
        <Textarea name="instructions" rows={2} defaultValue={c?.instructions ?? ""} />
      </Field>
      <div className="sm:col-span-4">
        <SubmitButton size="sm">{c ? "Save criterion" : "Add criterion"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
