import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { newId } from "@/lib/utils";

export type AuditEntry = {
  actorId: string | null;
  action: string; // e.g. "event.update", "access.grant"
  resourceType: string;
  resourceId?: string | null;
  eventId?: string | null;
  summary: string; // human sentence: "Sayan edited Event Rules"
  before?: unknown;
  after?: unknown;
};

/** Append-only accountability trail. Never update or delete rows. */
export function audit(entry: AuditEntry) {
  db.insert(auditLogs)
    .values({
      id: newId("al_"),
      actorId: entry.actorId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      eventId: entry.eventId ?? null,
      summary: entry.summary,
      before: entry.before ?? null,
      after: entry.after ?? null,
    })
    .run();
}

/** Only keep keys whose values changed — keeps audit diffs readable. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    const bv = before[k] instanceof Date ? (before[k] as Date).toISOString() : before[k];
    const av = after[k] instanceof Date ? (after[k] as Date).toISOString() : after[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      b[k] = bv;
      a[k] = av;
    }
  }
  return { before: b, after: a, changed: Object.keys(a) };
}
