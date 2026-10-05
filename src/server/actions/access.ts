"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { parseLocalInput } from "@/lib/datetime";
import { clubs, colleges, events, organizations, roleAssignments, rolePermissions, roles, sessions, SCOPE_TYPES, users } from "@/db/schema";
import { ALL_PERMISSIONS, PROTECTED_ROLE_KEYS } from "@/lib/permissions";
import { canGrant } from "@/lib/rbac-core";
import { newId, slugify, token } from "@/lib/utils";
import { act, UserError } from "../action";
import { audit } from "../audit";
import { hashPassword, requireUser } from "../auth";
import { notify } from "../notify";
import { AuthzError, can, loadGrants, PLATFORM, requirePermission, resolveScope } from "../rbac";

function scopeLabel(type: string, id: string | null) {
  if (type === "platform" || !id) return "the platform";
  const name =
    type === "event"
      ? db.select({ n: events.title }).from(events).where(eq(events.id, id)).get()?.n
      : type === "club"
        ? db.select({ n: clubs.name }).from(clubs).where(eq(clubs.id, id)).get()?.n
        : type === "college"
          ? db.select({ n: colleges.name }).from(colleges).where(eq(colleges.id, id)).get()?.n
          : db.select({ n: organizations.name }).from(organizations).where(eq(organizations.id, id)).get()?.n;
  return name ?? `${type} ${id}`;
}

function revalidateAccess(scopeType: string, scopeId: string | null) {
  revalidatePath("/app", "layout");
  if (scopeType === "event" && scopeId) revalidatePath(`/app/events/${scopeId}/access`);
}

export const grantRole = act(async (fd) => {
  const granter = await requireUser();
  const data = z
    .object({
      email: z.string().trim().toLowerCase().email("Enter the person's email"),
      roleId: z.string().min(1, "Choose a role"),
      scopeType: z.enum(SCOPE_TYPES),
      scopeId: z.string().optional().transform((v) => v || null),
      expiresAt: z.string().optional().transform((v) => (v ? parseLocalInput(v) : null)),
      note: z.string().max(200).optional().transform((v) => v?.trim() || null),
    })
    .parse(Object.fromEntries(fd));
  const target = db.select().from(users).where(eq(users.email, data.email)).get();
  if (!target) throw new UserError("No Arthakram account with that email.");
  const role = db.select().from(roles).where(eq(roles.id, data.roleId)).get();
  if (!role) throw new UserError("Role not found.");
  const scope = await resolveScope(data.scopeType, data.scopeType === "platform" ? null : data.scopeId);
  if (!scope) throw new UserError("Choose where this access applies.");
  const perms = db.select({ p: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, role.id)).all().map((r) => r.p);
  const check = canGrant(await loadGrants(granter.id), { key: role.key, permissions: perms }, scope, PROTECTED_ROLE_KEYS);
  if (!check.ok) throw new AuthzError(check.reason);
  const scopeId = data.scopeType === "platform" ? null : data.scopeId;
  const dupe = db
    .select()
    .from(roleAssignments)
    .where(and(eq(roleAssignments.userId, target.id), eq(roleAssignments.roleId, role.id), eq(roleAssignments.scopeType, data.scopeType), scopeId ? eq(roleAssignments.scopeId, scopeId) : isNull(roleAssignments.scopeId), isNull(roleAssignments.revokedAt)))
    .get();
  if (dupe) throw new UserError(`${target.name} already has ${role.name} here.`);
  const id = newId("ra_");
  db.insert(roleAssignments).values({ id, userId: target.id, roleId: role.id, scopeType: data.scopeType, scopeId, grantedById: granter.id, expiresAt: data.expiresAt, note: data.note }).run();
  const where = scopeLabel(data.scopeType, scopeId);
  notify([target.id], { kind: "access", title: `You were granted ${role.name} on ${where}`, link: "/app/access" });
  audit({ actorId: granter.id, action: "access.grant", resourceType: "role_assignment", resourceId: id, eventId: data.scopeType === "event" ? scopeId : null, summary: `${granter.name} granted ${role.name} on ${where} to ${target.name}`, after: { role: role.key, scopeType: data.scopeType, scopeId, expiresAt: data.expiresAt } });
  revalidateAccess(data.scopeType, scopeId);
  return { ok: true, message: `${target.name} now has ${role.name} on ${where}.` };
});

export const revokeAssignment = act(async (fd) => {
  const actor = await requireUser();
  const a = db.select().from(roleAssignments).where(eq(roleAssignments.id, String(fd.get("assignmentId")))).get();
  if (!a || a.revokedAt) throw new UserError("Access already revoked.");
  const role = db.select().from(roles).where(eq(roles.id, a.roleId)).get()!;
  const scope = await resolveScope(a.scopeType, a.scopeId);
  if (!scope) throw new UserError("Scope no longer exists.");
  const perms = db.select({ p: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, role.id)).all().map((r) => r.p);
  // Revoking follows the same rule as granting: you can only take away what you could give.
  const check = canGrant(await loadGrants(actor.id), { key: role.key, permissions: perms }, scope, PROTECTED_ROLE_KEYS);
  if (!check.ok) throw new AuthzError(check.reason.replace("grant", "revoke"));
  if (a.userId === actor.id && role.key === "super_admin") throw new UserError("You can't revoke your own super admin access.");
  db.update(roleAssignments).set({ revokedAt: new Date(), revokedById: actor.id }).where(eq(roleAssignments.id, a.id)).run();
  const target = db.select({ name: users.name }).from(users).where(eq(users.id, a.userId)).get();
  const where = scopeLabel(a.scopeType, a.scopeId);
  notify([a.userId], { kind: "access", title: `Your ${role.name} access on ${where} was revoked`, link: "/app/access" });
  audit({ actorId: actor.id, action: "access.revoke", resourceType: "role_assignment", resourceId: a.id, eventId: a.scopeType === "event" ? a.scopeId : null, summary: `${actor.name} revoked ${role.name} on ${where} from ${target?.name}`, before: { role: role.key, scopeType: a.scopeType, scopeId: a.scopeId } });
  revalidateAccess(a.scopeType, a.scopeId);
  return { ok: true, message: "Access revoked." };
});

/* ───────── Custom roles ───────── */

export const saveRole = act(async (fd) => {
  const user = await requirePermission("roles.manage", PLATFORM);
  const data = z
    .object({ name: z.string().trim().min(2).max(50), description: z.string().max(240).optional().transform((v) => v?.trim() || null), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#F26A1B") })
    .parse(Object.fromEntries(fd));
  const perms = fd.getAll("permissions").map(String).filter((p) => ALL_PERMISSIONS.includes(p));
  if (!perms.length) throw new UserError("Pick at least one permission.");
  // Even admins can't mint permissions they don't hold.
  for (const p of perms) if (!(await can(user.id, p, PLATFORM))) throw new AuthzError(`You don't hold ${p}, so you can't put it in a role.`);
  const roleId = String(fd.get("roleId") ?? "");
  if (roleId) {
    const role = db.select().from(roles).where(eq(roles.id, roleId)).get();
    if (!role) throw new UserError("Role not found.");
    if (role.isSystem) throw new UserError("System roles are fixed. Create a custom role instead.");
    const before = db.select({ p: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, roleId)).all().map((r) => r.p);
    db.transaction((tx) => {
      tx.update(roles).set(data).where(eq(roles.id, roleId)).run();
      tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId)).run();
      tx.insert(rolePermissions).values(perms.map((permission) => ({ roleId, permission }))).run();
    });
    audit({ actorId: user.id, action: "role.update", resourceType: "role", resourceId: roleId, summary: `${user.name} updated role ${data.name}`, before: { permissions: before }, after: { permissions: perms } });
    revalidatePath("/app/admin/roles", "layout");
    return { ok: true, message: "Role updated. Changes apply immediately to everyone holding it." };
  }
  let key = slugify(data.name).replace(/-/g, "_") || "role";
  if (db.select().from(roles).where(eq(roles.key, key)).get()) key = `${key}_${newId().slice(0, 4).toLowerCase()}`;
  const id = newId("role_");
  db.insert(roles).values({ id, key, isSystem: false, ...data }).run();
  db.insert(rolePermissions).values(perms.map((permission) => ({ roleId: id, permission }))).run();
  audit({ actorId: user.id, action: "role.create", resourceType: "role", resourceId: id, summary: `${user.name} created custom role ${data.name} (${perms.length} permissions)`, after: { permissions: perms } });
  revalidatePath("/app/admin/roles", "layout");
  return { ok: true, message: `Role “${data.name}” created.` };
});

export const deleteRole = act(async (fd) => {
  const user = await requirePermission("roles.manage", PLATFORM);
  const role = db.select().from(roles).where(eq(roles.id, String(fd.get("roleId")))).get();
  if (!role) throw new UserError("Role not found.");
  if (role.isSystem) throw new UserError("System roles can't be deleted.");
  const active = db.select({ id: roleAssignments.id }).from(roleAssignments).where(and(eq(roleAssignments.roleId, role.id), isNull(roleAssignments.revokedAt))).all().length;
  if (active) throw new UserError(`${active} people still hold this role. Revoke their access first.`);
  db.delete(roles).where(eq(roles.id, role.id)).run();
  audit({ actorId: user.id, action: "role.delete", resourceType: "role", resourceId: role.id, summary: `${user.name} deleted role ${role.name}` });
  revalidatePath("/app/admin/roles", "layout");
});

/* ───────── Users ───────── */

export const createUser = act(async (fd) => {
  const actor = await requirePermission("users.create", PLATFORM);
  const data = z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), headline: z.string().max(120).optional().transform((v) => v?.trim() || null) }).parse(Object.fromEntries(fd));
  if (db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).get()) throw new UserError("That email is already registered.");
  const temp = token(9);
  const id = newId("u_");
  db.insert(users).values({ id, ...data, passwordHash: await hashPassword(temp) }).run();
  const student = db.select().from(roles).where(eq(roles.key, "student")).get();
  if (student) db.insert(roleAssignments).values({ id: newId("ra_"), userId: id, roleId: student.id, scopeType: "platform", grantedById: actor.id }).run();
  audit({ actorId: actor.id, action: "user.create", resourceType: "user", resourceId: id, summary: `${actor.name} created an account for ${data.name}` });
  revalidatePath("/app/admin/users");
  return { ok: true, message: `Account created. Share this temporary password privately: ${temp}`, data: { password: temp } };
});

export const setUserStatus = act(async (fd) => {
  const actor = await requirePermission("users.edit", PLATFORM);
  const target = db.select().from(users).where(eq(users.id, String(fd.get("userId")))).get();
  if (!target) throw new UserError("User not found.");
  if (target.id === actor.id) throw new UserError("You can't suspend yourself.");
  const targetGrants = await loadGrants(target.id);
  if (targetGrants.some((g) => PROTECTED_ROLE_KEYS.includes(g.roleKey)) && !(await can(actor.id, "*", PLATFORM)))
    throw new AuthzError("Only a super admin can suspend an admin.");
  const status = target.status === "active" ? "suspended" : "active";
  db.update(users).set({ status }).where(eq(users.id, target.id)).run();
  if (status === "suspended") db.delete(sessions).where(eq(sessions.userId, target.id)).run();
  audit({ actorId: actor.id, action: `user.${status}`, resourceType: "user", resourceId: target.id, summary: `${actor.name} ${status === "suspended" ? "suspended" : "reactivated"} ${target.name}`, before: { status: target.status }, after: { status } });
  revalidatePath(`/app/admin/users/${target.id}`);
  revalidatePath("/app/admin/users");
});

export const resetPassword = act(async (fd) => {
  const actor = await requirePermission("users.edit", PLATFORM);
  const target = db.select().from(users).where(eq(users.id, String(fd.get("userId")))).get();
  if (!target) throw new UserError("User not found.");
  const targetGrants = await loadGrants(target.id);
  if (targetGrants.some((g) => PROTECTED_ROLE_KEYS.includes(g.roleKey)) && !(await can(actor.id, "*", PLATFORM)))
    throw new AuthzError("Only a super admin can reset an admin's password.");
  const temp = token(9);
  db.update(users).set({ passwordHash: await hashPassword(temp) }).where(eq(users.id, target.id)).run();
  db.delete(sessions).where(eq(sessions.userId, target.id)).run();
  audit({ actorId: actor.id, action: "user.reset_password", resourceType: "user", resourceId: target.id, summary: `${actor.name} reset the password for ${target.name}` });
  return { ok: true, message: `Temporary password: ${temp} — share it privately.`, data: { password: temp } };
});
