import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { rolePermissions, roleAssignments, roles, users, type ScopeType } from "@/db/schema";
import { PROTECTED_ROLE_KEYS } from "@/lib/permissions";
import { canGrant, scopeChain, type Scope } from "@/lib/rbac-core";
import { loadGrants } from "@/server/rbac";
import { grantRole, revokeAssignment } from "@/server/actions/access";
import { ActionButton, ActionForm, Field, Input, Select, SubmitButton } from "./forms";
import { Avatar, Badge, Card, Table, Td, Th } from "./ui";
import { fmtDate } from "@/lib/format";

/** Grant / revoke panel for one scope. All checks are re-run server-side in the actions. */
export async function AccessManager({ viewerId, scope, scopeLabel }: { viewerId: string; scope: Scope; scopeLabel: string }) {
  const scopeId = scope.type === "platform" ? null : scope.id;
  const grants = await loadGrants(viewerId);
  const allRoles = db.select().from(roles).orderBy(asc(roles.name)).all();
  const grantable = allRoles.filter((r) => {
    const perms = db.select({ p: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, r.id)).all().map((x) => x.p);
    return canGrant(grants, { key: r.key, permissions: perms }, scope, PROTECTED_ROLE_KEYS).ok;
  });
  const chain = scopeChain(scope);
  const rows = db
    .select({ a: roleAssignments, role: roles, user: users })
    .from(roleAssignments)
    .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
    .innerJoin(users, eq(users.id, roleAssignments.userId))
    .where(
      and(
        isNull(roleAssignments.revokedAt),
        or(...chain.map(([t, id]) => and(eq(roleAssignments.scopeType, t as ScopeType), id ? eq(roleAssignments.scopeId, id) : isNull(roleAssignments.scopeId)))),
      ),
    )
    .orderBy(asc(users.name))
    .all()
    .filter((r) => r.role.key !== "student" && r.role.key !== "mentor");
  const direct = rows.filter((r) => r.a.scopeType === scope.type && (r.a.scopeId ?? null) === scopeId);
  const inherited = rows.filter((r) => !(r.a.scopeType === scope.type && (r.a.scopeId ?? null) === scopeId));
  const grantableIds = new Set(grantable.map((g) => g.id));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card title={`Direct access on ${scopeLabel}`} eyebrow={`${direct.length} grants`} padded={false}>
          <Table className="rounded-none border-0">
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Role</Th>
                <Th>Granted</Th>
                <Th>Expires</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {direct.length === 0 && (
                <tr>
                  <Td colSpan={5} className="py-6 text-center text-muted">
                    No one has direct access here yet.
                  </Td>
                </tr>
              )}
              {direct.map(({ a, role, user }) => (
                <tr key={a.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar name={user.name} size={26} />
                      <div>
                        <div className="font-semibold text-ink">{user.name}</div>
                        <div className="text-xs text-muted">{user.email}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: role.color }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: role.color }} />
                      {role.name}
                    </span>
                    {a.note && <div className="text-xs text-muted">{a.note}</div>}
                  </Td>
                  <Td className="text-xs">{fmtDate(a.createdAt)}</Td>
                  <Td className="text-xs">{a.expiresAt ? fmtDate(a.expiresAt) : "Never"}</Td>
                  <Td className="text-right">
                    {grantableIds.has(role.id) ? (
                      <ActionButton action={revokeAssignment} hidden={{ assignmentId: a.id }} variant="danger" confirm={`Revoke ${role.name} from ${user.name}? This takes effect immediately.`}>
                        Revoke
                      </ActionButton>
                    ) : (
                      <Badge>Locked</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        {inherited.length > 0 && (
          <Card title="Inherited access" eyebrow="Granted on a parent scope — manage it there">
            <ul className="grid gap-2 sm:grid-cols-2">
              {inherited.map(({ a, role, user }) => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={user.name} size={24} />
                  <span className="font-semibold text-ink">{user.name}</span>
                  <Badge>{role.name}</Badge>
                  <span className="text-xs text-muted">via {a.scopeType}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <Card title="Grant access" eyebrow={scopeLabel}>
        {grantable.length === 0 ? (
          <p className="text-sm text-muted">You can’t grant any roles here.</p>
        ) : (
          <ActionForm action={grantRole} hidden={{ scopeType: scope.type, scopeId: scopeId ?? "" }} resetOnSuccess className="space-y-3">
            <Field label="Person’s email">
              <Input type="email" name="email" required />
            </Field>
            <Field label="Role" hint="Only roles whose permissions you hold here are listed.">
              <Select name="roleId" required options={grantable.map((r) => ({ value: r.id, label: r.name }))} placeholder="Choose role…" />
            </Field>
            <Field label="Expires (optional)">
              <Input type="date" name="expiresAt" />
            </Field>
            <Field label="Note">
              <Input name="note" placeholder="e.g. Hackathon volunteer, day 1" />
            </Field>
            <SubmitButton className="w-full">Grant access</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}
