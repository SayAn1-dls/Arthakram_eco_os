import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { mentorProfiles, users } from "@/db/schema";

export function mentorsForEvent() {
  return db
    .select({ userId: mentorProfiles.userId, name: users.name, headline: mentorProfiles.headline })
    .from(mentorProfiles)
    .innerJoin(users, eq(users.id, mentorProfiles.userId))
    .where(eq(mentorProfiles.status, "approved"))
    .orderBy(asc(users.name))
    .all();
}
