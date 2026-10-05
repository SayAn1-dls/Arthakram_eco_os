import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { roleAssignments, rolePermissions, roles, users } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { can, PLATFORM } from "@/server/rbac";
import { deleteRole, saveRole } from "@/server/actions/access";
import { ActionButton, ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { PermissionMatrix } from "@/components/permission-matrix";
import { Badge, Card, Forbidden } from "@/components/ui";

export default async function RoleDetail({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const me = await adminPage("roles.view");
  if (!me) return <Forbidden />;
  const role = db.select().from(roles).where(eq(roles.id, roleId)).get();
  if (!role) notFound();
  const perms = new Set(db.select({ p: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, roleId)).all().map((r) => r.p));
  const holders = db
    .select({ name: users.name, id: users.id, scope: roleAssignments.scopeType })
    .from(roleAssignments)
    .innerJoin(users, eq(users.id, roleAssignments.userId))
    .where(and(eq(roleAssignments.roleId, roleId), isNull(roleAssignments.revokedAt)))
    .all();
  const editable = !role.isSystem && (await can(me.id, "roles.manage", PLATFORM));
  return (
    <div className="space-y-6">
      <Link href="/app/admin/roles" className="text-sm text-muted hover:text-brand-deep">
        ← Roles
      </Link>
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 rounded-full" style={{ background: role.color }} />
        <h1 className="text-3xl font-extrabold">{role.name}</h1>
        {role.isSystem ? <Badge>System role — fixed</Badge> : <Badge tone="brand">Custom</Badge>}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Card>
          <ActionForm action={saveRole} hidden={{ roleId }} className="space-y-5">
            {editable && (
              <div className="grid gap-3 md:grid-cols-[1fr_2fr_120px]">
                <Field label="Name">
                  <Input name="name" defaultValue={role.name} required />
                </Field>
                <Field label="Description">
                  <Input name="description" defaultValue={role.description ?? ""} />
                </Field>
                <Field label="Colour">
                  <Input type="color" name="color" defaultValue={role.color} className="!p-1" />
                </Field>
              </div>
            )}
            {!editable && <p className="text-sm text-muted">{role.description}</p>}
            <PermissionMatrix selected={perms} disabled={!editable} />
            {editable && <SubmitButton size="lg">Save role</SubmitButton>}
          </ActionForm>
        </Card>
        <div className="space-y-6">
          <Card title="Held by" eyebrow={`${holders.length} active grants`}>
            <ul className="space-y-1.5 text-sm">
              {holders.slice(0, 40).map((h, i) => (
                <li key={i} className="flex justify-between">
                  <Link href={`/app/admin/users/${h.id}`} className="text-ink hover:text-brand-deep">
                    {h.name}
                  </Link>
                  <span className="text-xs text-muted">{h.scope}</span>
                </li>
              ))}
            </ul>
          </Card>
          {editable && (
            <ActionButton action={deleteRole} hidden={{ roleId }} variant="danger" confirm={`Delete role ${role.name}?`}>
              Delete role
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}
