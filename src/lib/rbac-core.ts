/**
 * Pure access-control logic (no DB). Kept separate so it can be unit tested.
 *
 * A grant = role permissions bound to a scope. A user's effective permissions at
 * a scope are the union of every active grant on that scope *or any ancestor*.
 *
 *   platform → organization → college → club → event
 */
import { permissionSetAllows } from "./permissions";
import type { ScopeType } from "@/db/schema";

export type Scope =
  | { type: "platform" }
  | { type: "organization"; id: string }
  | { type: "college"; id: string; organizationId: string }
  | { type: "club"; id: string; organizationId: string; collegeId: string | null }
  | {
      type: "event";
      id: string;
      organizationId: string;
      collegeId: string | null;
      clubId: string | null;
    };

export type Grant = {
  assignmentId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  scopeType: ScopeType;
  scopeId: string | null;
  permissions: Set<string>;
};

export const PLATFORM: Scope = { type: "platform" };

/** Every [scopeType, scopeId] pair whose grants apply to `scope`. */
export function scopeChain(scope: Scope): [ScopeType, string | null][] {
  const chain: [ScopeType, string | null][] = [["platform", null]];
  switch (scope.type) {
    case "platform":
      break;
    case "organization":
      chain.push(["organization", scope.id]);
      break;
    case "college":
      chain.push(["organization", scope.organizationId], ["college", scope.id]);
      break;
    case "club":
      chain.push(["organization", scope.organizationId]);
      if (scope.collegeId) chain.push(["college", scope.collegeId]);
      chain.push(["club", scope.id]);
      break;
    case "event":
      chain.push(["organization", scope.organizationId]);
      if (scope.collegeId) chain.push(["college", scope.collegeId]);
      if (scope.clubId) chain.push(["club", scope.clubId]);
      chain.push(["event", scope.id]);
      break;
  }
  return chain;
}

export function grantsAt(grants: Grant[], scope: Scope): Grant[] {
  const chain = scopeChain(scope);
  return grants.filter((g) => chain.some(([t, id]) => g.scopeType === t && g.scopeId === id));
}

export function effectivePermissions(grants: Grant[], scope: Scope): Set<string> {
  const out = new Set<string>();
  for (const g of grantsAt(grants, scope)) for (const p of g.permissions) out.add(p);
  return out;
}

export function allows(grants: Grant[], permission: string, scope: Scope): boolean {
  return permissionSetAllows(effectivePermissions(grants, scope), permission);
}

/** True if any grant anywhere (any scope) carries `permission`. Used for navigation only. */
export function allowsAnywhere(grants: Grant[], permission: string): boolean {
  return grants.some((g) => permissionSetAllows(g.permissions, permission));
}

/**
 * Escalation guard: a granter may only hand out a role whose permissions they
 * themselves hold at the target scope, and must hold `access.grant` there.
 */
export function canGrant(
  granterGrants: Grant[],
  role: { key: string; permissions: string[] },
  scope: Scope,
  protectedKeys: string[],
): { ok: true } | { ok: false; reason: string } {
  const mine = effectivePermissions(granterGrants, scope);
  if (protectedKeys.includes(role.key) && !mine.has("*")) {
    return { ok: false, reason: "Only a super admin can grant or revoke admin roles." };
  }
  if (!permissionSetAllows(mine, "access.grant")) {
    return { ok: false, reason: "You do not have permission to grant access in this scope." };
  }
  const missing = role.permissions.filter((p) => !permissionSetAllows(mine, p));
  if (missing.length) {
    return {
      ok: false,
      reason: `You cannot grant permissions you do not hold here (${missing.slice(0, 3).join(", ")}${
        missing.length > 3 ? "…" : ""
      }).`,
    };
  }
  return { ok: true };
}
