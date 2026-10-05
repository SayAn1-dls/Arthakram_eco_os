import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, clubs, colleges, events, organizations, roleAssignments, roles, users } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { loadGrants } from "@/server/rbac";
import { grantRole, resetPassword, revokeAssignment, setUserStatus } from "@/server/actions/access";
import { ActionButton, ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { AuditTable } from "@/components/audit-table";
import { Avatar, Badge, Card, Forbidden, StatusBadge, Table, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export default async function UserDetail({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const me = await adminPage("users.view");
  if (!me) return <Forbidden />;
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  if (!u) notFound();
  const history = db.select({ a: roleAssignments, role: roles }).from(roleAssignments).innerJoin(roles, eq(roles.id, roleAssignments.roleId)).where(eq(roleAssignments.userId, userId)).orderBy(desc(roleAssignments.createdAt)).all();
  const names = new Map<string, string>([
    ...db.select({ id: events.id, n: events.title }).from(events).all().map((r) => [r.id, r.n] as [string, string]),
    ...db.select({ id: clubs.id, n: clubs.name }).from(clubs).all().map((r) => [r.id, r.n] as [string, string]),
    ...db.select({ id: colleges.id, n: colleges.name }).from(colleges).all().map((r) => [r.id, r.n] as [string, string]),
    ...db.select({ id: organizations.id, n: organizations.name }).from(organizations).all().map((r) => [r.id, r.n] as [string, string]),
  ]);
  const scopeOpts = (t: string) =>
    t === "event"
      ? db.select({ value: events.id, label: events.title }).from(events).orderBy(asc(events.title)).all()
      : t === "club"
        ? db.select({ value: clubs.id, label: clubs.name }).from(clubs).orderBy(asc(clubs.name)).all()
        : t === "college"
          ? db.select({ value: colleges.id, label: colleges.name }).from(colleges).all()
          : db.select({ value: organizations.id, label: organizations.name }).from(organizations).all();
  const allRoles = db.select().from(roles).orderBy(asc(roles.name)).all();
  const log = db
    .select({ id: auditLogs.id, summary: auditLogs.summary, action: auditLogs.action, resourceType: auditLogs.resourceType, createdAt: auditLogs.createdAt, before: auditLogs.before, after: auditLogs.after, actor: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(or(eq(auditLogs.actorId, userId), eq(auditLogs.resourceId, userId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(30)
    .all();
  const effective = await loadGrants(userId);
  return (
    <div className="space-y-6">
      <Link href="/app/admin/users" className="text-sm text-muted hover:text-brand-deep">
        ← Users
      </Link>
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={u.name} size={56} />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{u.name}</h1>
            <div className="text-sm text-muted">
              {u.email} · joined {fmtDate(u.createdAt)} {u.headline && `· ${u.headline}`}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <StatusBadge status={u.status} />
              {effective.map((g) => (
                <Badge key={g.assignmentId} tone="brand">
                  {g.roleName}
                  {g.scopeType !== "platform" && ` · ${names.get(g.scopeId!) ?? g.scopeType}`}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <ActionButton action={resetPassword} hidden={{ userId }} confirm={`Reset ${u.name}'s password and sign them out everywhere?`}>
              Reset password
            </ActionButton>
            <ActionButton action={setUserStatus} hidden={{ userId }} variant={u.status === "active" ? "danger" : "primary"} confirm={u.status === "active" ? `Suspend ${u.name}? They are signed out immediately.` : `Reactivate ${u.name}?`}>
              {u.status === "active" ? "Suspend" : "Reactivate"}
            </ActionButton>
          </div>
        </div>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card title="Access & permission history" padded={false}>
          <Table className="rounded-none border-0">
            <thead>
              <tr>
                <Th>Role</Th>
                <Th>Scope</Th>
                <Th>Granted</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {history.map(({ a, role }) => (
                <tr key={a.id} className={a.revokedAt ? "opacity-55" : ""}>
                  <Td className="font-semibold" >
                    <span style={{ color: role.color }}>{role.name}</span>
                  </Td>
                  <Td>{a.scopeType === "platform" ? "Platform" : `${a.scopeType}: ${names.get(a.scopeId!) ?? a.scopeId}`}</Td>
                  <Td className="text-xs">{fmtDate(a.createdAt)}</Td>
                  <Td className="text-xs">{a.revokedAt ? `Revoked ${fmtDate(a.revokedAt)}` : a.expiresAt ? `Until ${fmtDate(a.expiresAt)}` : "Active"}</Td>
                  <Td className="text-right">
                    {!a.revokedAt && (
                      <ActionButton action={revokeAssignment} hidden={{ assignmentId: a.id }} variant="danger" confirm={`Revoke ${role.name}?`}>
                        Revoke
                      </ActionButton>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card title="Grant access">
          <p className="mb-3 text-xs text-muted">Pick a role and where it applies. Example: Event A → Organizer, Event B → Event Viewer, Event C → Judge.</p>
          {(["platform", "organization", "college", "club", "event"] as const).map((t) => (
            <details key={t} className="mb-2 rounded-lg border border-line p-3" open={t === "event"}>
              <summary className="cursor-pointer text-sm font-semibold capitalize text-ink">{t} level</summary>
              <ActionForm action={grantRole} hidden={{ email: u.email, scopeType: t }} className="mt-3 space-y-2">
                {t !== "platform" && <Select name="scopeId" required options={scopeOpts(t)} placeholder={`Choose ${t}…`} />}
                <Select name="roleId" required options={allRoles.map((r) => ({ value: r.id, label: r.name }))} placeholder="Role…" />
                <Field label="Expires (optional)">
                  <Input type="date" name="expiresAt" />
                </Field>
                <SubmitButton size="sm">Grant</SubmitButton>
              </ActionForm>
            </details>
          ))}
        </Card>
      </div>
      <div>
        <div className="eyebrow mb-3">Activity by and about {u.name.split(" ")[0]}</div>
        <AuditTable rows={log} />
      </div>
    </div>
  );
}
