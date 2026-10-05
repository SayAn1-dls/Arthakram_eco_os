import "server-only";
import { and, eq, like, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { clubs, colleges, documents, events, learningResources, mentorProfiles, opportunities, organizations, problemStatements, users } from "@/db/schema";
import { allows } from "@/lib/rbac-core";
import { canReadDocument } from "./docs";
import { eventScopeOf, loadGrants } from "./rbac";

export type SearchHit = { kind: string; title: string; subtitle?: string; href: string };

/** Global search. Every result type is filtered by what the viewer may see. */
export async function globalSearch(q: string, userId: string | null): Promise<SearchHit[]> {
  const term = `%${q.trim().replace(/[%_]/g, "")}%`;
  if (term.length < 4) return [];
  const grants = userId ? await loadGrants(userId) : [];
  const hits: SearchHit[] = [];

  const evs = db.select().from(events).where(or(like(events.title, term), like(events.tagline, term), like(events.description, term))).limit(30).all();
  for (const e of evs) {
    const staff = userId && allows(grants, "events.view", eventScopeOf(e));
    if (staff) hits.push({ kind: "Event workspace", title: e.title, subtitle: e.status, href: `/app/events/${e.id}` });
    else if (e.visibility === "public" && e.status !== "draft") hits.push({ kind: "Event", title: e.title, subtitle: e.tagline ?? undefined, href: `/events/${e.slug}` });
  }
  for (const c of db.select().from(clubs).where(or(like(clubs.name, term), like(clubs.tagline, term), like(clubs.category, term))).limit(10).all())
    hits.push({ kind: "Club", title: c.name, subtitle: c.tagline ?? undefined, href: `/clubs/${c.slug}` });
  for (const o of db.select().from(organizations).where(like(organizations.name, term)).limit(5).all())
    hits.push({ kind: "Organization", title: o.name, href: `/organizations/${o.slug}` });
  for (const c of db.select().from(colleges).where(like(colleges.name, term)).limit(5).all()) hits.push({ kind: "College", title: c.name, subtitle: c.city ?? undefined, href: `/organizations` });
  for (const m of db
    .select({ id: mentorProfiles.userId, name: users.name, headline: mentorProfiles.headline })
    .from(mentorProfiles)
    .innerJoin(users, eq(users.id, mentorProfiles.userId))
    .where(and(eq(mentorProfiles.status, "approved"), or(like(users.name, term), like(mentorProfiles.headline, term), like(mentorProfiles.skills, term))))
    .limit(10)
    .all())
    hits.push({ kind: "Mentor", title: m.name, subtitle: m.headline, href: `/mentors/${m.id}` });
  for (const o of db.select().from(opportunities).where(and(eq(opportunities.status, "active"), or(like(opportunities.title, term), like(opportunities.tags, term)))).limit(10).all())
    hits.push({ kind: "Opportunity", title: o.title, subtitle: o.organizer, href: userId ? `/app/opportunities#${o.id}` : "/opportunities" });
  for (const r of db.select().from(learningResources).where(and(eq(learningResources.active, true), like(learningResources.title, term))).limit(5).all())
    hits.push({ kind: "Resource", title: r.title, href: "/learn" });

  const docs = db
    .select({ d: documents, e: events })
    .from(documents)
    .innerJoin(events, eq(events.id, documents.eventId))
    .where(or(like(documents.title, term), like(documents.content, term)))
    .limit(40)
    .all();
  for (const { d, e } of docs) {
    if (!(await canReadDocument(d, userId))) continue;
    const staff = userId && allows(grants, "documents.view", eventScopeOf(e));
    hits.push({ kind: "Document", title: d.title, subtitle: e.title, href: staff ? `/app/events/${e.id}/docs/${d.id}` : `/events/${e.slug}/docs/${d.id}` });
  }
  const ps = db
    .select({ p: problemStatements, e: events })
    .from(problemStatements)
    .innerJoin(events, eq(events.id, problemStatements.eventId))
    .where(and(or(like(problemStatements.title, term), like(problemStatements.description, term)), ne(events.status, "draft")))
    .limit(20)
    .all();
  for (const { p, e } of ps) {
    const visible = ["live", "completed", "archived"].includes(e.status);
    if (visible || (userId && allows(grants, "events.view", eventScopeOf(e))))
      hits.push({ kind: "Problem statement", title: `${p.code} · ${p.title}`, subtitle: e.title, href: `/events/${e.slug}#problems` });
  }
  return hits;
}
