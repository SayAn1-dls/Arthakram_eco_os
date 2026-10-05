"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  announcements,
  attendanceLogs,
  events,
  participants,
  qrCodes,
  QR_PURPOSES,
  roleAssignments,
  roles,
  rooms,
  teams,
  TIMER_KINDS,
  timers,
  users,
} from "@/db/schema";
import { transition, type TimerAction } from "@/lib/timer";
import { newId, token } from "@/lib/utils";
import { act, UserError } from "../action";
import { audit } from "../audit";
import { notify } from "../notify";
import { requireEventPermission } from "../rbac";
import { checkInParticipant } from "../checkin";

const rev = (eventId: string) => revalidatePath(`/app/events/${eventId}`, "layout");
const ids = (fd: FormData) => String(fd.get("ids") ?? "").split(",").filter(Boolean);

/* ───────── Participants ───────── */

export const addParticipant = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("participants.manage", eventId);
  const email = z.string().trim().toLowerCase().email().parse(fd.get("email"));
  const u = db.select().from(users).where(eq(users.email, email)).get();
  if (!u) throw new UserError("No Arthakram account with that email. Ask them to sign up first.");
  if (db.select().from(participants).where(and(eq(participants.eventId, eventId), eq(participants.userId, u.id))).get())
    throw new UserError(`${u.name} is already registered.`);
  const teamId = String(fd.get("teamId") ?? "") || null;
  db.insert(participants).values({ id: newId("pt_"), eventId, userId: u.id, teamId, status: "confirmed", checkinToken: token(12), college: String(fd.get("college") ?? "") || null }).run();
  const e = db.select({ title: events.title }).from(events).where(eq(events.id, eventId)).get()!;
  notify([u.id], { kind: "event", title: `You've been added to ${e.title}`, link: "/app/my-events" });
  audit({ actorId: user.id, action: "participant.add", resourceType: "participant", eventId, summary: `${user.name} added ${u.name} as a participant` });
  rev(eventId);
  return { ok: true, message: `${u.name} added.` };
});

export const bulkParticipantStatus = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("participants.manage", eventId);
  const status = z.enum(["registered", "confirmed", "waitlisted", "withdrawn"]).parse(fd.get("status"));
  const list = ids(fd);
  if (!list.length) throw new UserError("Select at least one participant.");
  db.update(participants).set({ status }).where(and(eq(participants.eventId, eventId), inArray(participants.id, list))).run();
  audit({ actorId: user.id, action: "participant.bulk_status", resourceType: "participant", eventId, summary: `${user.name} set ${list.length} participant(s) to ${status}` });
  rev(eventId);
});

export const bulkAssignTeam = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("teams.manage", eventId);
  const teamId = String(fd.get("teamId") ?? "");
  const team = db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.eventId, eventId))).get();
  if (!team) throw new UserError("Choose a team.");
  const list = ids(fd);
  db.update(participants).set({ teamId }).where(and(eq(participants.eventId, eventId), inArray(participants.id, list))).run();
  audit({ actorId: user.id, action: "team.assign_members", resourceType: "team", resourceId: teamId, eventId, summary: `${user.name} moved ${list.length} participant(s) into ${team.name}` });
  rev(eventId);
});

export const removeFromTeam = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("teams.manage", eventId);
  const pid = String(fd.get("participantId"));
  db.update(participants).set({ teamId: null, isTeamLead: false }).where(and(eq(participants.id, pid), eq(participants.eventId, eventId))).run();
  audit({ actorId: user.id, action: "team.remove_member", resourceType: "participant", resourceId: pid, eventId, summary: `${user.name} removed a member from a team` });
  rev(eventId);
});

/* ───────── Teams ───────── */

export const saveTeam = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("teams.manage", eventId);
  const data = z
    .object({
      name: z.string().trim().min(2).max(60),
      status: z.enum(["active", "disqualified", "withdrawn"]).default("active"),
      roomId: z.string().optional().transform((v) => v || null),
      problemStatementId: z.string().optional().transform((v) => v || null),
      mentorUserId: z.string().optional().transform((v) => v || null),
    })
    .parse(Object.fromEntries(fd));
  const teamId = String(fd.get("teamId") ?? "");
  if (teamId) {
    const before = db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.eventId, eventId))).get();
    if (!before) throw new UserError("Team not found.");
    db.update(teams).set(data).where(eq(teams.id, teamId)).run();
    if (data.mentorUserId && data.mentorUserId !== before.mentorUserId)
      notify([data.mentorUserId], { kind: "mentor", title: `You're now mentoring ${data.name}`, link: "/app/mentor" });
    audit({ actorId: user.id, action: "team.update", resourceType: "team", resourceId: teamId, eventId, summary: `${user.name} updated team ${data.name}`, before: { status: before.status, roomId: before.roomId, mentorUserId: before.mentorUserId }, after: { status: data.status, roomId: data.roomId, mentorUserId: data.mentorUserId } });
    rev(eventId);
    return { ok: true, message: "Team updated." };
  }
  const n = db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId)).all().length + 1;
  const prefix = String(fd.get("codePrefix") ?? "T");
  const id = newId("tm_");
  db.insert(teams).values({ id, eventId, code: `${prefix}-${String(n).padStart(2, "0")}`, ...data }).run();
  audit({ actorId: user.id, action: "team.create", resourceType: "team", resourceId: id, eventId, summary: `${user.name} created team ${data.name}` });
  rev(eventId);
  return { ok: true, message: `Team ${data.name} created.` };
});

export const deleteTeam = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("teams.manage", eventId);
  const teamId = String(fd.get("teamId"));
  const t = db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.eventId, eventId))).get();
  if (!t) throw new UserError("Team not found.");
  db.delete(teams).where(eq(teams.id, teamId)).run();
  audit({ actorId: user.id, action: "team.delete", resourceType: "team", resourceId: teamId, eventId, summary: `${user.name} deleted team ${t.name}` });
  rev(eventId);
});

export const bulkAssignRoom = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("rooms.manage", eventId);
  const roomId = String(fd.get("roomId") ?? "");
  const room = db.select().from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.eventId, eventId))).get();
  if (!room) throw new UserError("Choose a room.");
  const list = ids(fd);
  db.update(teams).set({ roomId }).where(and(eq(teams.eventId, eventId), inArray(teams.id, list))).run();
  audit({ actorId: user.id, action: "room.assign", resourceType: "room", resourceId: roomId, eventId, summary: `${user.name} assigned ${list.length} team(s) to ${room.name}` });
  rev(eventId);
});

export const bulkTeamStatus = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("teams.manage", eventId);
  const status = z.enum(["active", "disqualified", "withdrawn"]).parse(fd.get("status"));
  const list = ids(fd);
  db.update(teams).set({ status }).where(and(eq(teams.eventId, eventId), inArray(teams.id, list))).run();
  audit({ actorId: user.id, action: "team.bulk_status", resourceType: "team", eventId, summary: `${user.name} set ${list.length} team(s) to ${status}` });
  rev(eventId);
});

/* ───────── Rooms ───────── */

export const saveRoom = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("rooms.manage", eventId);
  const data = z
    .object({
      name: z.string().trim().min(1).max(60),
      location: z.string().optional().transform((v) => v?.trim() || null),
      capacity: z.coerce.number().int().min(0).max(5000),
      notes: z.string().optional().transform((v) => v?.trim() || null),
    })
    .parse(Object.fromEntries(fd));
  const roomId = String(fd.get("roomId") ?? "");
  if (roomId) db.update(rooms).set(data).where(and(eq(rooms.id, roomId), eq(rooms.eventId, eventId))).run();
  else db.insert(rooms).values({ id: newId("rm_"), eventId, ...data }).run();
  audit({ actorId: user.id, action: roomId ? "room.update" : "room.create", resourceType: "room", eventId, summary: `${user.name} ${roomId ? "updated" : "added"} room ${data.name}` });
  rev(eventId);
  return { ok: true, message: "Room saved." };
});

export const deleteRoom = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("rooms.manage", eventId);
  const roomId = String(fd.get("roomId"));
  const r = db.select().from(rooms).where(and(eq(rooms.id, roomId), eq(rooms.eventId, eventId))).get();
  if (!r) throw new UserError("Room not found.");
  db.delete(rooms).where(eq(rooms.id, roomId)).run();
  audit({ actorId: user.id, action: "room.delete", resourceType: "room", eventId, summary: `${user.name} deleted room ${r.name}` });
  rev(eventId);
});

/* ───────── Check-in ───────── */

export const manualCheckIn = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("attendance.manage", eventId);
  const r = await checkInParticipant(eventId, String(fd.get("participantId")), user);
  rev(eventId);
  return { ok: true, message: r.already ? `${r.name} was already checked in.` : `${r.name} checked in.` };
});

export const checkInByCode = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("attendance.manage", eventId);
  const raw = String(fd.get("code") ?? "").trim();
  const code = raw.includes("/checkin/") ? raw.split("/checkin/")[1]!.split(/[?#]/)[0]! : raw;
  const p = db.select({ id: participants.id }).from(participants).where(and(eq(participants.eventId, eventId), eq(participants.checkinToken, code))).get();
  if (!p) throw new UserError("That code doesn't belong to a participant of this event.");
  const r = await checkInParticipant(eventId, p.id, user);
  rev(eventId);
  return { ok: true, message: r.already ? `${r.name} was already checked in.` : `✓ ${r.name} checked in.` };
});

export const undoCheckIn = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("attendance.manage", eventId);
  const pid = String(fd.get("participantId"));
  db.update(participants).set({ checkedInAt: null, checkedInById: null }).where(and(eq(participants.id, pid), eq(participants.eventId, eventId))).run();
  audit({ actorId: user.id, action: "attendance.undo", resourceType: "participant", resourceId: pid, eventId, summary: `${user.name} undid a check-in` });
  rev(eventId);
});

/* ───────── Timers ───────── */

export const createTimer = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("timers.manage", eventId);
  const data = z
    .object({
      label: z.string().trim().min(2).max(80),
      kind: z.enum(TIMER_KINDS),
      hours: z.coerce.number().int().min(0).max(240),
      minutes: z.coerce.number().int().min(0).max(59),
      roundId: z.string().optional().transform((v) => v || null),
    })
    .parse(Object.fromEntries(fd));
  const durationSec = data.hours * 3600 + data.minutes * 60;
  if (durationSec < 60) throw new UserError("Timers must be at least one minute long.");
  db.insert(timers)
    .values({ id: newId("tmr_"), eventId, label: data.label, kind: data.kind, roundId: data.roundId, durationSec, visibleToParticipants: fd.get("visibleToParticipants") === "on" })
    .run();
  audit({ actorId: user.id, action: "timer.create", resourceType: "timer", eventId, summary: `${user.name} created timer “${data.label}”` });
  rev(eventId);
  return { ok: true, message: "Timer created." };
});

export const controlTimer = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("timers.manage", eventId);
  const action = z.enum(["start", "pause", "resume", "reset", "end"]).parse(fd.get("op")) as TimerAction;
  const t = db.select().from(timers).where(and(eq(timers.id, String(fd.get("timerId"))), eq(timers.eventId, eventId))).get();
  if (!t) throw new UserError("Timer not found.");
  const res = transition({ status: t.status, durationSec: t.durationSec, elapsedBeforeSec: t.elapsedBeforeSec, startedAt: t.startedAt?.getTime() ?? null }, action);
  if ("error" in res) throw new UserError(res.error);
  const p = res.patch;
  db.update(timers)
    .set({
      status: p.status,
      elapsedBeforeSec: p.elapsedBeforeSec,
      startedAt: p.startedAt === undefined ? undefined : p.startedAt === null ? null : new Date(p.startedAt),
      endedAt: p.endedAt === undefined ? undefined : p.endedAt === null ? null : new Date(p.endedAt),
      updatedAt: new Date(),
    })
    .where(eq(timers.id, t.id))
    .run();
  const verbs: Record<TimerAction, string> = { start: "started", pause: "paused", resume: "resumed", reset: "reset", end: "ended" };
  audit({ actorId: user.id, action: `timer.${action}`, resourceType: "timer", resourceId: t.id, eventId, summary: `${user.name} ${verbs[action]} ${t.label}` });
  rev(eventId);
});

export const adjustTimer = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("timers.manage", eventId);
  const t = db.select().from(timers).where(and(eq(timers.id, String(fd.get("timerId"))), eq(timers.eventId, eventId))).get();
  if (!t) throw new UserError("Timer not found.");
  const delta = z.coerce.number().int().min(-600).max(600).parse(fd.get("minutes")) * 60;
  const durationSec = Math.max(60, t.durationSec + delta);
  db.update(timers).set({ durationSec, updatedAt: new Date() }).where(eq(timers.id, t.id)).run();
  audit({ actorId: user.id, action: "timer.adjust", resourceType: "timer", resourceId: t.id, eventId, summary: `${user.name} ${delta > 0 ? "extended" : "shortened"} ${t.label} by ${Math.abs(delta / 60)} min`, before: { durationSec: t.durationSec }, after: { durationSec } });
  rev(eventId);
});

export const deleteTimer = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("timers.manage", eventId);
  const t = db.select().from(timers).where(and(eq(timers.id, String(fd.get("timerId"))), eq(timers.eventId, eventId))).get();
  if (!t) throw new UserError("Timer not found.");
  db.delete(timers).where(eq(timers.id, t.id)).run();
  audit({ actorId: user.id, action: "timer.delete", resourceType: "timer", eventId, summary: `${user.name} deleted timer ${t.label}` });
  rev(eventId);
});

/* ───────── QR codes ───────── */

export const createQr = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("qr.manage", eventId);
  const data = z
    .object({
      purpose: z.enum(QR_PURPOSES),
      label: z.string().trim().min(2).max(80),
      roomId: z.string().optional().transform((v) => v || null),
      roundId: z.string().optional().transform((v) => v || null),
    })
    .parse(Object.fromEntries(fd));
  if (data.purpose === "room_entry" && !data.roomId) throw new UserError("Pick the room this QR code is for.");
  db.insert(qrCodes).values({ id: newId("qr_"), eventId, token: token(9), createdById: user.id, ...data }).run();
  audit({ actorId: user.id, action: "qr.create", resourceType: "qr", eventId, summary: `${user.name} generated a ${data.purpose.replace("_", " ")} QR code “${data.label}”` });
  rev(eventId);
  return { ok: true, message: "QR code generated." };
});

export const toggleQr = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("qr.manage", eventId);
  const q = db.select().from(qrCodes).where(and(eq(qrCodes.id, String(fd.get("qrId"))), eq(qrCodes.eventId, eventId))).get();
  if (!q) throw new UserError("QR code not found.");
  db.update(qrCodes).set({ active: !q.active }).where(eq(qrCodes.id, q.id)).run();
  audit({ actorId: user.id, action: "qr.toggle", resourceType: "qr", resourceId: q.id, eventId, summary: `${user.name} ${q.active ? "disabled" : "enabled"} QR “${q.label}”` });
  rev(eventId);
});

export const deleteQr = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("qr.manage", eventId);
  const q = db.select().from(qrCodes).where(and(eq(qrCodes.id, String(fd.get("qrId"))), eq(qrCodes.eventId, eventId))).get();
  if (!q) throw new UserError("QR code not found.");
  db.delete(qrCodes).where(eq(qrCodes.id, q.id)).run();
  audit({ actorId: user.id, action: "qr.delete", resourceType: "qr", eventId, summary: `${user.name} deleted QR “${q.label}”` });
  rev(eventId);
});

/* ───────── Announcements ───────── */

function audienceUserIds(eventId: string, audience: string): string[] {
  const participantIds = () =>
    db.select({ id: participants.userId }).from(participants).where(and(eq(participants.eventId, eventId), eq(participants.status, "confirmed"))).all().map((r) => r.id);
  const roleHolders = (keys: string[]) =>
    db
      .select({ id: roleAssignments.userId })
      .from(roleAssignments)
      .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
      .where(and(eq(roleAssignments.scopeType, "event"), eq(roleAssignments.scopeId, eventId), inArray(roles.key, keys), isNull(roleAssignments.revokedAt)))
      .all()
      .map((r) => r.id);
  const mentorIds = () =>
    db.select({ id: teams.mentorUserId }).from(teams).where(eq(teams.eventId, eventId)).all().map((r) => r.id).filter((x): x is string => !!x);
  switch (audience) {
    case "participants":
      return participantIds();
    case "judges":
      return roleHolders(["judge"]);
    case "mentors":
      return mentorIds();
    case "staff":
      return roleHolders(["organizer", "volunteer", "documentation_manager", "club_lead"]);
    default:
      return [...participantIds(), ...roleHolders(["judge", "organizer", "volunteer"]), ...mentorIds()];
  }
}

export const createAnnouncement = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("announcements.create", eventId);
  const data = z
    .object({
      title: z.string().trim().min(3).max(120),
      body: z.string().trim().min(2).max(4000),
      priority: z.enum(["info", "important", "urgent"]),
      audience: z.enum(["everyone", "participants", "judges", "mentors", "staff"]),
    })
    .parse(Object.fromEntries(fd));
  const id = newId("an_");
  db.insert(announcements).values({ id, eventId, createdById: user.id, pinned: fd.get("pinned") === "on", ...data }).run();
  const recipients = audienceUserIds(eventId, data.audience).filter((u) => u !== user.id);
  const link = data.audience === "judges" ? "/app/judge" : data.audience === "mentors" ? "/app/mentor" : "/app/my-events";
  notify(recipients, { kind: "announcement", title: data.title, body: data.body.slice(0, 180), link });
  audit({ actorId: user.id, action: "announcement.create", resourceType: "announcement", resourceId: id, eventId, summary: `${user.name} announced “${data.title}” to ${data.audience} (${recipients.length} notified)` });
  rev(eventId);
  return { ok: true, message: `Sent to ${recipients.length} ${recipients.length === 1 ? "person" : "people"}.` };
});

export const deleteAnnouncement = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("announcements.create", eventId);
  const a = db.select().from(announcements).where(and(eq(announcements.id, String(fd.get("id"))), eq(announcements.eventId, eventId))).get();
  if (!a) throw new UserError("Not found.");
  db.delete(announcements).where(eq(announcements.id, a.id)).run();
  audit({ actorId: user.id, action: "announcement.delete", resourceType: "announcement", eventId, summary: `${user.name} deleted announcement “${a.title}”` });
  rev(eventId);
});

export const togglePin = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  await requireEventPermission("announcements.create", eventId);
  const a = db.select().from(announcements).where(and(eq(announcements.id, String(fd.get("id"))), eq(announcements.eventId, eventId))).get();
  if (!a) throw new UserError("Not found.");
  db.update(announcements).set({ pinned: !a.pinned }).where(eq(announcements.id, a.id)).run();
  rev(eventId);
});

/* ───────── Event mentors ───────── */

export const assignMentor = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("mentors.create", eventId);
  const team = db.select().from(teams).where(and(eq(teams.id, String(fd.get("teamId"))), eq(teams.eventId, eventId))).get();
  if (!team) throw new UserError("Team not found.");
  const mentorUserId = String(fd.get("mentorUserId") ?? "") || null;
  db.update(teams).set({ mentorUserId }).where(eq(teams.id, team.id)).run();
  if (mentorUserId && mentorUserId !== team.mentorUserId) notify([mentorUserId], { kind: "mentor", title: `You're now mentoring ${team.name}`, link: "/app/mentor" });
  const name = mentorUserId ? db.select({ n: users.name }).from(users).where(eq(users.id, mentorUserId)).get()?.n : null;
  audit({ actorId: user.id, action: "mentor.assign", resourceType: "team", resourceId: team.id, eventId, summary: name ? `${user.name} assigned ${name} to mentor ${team.name}` : `${user.name} removed the mentor from ${team.name}` });
  rev(eventId);
});
