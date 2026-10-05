import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { participants, roleAssignments, teams, type documents } from "@/db/schema";
import { permissionSetAllows } from "@/lib/permissions";
import { eventScope, permissionsAt } from "./rbac";

/** Is this user part of the event in a non-staff capacity (participant / judge / mentor)? */
export function isEventMember(eventId: string, userId: string) {
  const p = db
    .select({ id: participants.id })
    .from(participants)
    .where(and(eq(participants.eventId, eventId), eq(participants.userId, userId), eq(participants.status, "confirmed")))
    .get();
  if (p) return true;
  const m = db.select({ id: teams.id }).from(teams).where(and(eq(teams.eventId, eventId), eq(teams.mentorUserId, userId))).get();
  if (m) return true;
  const r = db
    .select({ id: roleAssignments.id })
    .from(roleAssignments)
    .where(and(eq(roleAssignments.scopeType, "event"), eq(roleAssignments.scopeId, eventId), eq(roleAssignments.userId, userId), isNull(roleAssignments.revokedAt)))
    .get();
  return !!r;
}

type Doc = Pick<typeof documents.$inferSelect, "eventId" | "status" | "visibility">;

/** Server-side read check for a single document. */
export async function canReadDocument(doc: Doc, userId: string | null) {
  if (doc.status === "published" && doc.visibility === "public") return true;
  if (!userId) return false;
  const scope = await eventScope(doc.eventId);
  if (!scope) return false;
  if (permissionSetAllows(await permissionsAt(userId, scope), "documents.view")) return true;
  return doc.status === "published" && doc.visibility === "participants" && isEventMember(doc.eventId, userId);
}
