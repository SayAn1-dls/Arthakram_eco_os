import "server-only";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { clubs, events, EVENT_TYPES } from "@/db/schema";

export const COMPETITION_TYPES = EVENT_TYPES.filter((t) => !["workshop", "seminar", "conference", "other"].includes(t));

/** Public listing: never drafts, never private events. */
export function publicEvents(opts: { types?: readonly string[]; status?: string[] } = {}) {
  const rows = db
    .select()
    .from(events)
    .where(and(eq(events.visibility, "public"), ne(events.status, "draft"), opts.status ? inArray(events.status, opts.status as ("live" | "published")[]) : undefined))
    .orderBy(desc(events.startsAt))
    .all()
    .filter((e) => !opts.types || opts.types.includes(e.type));
  const order = ["live", "published", "completed", "archived"];
  return rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
}

export function clubNames() {
  return new Map(db.select({ id: clubs.id, name: clubs.name }).from(clubs).all().map((c) => [c.id, c.name]));
}
