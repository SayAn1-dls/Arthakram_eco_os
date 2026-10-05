"use server";

import { and, count, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  attendanceLogs,
  clubAssessments,
  clubMembers,
  clubs,
  colleges,
  events,
  MENTOR_WORK_TYPES,
  mentorProfiles,
  mentorRequests,
  mentorReviews,
  notifications,
  participants,
  qrCodes,
  savedOpportunities,
  studentProfiles,
  teams,
  users,
} from "@/db/schema";
import { ASSESSMENT, matchClubs, scoreDimensions } from "@/lib/recommend";
import { newId, parseList, token } from "@/lib/utils";
import { act, UserError } from "../action";
import { audit } from "../audit";
import { requireUser } from "../auth";
import { notify } from "../notify";
import { AuthzError, can, clubScope } from "../rbac";

const url = z.string().trim().url("Enter a full URL (https://…)").or(z.literal("")).optional().transform((v) => v || null);

/* ───────── Profile ───────── */

export const updateProfile = act(async (fd) => {
  const user = await requireUser();
  const data = z
    .object({
      name: z.string().trim().min(2).max(80),
      headline: z.string().max(120).optional().transform((v) => v?.trim() || null),
      collegeId: z.string().optional().transform((v) => v || null),
      program: z.string().max(80).optional().transform((v) => v?.trim() || null),
      year: z.coerce.number().int().min(1).max(6).optional().or(z.literal("").transform(() => undefined)),
      bio: z.string().max(1000).optional().transform((v) => v?.trim() || null),
      weeklyHours: z.coerce.number().int().min(0).max(60).optional().or(z.literal("").transform(() => undefined)),
      linkedinUrl: url,
      githubUrl: url,
      portfolioUrl: url,
    })
    .parse(Object.fromEntries(fd));
  if (data.collegeId && !db.select().from(colleges).where(eq(colleges.id, data.collegeId)).get()) throw new UserError("Unknown college.");
  const profile = {
    collegeId: data.collegeId,
    program: data.program,
    year: data.year ?? null,
    bio: data.bio,
    weeklyHours: data.weeklyHours ?? null,
    linkedinUrl: data.linkedinUrl,
    githubUrl: data.githubUrl,
    portfolioUrl: data.portfolioUrl,
    interests: parseList(fd.get("interests")).map((s) => s.toLowerCase()).slice(0, 15),
    skills: parseList(fd.get("skills")).map((s) => s.toLowerCase()).slice(0, 20),
    careerGoals: parseList(fd.get("careerGoals")).map((s) => s.toLowerCase()).slice(0, 5),
    updatedAt: new Date(),
  };
  db.update(users).set({ name: data.name, headline: data.headline }).where(eq(users.id, user.id)).run();
  db.insert(studentProfiles).values({ userId: user.id, ...profile }).onConflictDoUpdate({ target: studentProfiles.userId, set: profile }).run();
  revalidatePath("/app", "layout");
  return { ok: true, message: "Profile saved. Your recommendations have been refreshed." };
});

/* ───────── Find My Club ───────── */

export const submitAssessment = act(async (fd) => {
  const user = await requireUser();
  const answers: Record<string, string | number> = {};
  for (const q of ASSESSMENT) {
    const v = fd.get(q.id);
    if (v == null || v === "") throw new UserError(`Please answer: “${q.prompt}”`);
    if (q.kind === "scale") {
      const n = Number(v);
      if (!(n >= 1 && n <= 5)) throw new UserError("Invalid answer.");
      answers[q.id] = n;
    } else {
      if (!q.options.some((o) => o.value === v)) throw new UserError("Invalid answer.");
      answers[q.id] = String(v);
    }
  }
  const dims = scoreDimensions(answers);
  const allClubs = db.select({ id: clubs.id, name: clubs.name, traits: clubs.traits }).from(clubs).all();
  const results = matchClubs(dims, allClubs).slice(0, 8);
  db.insert(clubAssessments).values({ id: newId("ca_"), userId: user.id, answers, dimensionScores: dims, results }).run();
  if (answers.q_hours) {
    db.insert(studentProfiles).values({ userId: user.id, weeklyHours: Number(answers.q_hours) }).onConflictDoUpdate({ target: studentProfiles.userId, set: { weeklyHours: Number(answers.q_hours) } }).run();
  }
  redirect("/app/find-my-club?done=1");
});

/* ───────── Clubs ───────── */

export const requestJoinClub = act(async (fd) => {
  const user = await requireUser();
  const club = db.select().from(clubs).where(eq(clubs.id, String(fd.get("clubId")))).get();
  if (!club) throw new UserError("Club not found.");
  if (!club.isRecruiting) throw new UserError(`${club.name} isn't recruiting right now.`);
  if (db.select().from(clubMembers).where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, user.id))).get())
    throw new UserError("You've already requested to join.");
  db.insert(clubMembers).values({ clubId: club.id, userId: user.id, status: "pending" }).run();
  // Tell everyone who can approve members for this club.
  const leads = db.select({ id: clubMembers.userId }).from(clubMembers).where(and(eq(clubMembers.clubId, club.id), eq(clubMembers.role, "lead"))).all().map((r) => r.id);
  notify(leads, { kind: "club", title: `${user.name} wants to join ${club.name}`, link: `/clubs/${club.slug}` });
  revalidatePath(`/clubs/${club.slug}`);
  revalidatePath("/app", "layout");
  return { ok: true, message: "Request sent — a club lead will review it." };
});

export const leaveClub = act(async (fd) => {
  const user = await requireUser();
  const clubId = String(fd.get("clubId"));
  db.delete(clubMembers).where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, user.id))).run();
  revalidatePath("/app", "layout");
  revalidatePath("/clubs", "layout");
});

export const decideMember = act(async (fd) => {
  const user = await requireUser();
  const clubId = String(fd.get("clubId"));
  const scope = await clubScope(clubId);
  if (!scope || !(await can(user.id, "clubs.approve", scope))) throw new AuthzError();
  const memberId = String(fd.get("userId"));
  const approve = fd.get("decision") === "approve";
  const club = db.select().from(clubs).where(eq(clubs.id, clubId)).get()!;
  if (approve) db.update(clubMembers).set({ status: "active" }).where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, memberId))).run();
  else db.delete(clubMembers).where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, memberId))).run();
  notify([memberId], { kind: "club", title: approve ? `Welcome to ${club.name}!` : `Your request to join ${club.name} wasn't approved this time`, link: `/clubs/${club.slug}` });
  audit({ actorId: user.id, action: approve ? "club.member_approve" : "club.member_reject", resourceType: "club", resourceId: clubId, summary: `${user.name} ${approve ? "approved" : "declined"} a membership request for ${club.name}` });
  revalidatePath(`/clubs/${club.slug}`);
});

/* ───────── Event registration & teams ───────── */

export const registerForEvent = act(async (fd) => {
  const user = await requireUser();
  const e = db.select().from(events).where(eq(events.id, String(fd.get("eventId")))).get();
  if (!e || e.visibility !== "public" || e.status === "draft") throw new UserError("Event not found.");
  if (!e.registrationOpen) throw new UserError("Registration is closed.");
  if (e.registrationDeadline && e.registrationDeadline < new Date()) throw new UserError("The registration deadline has passed.");
  if (db.select().from(participants).where(and(eq(participants.eventId, e.id), eq(participants.userId, user.id))).get()) throw new UserError("You're already registered.");
  const profile = db.select().from(studentProfiles).where(eq(studentProfiles.userId, user.id)).get();
  const college = profile?.collegeId ? db.select({ n: colleges.name }).from(colleges).where(eq(colleges.id, profile.collegeId)).get()?.n : null;
  db.insert(participants).values({ id: newId("pt_"), eventId: e.id, userId: user.id, status: "confirmed", checkinToken: token(12), college: college ?? null }).run();
  audit({ actorId: user.id, action: "participant.register", resourceType: "participant", eventId: e.id, summary: `${user.name} registered for ${e.title}` });
  revalidatePath(`/events/${e.slug}`);
  revalidatePath("/app", "layout");
  return { ok: true, message: e.teamSizeMax > 1 ? "You're in! Next: create or join a team from My Events." : "You're registered!" };
});

export const withdrawFromEvent = act(async (fd) => {
  const user = await requireUser();
  const eventId = String(fd.get("eventId"));
  const p = db.select().from(participants).where(and(eq(participants.eventId, eventId), eq(participants.userId, user.id))).get();
  if (!p) throw new UserError("You're not registered.");
  const e = db.select().from(events).where(eq(events.id, eventId)).get()!;
  if (e.status === "live" || e.status === "completed") throw new UserError("The event has started — contact the organizers.");
  db.delete(participants).where(eq(participants.id, p.id)).run();
  revalidatePath("/app", "layout");
});

function myParticipant(eventId: string, userId: string) {
  const p = db.select().from(participants).where(and(eq(participants.eventId, eventId), eq(participants.userId, userId))).get();
  if (!p || p.status === "withdrawn") throw new UserError("Register for the event first.");
  return p;
}

export const createTeam = act(async (fd) => {
  const user = await requireUser();
  const eventId = String(fd.get("eventId"));
  const name = z.string().trim().min(2, "Team name is too short").max(40).parse(fd.get("name"));
  const p = myParticipant(eventId, user.id);
  if (p.teamId) throw new UserError("You're already in a team.");
  const e = db.select().from(events).where(eq(events.id, eventId)).get()!;
  if (e.status === "completed" || e.status === "archived") throw new UserError("This event has ended.");
  if (db.select().from(teams).where(and(eq(teams.eventId, eventId), eq(teams.name, name))).get()) throw new UserError("That team name is taken.");
  const n = (db.select({ n: count() }).from(teams).where(eq(teams.eventId, eventId)).get()?.n ?? 0) + 1;
  const id = newId("tm_");
  db.insert(teams).values({ id, eventId, name, code: `T-${String(n).padStart(2, "0")}` }).run();
  db.update(participants).set({ teamId: id, isTeamLead: true }).where(eq(participants.id, p.id)).run();
  audit({ actorId: user.id, action: "team.create", resourceType: "team", resourceId: id, eventId, summary: `${user.name} created team ${name}` });
  redirect(`/app/team/${id}`);
});

export const joinTeam = act(async (fd) => {
  const user = await requireUser();
  const eventId = String(fd.get("eventId"));
  const code = String(fd.get("inviteCode") ?? "").trim();
  const p = myParticipant(eventId, user.id);
  if (p.teamId) throw new UserError("Leave your current team first.");
  const team = db.select().from(teams).where(and(eq(teams.id, code), eq(teams.eventId, eventId))).get();
  if (!team) throw new UserError("Invalid invite code. Ask your team lead to copy it from the team page.");
  const e = db.select().from(events).where(eq(events.id, eventId)).get()!;
  const size = db.select({ n: count() }).from(participants).where(eq(participants.teamId, team.id)).get()?.n ?? 0;
  if (size >= e.teamSizeMax) throw new UserError(`${team.name} is full (max ${e.teamSizeMax}).`);
  db.update(participants).set({ teamId: team.id, isTeamLead: false }).where(eq(participants.id, p.id)).run();
  const mates = db.select({ id: participants.userId }).from(participants).where(and(eq(participants.teamId, team.id), ne(participants.userId, user.id))).all().map((r) => r.id);
  notify(mates, { kind: "team", title: `${user.name} joined ${team.name}`, link: `/app/team/${team.id}` });
  redirect(`/app/team/${team.id}`);
});

export const leaveTeam = act(async (fd) => {
  const user = await requireUser();
  const teamId = String(fd.get("teamId"));
  const p = db.select().from(participants).where(and(eq(participants.teamId, teamId), eq(participants.userId, user.id))).get();
  if (!p) throw new UserError("You're not in this team.");
  const e = db.select().from(events).where(eq(events.id, p.eventId)).get()!;
  if (e.status === "live") throw new UserError("Teams are locked while the event is live. Ask an organizer.");
  db.update(participants).set({ teamId: null, isTeamLead: false }).where(eq(participants.id, p.id)).run();
  if (p.isTeamLead) {
    const next = db.select().from(participants).where(eq(participants.teamId, teamId)).get();
    if (next) db.update(participants).set({ isTeamLead: true }).where(eq(participants.id, next.id)).run();
    else db.delete(teams).where(eq(teams.id, teamId)).run();
  }
  redirect("/app/my-events");
});

/* ───────── Opportunities ───────── */

export const toggleSaveOpportunity = act(async (fd) => {
  const user = await requireUser();
  const id = String(fd.get("opportunityId"));
  const existing = db.select().from(savedOpportunities).where(and(eq(savedOpportunities.userId, user.id), eq(savedOpportunities.opportunityId, id))).get();
  if (existing) db.delete(savedOpportunities).where(and(eq(savedOpportunities.userId, user.id), eq(savedOpportunities.opportunityId, id))).run();
  else db.insert(savedOpportunities).values({ userId: user.id, opportunityId: id }).run();
  revalidatePath("/app/opportunities");
});

/* ───────── Mentorship ───────── */

export const requestMentor = act(async (fd) => {
  const user = await requireUser();
  const data = z
    .object({
      mentorId: z.string().min(1),
      topic: z.string().trim().min(4, "Describe what you need reviewed").max(140),
      message: z.string().max(2000).optional().transform((v) => v?.trim() || null),
      workType: z.enum(MENTOR_WORK_TYPES),
      workUrl: url,
    })
    .parse(Object.fromEntries(fd));
  if (data.mentorId === user.id) throw new UserError("You can't request yourself.");
  const mentor = db.select().from(mentorProfiles).where(and(eq(mentorProfiles.userId, data.mentorId), eq(mentorProfiles.status, "approved"))).get();
  if (!mentor) throw new UserError("This mentor isn't accepting requests.");
  const open = db.select().from(mentorRequests).where(and(eq(mentorRequests.studentId, user.id), eq(mentorRequests.mentorId, data.mentorId), eq(mentorRequests.status, "pending"))).get();
  if (open) throw new UserError("You already have a pending request with this mentor.");
  db.insert(mentorRequests).values({ id: newId("mr_"), studentId: user.id, ...data }).run();
  notify([data.mentorId], { kind: "mentor", title: `New mentorship request from ${user.name}`, body: data.topic, link: "/app/mentor" });
  revalidatePath("/app/mentorship");
  return { ok: true, message: "Request sent. You'll be notified when the mentor responds." };
});

export const respondMentorRequest = act(async (fd) => {
  const user = await requireUser();
  const req = db.select().from(mentorRequests).where(and(eq(mentorRequests.id, String(fd.get("requestId"))), eq(mentorRequests.mentorId, user.id))).get();
  if (!req) throw new UserError("Request not found.");
  if (req.status !== "pending") throw new UserError("Already responded.");
  const status = fd.get("decision") === "accept" ? "accepted" : "declined";
  db.update(mentorRequests).set({ status, respondedAt: new Date() }).where(eq(mentorRequests.id, req.id)).run();
  notify([req.studentId], { kind: "mentor", title: `${user.name} ${status} your request: ${req.topic}`, link: "/app/mentorship" });
  revalidatePath("/app/mentor");
});

export const submitMentorReview = act(async (fd) => {
  const user = await requireUser();
  if (!(await can(user.id, "mentoring.submit"))) throw new AuthzError("Only approved mentors can submit reviews.");
  const req = db.select().from(mentorRequests).where(and(eq(mentorRequests.id, String(fd.get("requestId"))), eq(mentorRequests.mentorId, user.id))).get();
  if (!req || req.status !== "accepted") throw new UserError("Accept the request before reviewing.");
  const dims = ["Problem solving", "Communication", "Business thinking", "Presentation"];
  const scores = dims.map((dimension, i) => ({ dimension, score: z.coerce.number().int().min(1).max(10).parse(fd.get(`score_${i}`)) }));
  const text = z.string().trim().min(10, "Write at least a sentence").max(3000);
  const data = z
    .object({ strengths: text, weaknesses: text, improvements: z.string().max(3000).optional().transform((v) => v?.trim() || null), nextSteps: z.string().max(3000).optional().transform((v) => v?.trim() || null) })
    .parse(Object.fromEntries(fd));
  db.insert(mentorReviews).values({ id: newId("mv_"), requestId: req.id, mentorId: user.id, studentId: req.studentId, title: req.topic, workType: req.workType, scores, ...data }).run();
  db.update(mentorRequests).set({ status: "completed" }).where(eq(mentorRequests.id, req.id)).run();
  notify([req.studentId], { kind: "mentor", title: `${user.name} reviewed “${req.topic}”`, body: "Your feedback is now on your Student Passport.", link: "/app/mentorship" });
  revalidatePath("/app/mentor");
  return { ok: true, message: "Review sent. It's now part of the student's development record." };
});

export const saveMentorProfile = act(async (fd) => {
  const user = await requireUser();
  const data = z
    .object({
      headline: z.string().trim().min(4).max(120),
      bio: z.string().max(1500).optional().transform((v) => v?.trim() || null),
      industry: z.string().max(80).optional().transform((v) => v?.trim() || null),
      experienceYears: z.coerce.number().int().min(0).max(60),
      availability: z.string().max(120).optional().transform((v) => v?.trim() || null),
      linkedinUrl: url,
    })
    .parse(Object.fromEntries(fd));
  const lists = {
    expertise: parseList(fd.get("expertise")).slice(0, 10),
    skills: parseList(fd.get("skills")).map((s) => s.toLowerCase()).slice(0, 15),
    categories: parseList(fd.get("categories")).map((s) => s.toLowerCase()).slice(0, 10),
  };
  const existing = db.select().from(mentorProfiles).where(eq(mentorProfiles.userId, user.id)).get();
  if (existing) db.update(mentorProfiles).set({ ...data, ...lists }).where(eq(mentorProfiles.userId, user.id)).run();
  else {
    db.insert(mentorProfiles).values({ userId: user.id, ...data, ...lists, status: "pending" }).run();
    audit({ actorId: user.id, action: "mentor.apply", resourceType: "mentor_profile", resourceId: user.id, summary: `${user.name} applied to become a mentor` });
  }
  revalidatePath("/app/mentor");
  return { ok: true, message: existing ? "Profile updated." : "Application sent. An admin will review your mentor profile." };
});

/* ───────── Notifications ───────── */

export const markAllRead = act(async () => {
  const user = await requireUser();
  db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))).run();
  revalidatePath("/app", "layout");
});

/* ───────── QR scans by participants ───────── */

export const qrSelfAction = act(async (fd) => {
  const user = await requireUser();
  const q = db.select().from(qrCodes).where(eq(qrCodes.token, String(fd.get("token")))).get();
  if (!q || !q.active) throw new UserError("This QR code is no longer active.");
  if (!["checkin", "attendance", "room_entry"].includes(q.purpose)) throw new UserError("Nothing to confirm for this code.");
  const p = db.select().from(participants).where(and(eq(participants.eventId, q.eventId), eq(participants.userId, user.id))).get();
  if (!p || p.status !== "confirmed") throw new UserError("You're not a confirmed participant of this event.");
  if (q.purpose === "checkin" && !p.checkedInAt) {
    db.update(participants).set({ checkedInAt: new Date(), checkedInById: user.id }).where(eq(participants.id, p.id)).run();
    audit({ actorId: user.id, action: "attendance.self_checkin", resourceType: "participant", resourceId: p.id, eventId: q.eventId, summary: `${user.name} checked in via QR “${q.label}”` });
  }
  db.insert(attendanceLogs)
    .values({ id: newId("at_"), eventId: q.eventId, participantId: p.id, kind: q.purpose === "room_entry" ? "room_entry" : q.purpose === "checkin" ? "checkin" : "session", roomId: q.roomId, recordedById: user.id })
    .run();
  return { ok: true, message: q.purpose === "checkin" ? "You're checked in. Welcome!" : q.purpose === "room_entry" ? "Room entry recorded." : "Attendance recorded." };
});
