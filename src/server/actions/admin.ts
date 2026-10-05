"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { parseLocalInput } from "@/lib/datetime";
import {
  clubs,
  colleges,
  events,
  learningResources,
  mentorProfiles,
  OPPORTUNITY_CATEGORIES,
  opportunities,
  organizations,
  platformSettings,
  roleAssignments,
  roles,
} from "@/db/schema";
import { DIMENSION_KEYS } from "@/lib/recommend";
import { newId, parseList, slugify } from "@/lib/utils";
import { act, UserError } from "../action";
import { audit } from "../audit";
import { requireUser } from "../auth";
import { notify } from "../notify";
import { AuthzError, can, clubScope, PLATFORM, requirePermission } from "../rbac";

const opt = z.string().optional().transform((v) => v?.trim() || null);
const optUrl = z.string().trim().url().or(z.literal("")).optional().transform((v) => v || null);

function uniqueSlug(table: typeof organizations | typeof colleges | typeof clubs, base: string, currentId?: string) {
  let slug = slugify(base) || "item";
  const taken = (s: string) => {
    const row = db.select({ id: table.id }).from(table).where(eq(table.slug, s)).get();
    return row && row.id !== currentId;
  };
  if (taken(slug)) slug = `${slug}-${newId().slice(0, 4).toLowerCase()}`;
  return slug;
}

/* ───────── Organizations & colleges ───────── */

export const saveOrganization = act(async (fd) => {
  const id = String(fd.get("id") ?? "");
  const user = await requirePermission(id ? "organizations.edit" : "organizations.create", PLATFORM);
  const data = z
    .object({ name: z.string().trim().min(2).max(100), kind: z.enum(["network", "university", "company", "community"]), description: opt, website: optUrl, contactEmail: opt })
    .parse(Object.fromEntries(fd));
  if (id) db.update(organizations).set(data).where(eq(organizations.id, id)).run();
  else db.insert(organizations).values({ id: newId("org_"), slug: uniqueSlug(organizations, data.name), ...data }).run();
  audit({ actorId: user.id, action: id ? "organization.update" : "organization.create", resourceType: "organization", resourceId: id || null, summary: `${user.name} ${id ? "updated" : "created"} organization ${data.name}` });
  revalidatePath("/app/admin/organizations");
  return { ok: true, message: "Organization saved." };
});

export const saveCollege = act(async (fd) => {
  const id = String(fd.get("id") ?? "");
  const user = await requirePermission(id ? "organizations.edit" : "organizations.create", PLATFORM);
  const data = z.object({ name: z.string().trim().min(2).max(120), organizationId: z.string().min(1), city: opt, description: opt, website: optUrl }).parse(Object.fromEntries(fd));
  if (id) db.update(colleges).set(data).where(eq(colleges.id, id)).run();
  else db.insert(colleges).values({ id: newId("col_"), slug: uniqueSlug(colleges, data.name), ...data }).run();
  audit({ actorId: user.id, action: id ? "college.update" : "college.create", resourceType: "college", summary: `${user.name} ${id ? "updated" : "added"} college ${data.name}` });
  revalidatePath("/app/admin/organizations");
  return { ok: true, message: "College saved." };
});

/* ───────── Clubs ───────── */

export const saveClub = act(async (fd) => {
  const user = await requireUser();
  const id = String(fd.get("id") ?? "");
  const data = z
    .object({
      name: z.string().trim().min(2).max(100),
      organizationId: z.string().min(1),
      collegeId: z.string().optional().transform((v) => v || null),
      category: z.string().trim().min(2).max(40),
      tagline: opt,
      description: opt,
      fitProfile: opt,
      contactEmail: opt,
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#F26A1B"),
    })
    .parse(Object.fromEntries(fd));
  if (id) {
    const scope = await clubScope(id);
    if (!scope || !(await can(user.id, "clubs.edit", scope))) throw new AuthzError();
  } else if (!(await can(user.id, "clubs.create", { type: "organization", id: data.organizationId }))) throw new AuthzError();
  const lists = {
    learnings: parseList(fd.get("learnings")),
    activities: parseList(fd.get("activities")),
    careerPaths: parseList(fd.get("careerPaths")),
    firstSteps: parseList(fd.get("firstSteps")),
    isRecruiting: fd.get("isRecruiting") === "on",
  };
  if (id) {
    // Moving a club between organizations is a structural change reserved for platform admins.
    const current = db.select().from(clubs).where(eq(clubs.id, id)).get()!;
    if (current.organizationId !== data.organizationId && !(await can(user.id, "organizations.edit", PLATFORM))) throw new AuthzError("Only admins can move a club to another organization.");
    db.update(clubs).set({ ...data, ...lists }).where(eq(clubs.id, id)).run();
  } else db.insert(clubs).values({ id: newId("club_"), slug: uniqueSlug(clubs, data.name), ...data, ...lists }).run();
  audit({ actorId: user.id, action: id ? "club.update" : "club.create", resourceType: "club", resourceId: id || null, summary: `${user.name} ${id ? "updated" : "created"} club ${data.name}` });
  revalidatePath("/app/admin/organizations");
  revalidatePath("/clubs", "layout");
  return { ok: true, message: "Club saved." };
});

export const deleteClub = act(async (fd) => {
  const user = await requireUser();
  const id = String(fd.get("id"));
  const scope = await clubScope(id);
  if (!scope || !(await can(user.id, "clubs.delete", scope))) throw new AuthzError();
  const c = db.select().from(clubs).where(eq(clubs.id, id)).get()!;
  if (db.select({ id: events.id }).from(events).where(eq(events.clubId, id)).get()) throw new UserError("This club has events. Archive or reassign them first.");
  db.delete(clubs).where(eq(clubs.id, id)).run();
  // Keep the access history; just end every grant scoped to this club.
  db.update(roleAssignments).set({ revokedAt: new Date(), revokedById: user.id }).where(and(eq(roleAssignments.scopeType, "club"), eq(roleAssignments.scopeId, id), isNull(roleAssignments.revokedAt))).run();
  audit({ actorId: user.id, action: "club.delete", resourceType: "club", resourceId: id, summary: `${user.name} deleted club ${c.name}` });
  revalidatePath("/app/admin/organizations");
});

export const saveClubTraits = act(async (fd) => {
  const user = await requirePermission("recommendations.manage", PLATFORM);
  const id = String(fd.get("clubId"));
  const before = db.select().from(clubs).where(eq(clubs.id, id)).get();
  if (!before) throw new UserError("Club not found.");
  const traits: Record<string, number> = {};
  for (const d of DIMENSION_KEYS) {
    const v = Number(fd.get(`trait_${d}`) ?? 0);
    if (v > 0) traits[d] = Math.min(1, Math.max(0, +v.toFixed(2)));
  }
  if (!Object.keys(traits).length) throw new UserError("Give the club at least one trait.");
  db.update(clubs).set({ traits }).where(eq(clubs.id, id)).run();
  audit({ actorId: user.id, action: "recommendation.traits", resourceType: "club", resourceId: id, summary: `${user.name} tuned recommendation traits for ${before.name}`, before: before.traits, after: traits });
  revalidatePath("/app/admin/recommendations");
  return { ok: true, message: "Traits saved — new assessments use them immediately." };
});

/* ───────── Opportunities ───────── */

export const saveOpportunity = act(async (fd) => {
  const user = await requirePermission("opportunities.manage", PLATFORM);
  const id = String(fd.get("id") ?? "");
  const data = z
    .object({
      title: z.string().trim().min(3).max(140),
      organizer: z.string().trim().min(2).max(100),
      category: z.enum(OPPORTUNITY_CATEGORIES),
      source: z.enum(["arthakram", "unstop", "external"]),
      sourceUrl: optUrl,
      eventId: z.string().optional().transform((v) => v || null),
      description: opt,
      mode: z.enum(["online", "offline", "hybrid"]),
      location: opt,
      prize: opt,
      eligibility: opt,
      deadline: z.string().optional().transform((v) => (v ? parseLocalInput(v) : null)),
      status: z.enum(["draft", "active", "closed"]),
    })
    .parse(Object.fromEntries(fd));
  if (data.source !== "arthakram" && !data.sourceUrl) throw new UserError("External opportunities need the original source link — students register there.");
  if (data.source === "arthakram" && !data.eventId) throw new UserError("Link the Arthakram event this opportunity points to.");
  const row = { ...data, tags: parseList(fd.get("tags")).map((t) => t.toLowerCase()), featured: fd.get("featured") === "on" };
  if (id) db.update(opportunities).set(row).where(eq(opportunities.id, id)).run();
  else db.insert(opportunities).values({ id: newId("op_"), createdById: user.id, ...row }).run();
  audit({ actorId: user.id, action: id ? "opportunity.update" : "opportunity.create", resourceType: "opportunity", resourceId: id || null, summary: `${user.name} ${id ? "updated" : "added"} opportunity ${data.title}` });
  revalidatePath("/app/admin/opportunities");
  revalidatePath("/opportunities");
  return { ok: true, message: "Opportunity saved." };
});

export const deleteOpportunity = act(async (fd) => {
  const user = await requirePermission("opportunities.manage", PLATFORM);
  const o = db.select().from(opportunities).where(eq(opportunities.id, String(fd.get("id")))).get();
  if (!o) throw new UserError("Not found.");
  db.delete(opportunities).where(eq(opportunities.id, o.id)).run();
  audit({ actorId: user.id, action: "opportunity.delete", resourceType: "opportunity", summary: `${user.name} removed opportunity ${o.title}` });
  revalidatePath("/app/admin/opportunities");
});

/* ───────── Learn page ───────── */

export const saveResource = act(async (fd) => {
  const user = await requirePermission("resources.manage", PLATFORM);
  const id = String(fd.get("id") ?? "");
  const data = z
    .object({
      title: z.string().trim().min(2).max(80),
      description: opt,
      url: z.string().trim().refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v), "Use https://… or a /path").optional().transform((v) => v || null),
      ctaLabel: z.string().trim().min(2).max(40),
      kind: z.enum(["arthakram_product", "guide", "course", "video", "tool"]),
      order: z.coerce.number().int().min(0).max(999),
    })
    .parse(Object.fromEntries(fd));
  const row = { ...data, tags: parseList(fd.get("tags")), active: fd.get("active") === "on" };
  if (id) db.update(learningResources).set(row).where(eq(learningResources.id, id)).run();
  else db.insert(learningResources).values({ id: newId("lr_"), ...row }).run();
  audit({ actorId: user.id, action: id ? "resource.update" : "resource.create", resourceType: "learning_resource", summary: `${user.name} ${id ? "updated" : "added"} learning resource ${data.title}` });
  revalidatePath("/learn");
  revalidatePath("/app/admin/resources");
  return { ok: true, message: "Saved." };
});

export const deleteResource = act(async (fd) => {
  const user = await requirePermission("resources.manage", PLATFORM);
  const r = db.select().from(learningResources).where(eq(learningResources.id, String(fd.get("id")))).get();
  if (!r) throw new UserError("Not found.");
  db.delete(learningResources).where(eq(learningResources.id, r.id)).run();
  audit({ actorId: user.id, action: "resource.delete", resourceType: "learning_resource", summary: `${user.name} removed learning resource ${r.title}` });
  revalidatePath("/learn");
  revalidatePath("/app/admin/resources");
});

/* ───────── Mentors ───────── */

export const setMentorStatus = act(async (fd) => {
  const user = await requirePermission("mentors.approve", PLATFORM);
  const mentorId = String(fd.get("userId"));
  const status = z.enum(["pending", "approved", "paused"]).parse(fd.get("status"));
  const m = db.select().from(mentorProfiles).where(eq(mentorProfiles.userId, mentorId)).get();
  if (!m) throw new UserError("Mentor profile not found.");
  db.update(mentorProfiles).set({ status }).where(eq(mentorProfiles.userId, mentorId)).run();
  if (status === "approved") {
    const mentorRole = db.select().from(roles).where(eq(roles.key, "mentor")).get()!;
    const has = db.select().from(roleAssignments).where(eq(roleAssignments.userId, mentorId)).all().some((a) => a.roleId === mentorRole.id && !a.revokedAt && a.scopeType === "platform");
    if (!has) db.insert(roleAssignments).values({ id: newId("ra_"), userId: mentorId, roleId: mentorRole.id, scopeType: "platform", grantedById: user.id, note: "Mentor profile approved" }).run();
    notify([mentorId], { kind: "mentor", title: "Your mentor profile is live", body: "Students can now find you and request reviews.", link: "/app/mentor" });
  }
  audit({ actorId: user.id, action: `mentor.${status}`, resourceType: "mentor_profile", resourceId: mentorId, summary: `${user.name} set a mentor profile to ${status}`, before: { status: m.status }, after: { status } });
  revalidatePath("/app/admin/mentors");
  revalidatePath("/mentors");
});

/* ───────── Settings ───────── */

export const saveSettings = act(async (fd) => {
  const user = await requirePermission("settings.manage", PLATFORM);
  const values: Record<string, unknown> = {
    platformName: z.string().trim().min(2).max(40).parse(fd.get("platformName")),
    tagline: z.string().trim().max(120).parse(fd.get("tagline") ?? ""),
    allowSignups: fd.get("allowSignups") === "on",
  };
  for (const [key, value] of Object.entries(values))
    db.insert(platformSettings).values({ key, value, updatedAt: new Date() }).onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: new Date() } }).run();
  audit({ actorId: user.id, action: "settings.update", resourceType: "settings", summary: `${user.name} updated platform settings`, after: values });
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
});
