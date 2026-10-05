import "server-only";
import { cache } from "react";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { clubs, colleges, events, roleAssignments, rolePermissions, roles } from "@/db/schema";
import {
  allows,
  allowsAnywhere,
  effectivePermissions,
  PLATFORM,
  type Grant,
  type Scope,
} from "@/lib/rbac-core";
import { getCurrentUser, type SessionUser } from "./auth";

export { PLATFORM, type Scope, type Grant };

export class AuthzError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthzError";
  }
}

/** All active grants for a user — loaded once per request. */
export const loadGrants = cache(async (userId: string): Promise<Grant[]> => {
  const now = new Date();
  const rows = db
    .select({
      assignmentId: roleAssignments.id,
      roleId: roles.id,
      roleKey: roles.key,
      roleName: roles.name,
      scopeType: roleAssignments.scopeType,
      scopeId: roleAssignments.scopeId,
    })
    .from(roleAssignments)
    .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
    .where(
      and(
        eq(roleAssignments.userId, userId),
        isNull(roleAssignments.revokedAt),
        or(isNull(roleAssignments.expiresAt), gt(roleAssignments.expiresAt, now)),
      ),
    )
    .all();
  const roleIds = [...new Set(rows.map((r) => r.roleId))];
  const perms = new Map<string, Set<string>>();
  for (const rid of roleIds) {
    perms.set(
      rid,
      new Set(
        db
          .select({ p: rolePermissions.permission })
          .from(rolePermissions)
          .where(eq(rolePermissions.roleId, rid))
          .all()
          .map((r) => r.p),
      ),
    );
  }
  return rows.map((r) => ({ ...r, permissions: perms.get(r.roleId) ?? new Set() }));
});

export function eventScopeOf(e: {
  id: string;
  organizationId: string;
  collegeId: string | null;
  clubId: string | null;
}): Scope {
  return { type: "event", id: e.id, organizationId: e.organizationId, collegeId: e.collegeId, clubId: e.clubId };
}

export const eventScope = cache(async (eventId: string): Promise<Scope | null> => {
  const e = db
    .select({ id: events.id, organizationId: events.organizationId, collegeId: events.collegeId, clubId: events.clubId })
    .from(events)
    .where(eq(events.id, eventId))
    .get();
  return e ? eventScopeOf(e) : null;
});

export const clubScope = cache(async (clubId: string): Promise<Scope | null> => {
  const c = db
    .select({ id: clubs.id, organizationId: clubs.organizationId, collegeId: clubs.collegeId })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .get();
  return c ? { type: "club", ...c } : null;
});

export async function collegeScope(collegeId: string): Promise<Scope | null> {
  const c = db
    .select({ id: colleges.id, organizationId: colleges.organizationId })
    .from(colleges)
    .where(eq(colleges.id, collegeId))
    .get();
  return c ? { type: "college", ...c } : null;
}

export async function can(userId: string, permission: string, scope: Scope = PLATFORM) {
  return allows(await loadGrants(userId), permission, scope);
}

export async function canAnywhere(userId: string, permission: string) {
  return allowsAnywhere(await loadGrants(userId), permission);
}

export async function permissionsAt(userId: string, scope: Scope) {
  return effectivePermissions(await loadGrants(userId), scope);
}

export async function hasRoleAnywhere(userId: string, roleKey: string) {
  return (await loadGrants(userId)).some((g) => g.roleKey === roleKey);
}

export async function isPlatformAdmin(userId: string) {
  return can(userId, "users.view", PLATFORM);
}

/**
 * Server-side gate for every mutation and protected read.
 * Throws AuthzError — never rely on the UI hiding a button.
 */
export async function requirePermission(permission: string, scope: Scope = PLATFORM): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthzError("Please sign in first.");
  if (!(await can(user.id, permission, scope))) throw new AuthzError();
  return user;
}

export async function requireEventPermission(permission: string, eventId: string) {
  const scope = await eventScope(eventId);
  if (!scope) throw new AuthzError("Event not found.");
  const user = await requirePermission(permission, scope);
  return { user, scope };
}

export async function resolveScope(type: string, id: string | null): Promise<Scope | null> {
  switch (type) {
    case "platform":
      return PLATFORM;
    case "organization":
      return id ? { type: "organization", id } : null;
    case "college":
      return id ? collegeScope(id) : null;
    case "club":
      return id ? clubScope(id) : null;
    case "event":
      return id ? eventScope(id) : null;
    default:
      return null;
  }
}
