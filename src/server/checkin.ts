import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attendanceLogs, participants, users } from "@/db/schema";
import { newId } from "@/lib/utils";
import { UserError } from "./action";
import { audit } from "./audit";

/** Internal helper — callers must have checked `attendance.manage` first. */
export async function checkInParticipant(eventId: string, participantId: string, actor: { id: string; name: string }, roomId?: string | null) {
  const p = db
    .select({ id: participants.id, checkedInAt: participants.checkedInAt, name: users.name })
    .from(participants)
    .innerJoin(users, eq(users.id, participants.userId))
    .where(and(eq(participants.id, participantId), eq(participants.eventId, eventId)))
    .get();
  if (!p) throw new UserError("Participant not found for this event.");
  const already = !!p.checkedInAt;
  if (!already) db.update(participants).set({ checkedInAt: new Date(), checkedInById: actor.id }).where(eq(participants.id, p.id)).run();
  db.insert(attendanceLogs).values({ id: newId("at_"), eventId, participantId: p.id, kind: roomId ? "room_entry" : "checkin", roomId: roomId ?? null, recordedById: actor.id }).run();
  if (!already) audit({ actorId: actor.id, action: "attendance.checkin", resourceType: "participant", resourceId: p.id, eventId, summary: `${actor.name} checked in ${p.name}` });
  return { name: p.name, already };
}

