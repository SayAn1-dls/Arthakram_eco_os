"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { parseLocalInput } from "@/lib/datetime";
import {
  clubs,
  documents,
  EVENT_TYPES,
  eventRounds,
  events,
  problemStatements,
  rubricCriteria,
  rubrics,
  scheduleItems,
} from "@/db/schema";
import { newId, parseList, slugify } from "@/lib/utils";
import { act, UserError } from "../action";
import { audit, diff } from "../audit";
import { requireUser } from "../auth";
import { AuthzError, can, clubScope, requireEventPermission, type Scope } from "../rbac";

const optDate = z
  .string()
  .optional()
  .transform((v) => (v ? parseLocalInput(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Invalid date");
const reqDate = z
  .string()
  .min(1, "Required")
  .transform((v) => parseLocalInput(v))
  .refine((d) => !Number.isNaN(d.getTime()), "Invalid date");
const optText = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : null));

const eventFields = z.object({
  title: z.string().trim().min(3, "Give the event a name").max(120),
  type: z.enum(EVENT_TYPES),
  tagline: optText,
  description: optText,
  mode: z.enum(["online", "offline", "hybrid"]),
  venue: optText,
  startsAt: reqDate,
  endsAt: reqDate,
  registrationDeadline: optDate,
  teamSizeMin: z.coerce.number().int().min(1).max(20),
  teamSizeMax: z.coerce.number().int().min(1).max(20),
  eligibility: optText,
  rules: optText,
  prizes: optText,
  contactEmail: optText,
  visibility: z.enum(["public", "private"]),
});

function parseEvent(fd: FormData) {
  const data = eventFields.parse(Object.fromEntries(fd));
  if (data.endsAt < data.startsAt) throw new UserError("The event must end after it starts.");
  if (data.teamSizeMax < data.teamSizeMin) throw new UserError("Maximum team size must be ≥ minimum.");
  return {
    ...data,
    sponsors: parseList(fd.get("sponsors")),
    tags: parseList(fd.get("tags")).map((t) => t.toLowerCase()),
    allowJudgeEditAfterSubmit: fd.get("allowJudgeEditAfterSubmit") === "on",
  };
}

const RUBRIC_TEMPLATES: Record<string, { name: string; weight: number; description: string }[]> = {
  build: [
    { name: "Problem Understanding", weight: 20, description: "Clarity of user and pain, backed by evidence." },
    { name: "Innovation", weight: 20, description: "Non-obvious insight or approach." },
    { name: "Technical Implementation", weight: 25, description: "Does it work? Appropriate build." },
    { name: "Business Value", weight: 20, description: "Would someone use or pay for it?" },
    { name: "Presentation", weight: 15, description: "Clarity of story and demo." },
  ],
  case: [
    { name: "Structure & Logic", weight: 30, description: "MECE, hypothesis-driven structure." },
    { name: "Insight & Analysis", weight: 30, description: "Quality of analysis and numbers." },
    { name: "Recommendation", weight: 25, description: "Actionable, prioritised recommendation." },
    { name: "Delivery", weight: 15, description: "Storyline and Q&A." },
  ],
  speaking: [
    { name: "Content", weight: 40, description: "Substance and research." },
    { name: "Argumentation", weight: 30, description: "Logic and rebuttal." },
    { name: "Delivery", weight: 30, description: "Clarity and presence." },
  ],
};

function templateFor(type: string) {
  if (["consulting_case", "business_competition", "marketing_competition"].includes(type)) return RUBRIC_TEMPLATES.case!;
  if (["mun", "debate"].includes(type)) return RUBRIC_TEMPLATES.speaking!;
  if (["workshop", "seminar", "conference", "sports_esports", "other"].includes(type)) return null;
  return RUBRIC_TEMPLATES.build!;
}

export const createEvent = act(async (fd) => {
  const user = await requireUser();
  const data = parseEvent(fd);
  const clubId = String(fd.get("clubId") ?? "");
  const club = clubId ? db.select().from(clubs).where(eq(clubs.id, clubId)).get() : null;
  if (!club) throw new UserError("Choose the club or organization hosting this event.");
  const scope = (await clubScope(club.id)) as Scope;
  if (!(await can(user.id, "events.create", scope))) throw new AuthzError("You can't create events for this club.");

  let slug = slugify(data.title) || "event";
  if (db.select({ id: events.id }).from(events).where(eq(events.slug, slug)).get()) slug = `${slug}-${newId().slice(0, 4).toLowerCase()}`;
  const id = newId("ev_");
  db.insert(events)
    .values({ id, slug, organizationId: club.organizationId, collegeId: club.collegeId, clubId: club.id, createdById: user.id, status: "draft", ...data })
    .run();

  // Starter kit: rounds, documentation skeleton, rubric template.
  if (fd.get("starterKit") === "on") {
    const finalId = newId("rd_");
    db.insert(eventRounds)
      .values([
        { id: newId("rd_"), eventId: id, name: "Round 1", order: 1 },
        { id: finalId, eventId: id, name: "Final Round", order: 2, isFinal: true },
      ])
      .run();
    const skeleton: [typeof documents.$inferInsert.section, string, string, "internal" | "participants" | "public"][] = [
      ["overview", "Event overview", data.description ?? "", "public"],
      ["rules", "Rules & code of conduct", data.rules ?? "", "participants"],
      ["problem_statements", "Problem statements", "", "participants"],
      ["schedule", "Run of show", "", "internal"],
      ["judges", "Judge briefing", "", "internal"],
      ["final_report", "Final report", "", "internal"],
    ];
    db.insert(documents)
      .values(skeleton.map(([section, title, content, visibility], i) => ({ id: newId("doc_"), eventId: id, section, title, content, visibility, order: i, createdById: user.id, updatedById: user.id })))
      .run();
    const tpl = templateFor(data.type);
    if (tpl) {
      const rid = newId("rb_");
      db.insert(rubrics).values({ id: rid, eventId: id, name: "Main rubric", description: "Starter template — edit before judging.", createdById: user.id }).run();
      db.insert(rubricCriteria)
        .values(tpl.map((c, i) => ({ id: newId("cr_"), rubricId: rid, order: i, minScore: 0, maxScore: 10, ...c })))
        .run();
    }
  }
  audit({ actorId: user.id, action: "event.create", resourceType: "event", resourceId: id, eventId: id, summary: `${user.name} created ${data.title}` });
  redirect(`/app/events/${id}/setup?created=1`);
});

export const updateEvent = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("events.edit", eventId);
  const before = db.select().from(events).where(eq(events.id, eventId)).get()!;
  const data = parseEvent(fd);
  const d = diff(before as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>);
  db.update(events).set({ ...data, updatedAt: new Date() }).where(eq(events.id, eventId)).run();
  if (d.changed.length)
    audit({
      actorId: user.id,
      action: "event.update",
      resourceType: "event",
      resourceId: eventId,
      eventId,
      summary: `${user.name} edited ${d.changed.length === 1 ? `event ${d.changed[0]}` : `${d.changed.length} event fields`} (${d.changed.slice(0, 4).join(", ")})`,
      before: d.before,
      after: d.after,
    });
  revalidatePath(`/app/events/${eventId}`, "layout");
  return { ok: true, message: d.changed.length ? "Event updated." : "No changes." };
});

const STATUS_FLOW: Record<string, string[]> = {
  draft: ["published"],
  published: ["draft", "live"],
  live: ["completed"],
  completed: ["live", "archived"],
  archived: ["completed"],
};

export const setEventStatus = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const to = z.enum(["draft", "published", "live", "completed", "archived"]).parse(fd.get("status"));
  const { user } = await requireEventPermission("events.publish", eventId);
  const e = db.select().from(events).where(eq(events.id, eventId)).get()!;
  if (!STATUS_FLOW[e.status]?.includes(to)) throw new UserError(`Can't move from ${e.status} to ${to}.`);
  const patch: Partial<typeof events.$inferInsert> = { status: to, updatedAt: new Date() };
  if (to === "published" && e.registrationDeadline && e.registrationDeadline > new Date()) patch.registrationOpen = true;
  if (to === "live" || to === "completed" || to === "archived") patch.registrationOpen = false;
  db.update(events).set(patch).where(eq(events.id, eventId)).run();
  audit({ actorId: user.id, action: `event.${to}`, resourceType: "event", resourceId: eventId, eventId, summary: `${user.name} moved ${e.title} from ${e.status} to ${to}`, before: { status: e.status }, after: { status: to } });
  revalidatePath(`/app/events/${eventId}`, "layout");
  return { ok: true, message: `Event is now ${to}.` };
});

export const toggleRegistration = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("events.edit", eventId);
  const e = db.select().from(events).where(eq(events.id, eventId)).get()!;
  if (!e.registrationOpen && (e.status === "draft" || e.status === "archived")) throw new UserError("Publish the event before opening registration.");
  db.update(events).set({ registrationOpen: !e.registrationOpen }).where(eq(events.id, eventId)).run();
  audit({ actorId: user.id, action: "event.registration", resourceType: "event", resourceId: eventId, eventId, summary: `${user.name} ${e.registrationOpen ? "closed" : "opened"} registration for ${e.title}` });
  revalidatePath(`/app/events/${eventId}`, "layout");
});

export const deleteEvent = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("events.delete", eventId);
  const e = db.select().from(events).where(eq(events.id, eventId)).get()!;
  if (fd.get("confirmTitle") !== e.title) throw new UserError("Type the exact event name to confirm deletion.");
  db.delete(events).where(eq(events.id, eventId)).run();
  audit({ actorId: user.id, action: "event.delete", resourceType: "event", resourceId: eventId, summary: `${user.name} deleted event ${e.title}`, before: { title: e.title, status: e.status } });
  redirect("/app/events");
});

/* ───────── Rounds ───────── */

export const saveRound = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("schedule.manage", eventId);
  const data = z
    .object({
      name: z.string().trim().min(2).max(80),
      description: optText,
      startsAt: optDate,
      endsAt: optDate,
      submissionDeadline: optDate,
      order: z.coerce.number().int().min(0).max(99),
    })
    .parse(Object.fromEntries(fd));
  const roundId = String(fd.get("roundId") ?? "");
  const isFinal = fd.get("isFinal") === "on";
  if (roundId) {
    db.update(eventRounds).set({ ...data, isFinal }).where(and(eq(eventRounds.id, roundId), eq(eventRounds.eventId, eventId))).run();
    audit({ actorId: user.id, action: "round.update", resourceType: "round", resourceId: roundId, eventId, summary: `${user.name} edited ${data.name}` });
  } else {
    const id = newId("rd_");
    db.insert(eventRounds).values({ id, eventId, ...data, isFinal }).run();
    audit({ actorId: user.id, action: "round.create", resourceType: "round", resourceId: id, eventId, summary: `${user.name} added ${data.name}` });
  }
  revalidatePath(`/app/events/${eventId}`, "layout");
  return { ok: true, message: "Round saved." };
});

export const setRoundStatus = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const roundId = String(fd.get("roundId"));
  const status = z.enum(["upcoming", "active", "judging", "completed"]).parse(fd.get("status"));
  const { user } = await requireEventPermission("schedule.manage", eventId);
  const r = db.select().from(eventRounds).where(and(eq(eventRounds.id, roundId), eq(eventRounds.eventId, eventId))).get();
  if (!r) throw new UserError("Round not found.");
  db.update(eventRounds).set({ status }).where(eq(eventRounds.id, roundId)).run();
  if (status === "active" || status === "judging") db.update(events).set({ currentRoundId: roundId }).where(eq(events.id, eventId)).run();
  audit({ actorId: user.id, action: "round.status", resourceType: "round", resourceId: roundId, eventId, summary: `${user.name} set ${r.name} to ${status}`, before: { status: r.status }, after: { status } });
  revalidatePath(`/app/events/${eventId}`, "layout");
});

export const deleteRound = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const roundId = String(fd.get("roundId"));
  const { user } = await requireEventPermission("schedule.manage", eventId);
  const r = db.select().from(eventRounds).where(and(eq(eventRounds.id, roundId), eq(eventRounds.eventId, eventId))).get();
  if (!r) throw new UserError("Round not found.");
  db.delete(eventRounds).where(eq(eventRounds.id, roundId)).run();
  audit({ actorId: user.id, action: "round.delete", resourceType: "round", resourceId: roundId, eventId, summary: `${user.name} deleted ${r.name}` });
  revalidatePath(`/app/events/${eventId}`, "layout");
});

/* ───────── Schedule & problem statements ───────── */

export const addScheduleItem = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("schedule.manage", eventId);
  const data = z
    .object({
      title: z.string().trim().min(2).max(120),
      kind: z.enum(["session", "break", "deadline", "judging", "ceremony"]),
      startsAt: reqDate,
      endsAt: optDate,
      location: optText,
      description: optText,
    })
    .parse(Object.fromEntries(fd));
  db.insert(scheduleItems).values({ id: newId("si_"), eventId, ...data }).run();
  audit({ actorId: user.id, action: "schedule.create", resourceType: "schedule", eventId, summary: `${user.name} added “${data.title}” to the schedule` });
  revalidatePath(`/app/events/${eventId}`, "layout");
  return { ok: true, message: "Added to schedule." };
});

export const deleteScheduleItem = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("schedule.manage", eventId);
  const id = String(fd.get("id"));
  const it = db.select().from(scheduleItems).where(and(eq(scheduleItems.id, id), eq(scheduleItems.eventId, eventId))).get();
  if (!it) throw new UserError("Not found.");
  db.delete(scheduleItems).where(eq(scheduleItems.id, id)).run();
  audit({ actorId: user.id, action: "schedule.delete", resourceType: "schedule", eventId, summary: `${user.name} removed “${it.title}” from the schedule` });
  revalidatePath(`/app/events/${eventId}`, "layout");
});

export const saveProblemStatement = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("schedule.manage", eventId);
  const data = z
    .object({ code: z.string().trim().min(1).max(12), title: z.string().trim().min(3).max(160), track: optText, description: optText })
    .parse(Object.fromEntries(fd));
  const id = String(fd.get("id") ?? "");
  if (id) db.update(problemStatements).set(data).where(and(eq(problemStatements.id, id), eq(problemStatements.eventId, eventId))).run();
  else db.insert(problemStatements).values({ id: newId("ps_"), eventId, ...data }).run();
  audit({ actorId: user.id, action: id ? "problem.update" : "problem.create", resourceType: "problem_statement", eventId, summary: `${user.name} ${id ? "edited" : "added"} problem statement ${data.code}` });
  revalidatePath(`/app/events/${eventId}`, "layout");
  return { ok: true, message: "Problem statement saved." };
});

export const deleteProblemStatement = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("schedule.manage", eventId);
  const id = String(fd.get("id"));
  db.delete(problemStatements).where(and(eq(problemStatements.id, id), eq(problemStatements.eventId, eventId))).run();
  audit({ actorId: user.id, action: "problem.delete", resourceType: "problem_statement", eventId, summary: `${user.name} deleted a problem statement` });
  revalidatePath(`/app/events/${eventId}`, "layout");
});
