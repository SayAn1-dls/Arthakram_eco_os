"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { platformSettings, roleAssignments, roles, studentProfiles, users } from "@/db/schema";
import { newId } from "@/lib/utils";
import { act, UserError } from "../action";
import { audit } from "../audit";
import { createSession, destroySession, hashPassword, verifyPassword } from "../auth";

const safeNext = (n: string | undefined) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/app");

export const login = act(async (fd) => {
  const { email, password, next } = z
    .object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1), next: z.string().optional() })
    .parse(Object.fromEntries(fd));
  const u = db.select().from(users).where(eq(users.email, email)).get();
  // Same message for unknown email and wrong password — no account enumeration.
  if (!u || !(await verifyPassword(password, u.passwordHash))) throw new UserError("Incorrect email or password.");
  if (u.status !== "active") throw new UserError("This account is suspended. Contact an Arthakram admin.");
  await createSession(u.id);
  redirect(safeNext(next));
});

export const signup = act(async (fd) => {
  const allow = db.select().from(platformSettings).where(eq(platformSettings.key, "allowSignups")).get();
  if (allow && allow.value === false) throw new UserError("Sign-ups are currently closed by the platform admin.");
  const data = z
    .object({
      name: z.string().trim().min(2, "Enter your full name").max(80),
      email: z.string().trim().toLowerCase().email("Enter a valid email"),
      password: z.string().min(8, "Use at least 8 characters").max(200),
    })
    .parse(Object.fromEntries(fd));
  if (db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).get())
    throw new UserError("An account with this email already exists. Sign in instead.");
  const id = newId("u_");
  db.insert(users).values({ id, name: data.name, email: data.email, passwordHash: await hashPassword(data.password) }).run();
  db.insert(studentProfiles).values({ userId: id }).run();
  const student = db.select().from(roles).where(eq(roles.key, "student")).get();
  if (student) db.insert(roleAssignments).values({ id: newId("ra_"), userId: id, roleId: student.id, scopeType: "platform", note: "Default on sign-up" }).run();
  audit({ actorId: id, action: "user.signup", resourceType: "user", resourceId: id, summary: `${data.name} joined Arthakram` });
  await createSession(id);
  redirect("/app/path?welcome=1");
});

export async function logout() {
  await destroySession();
  redirect("/");
}
