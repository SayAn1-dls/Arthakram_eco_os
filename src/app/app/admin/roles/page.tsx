import Link from "next/link";
import { asc, count, eq, isNull, and } from "drizzle-orm";
import { db } from "@/db";
import { roleAssignments, rolePermissions, roles } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { can, PLATFORM } from "@/server/rbac";
import { saveRole } from "@/server/actions/access";
import { ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { PermissionMatrix } from "@/components/permission-matrix";
import { Badge, Card, Forbidden, PageHeader, Table, Td, Th } from "@/components/ui";
import { ALL_PERMISSIONS } from "@/lib/permissions";

export const metadata = { title: "Roles & permissions" };

export default async function RolesPage() {
  const me = await adminPage("roles.view");
  if (!me) return <Forbidden />;
  const canManage = await can(me.id, "roles.manage", PLATFORM);
  const list = db.select().from(roles).orderBy(asc(roles.isSystem), asc(roles.name)).all();
  const permCount = (id: string) => db.select({ p: rolePermissions.permission }).from(rolePermissions).where(eq(rolePermissions.roleId, id)).all().map((r) => r.p);
  const holders = (id: string) => db.select({ n: count() }).from(roleAssignments).where(and(eq(roleAssignments.roleId, id), isNull(roleAssignments.revokedAt))).get()?.n ?? 0;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Roles & permissions" description="A role is a named set of permissions. Grant it to a person at a scope (platform, organization, college, club or event). Permissions flow down the hierarchy — never sideways." />
      <Table className="mb-8">
        <thead>
          <tr>
            <Th>Role</Th>
            <Th>Type</Th>
            <Th>Permissions</Th>
            <Th>Active holders</Th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const perms = permCount(r.id);
            return (
              <tr key={r.id}>
                <Td>
                  <Link href={`/app/admin/roles/${r.id}`} className="inline-flex items-center gap-2 font-bold text-ink hover:text-brand-deep">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                    {r.name}
                  </Link>
                  <div className="text-xs text-muted">{r.description}</div>
                </Td>
                <Td>{r.isSystem ? <Badge>System</Badge> : <Badge tone="brand">Custom</Badge>}</Td>
                <Td className="tabular">{perms.includes("*") ? "All (*)" : `${perms.length} / ${ALL_PERMISSIONS.length}`}</Td>
                <Td className="tabular">{holders(r.id)}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {canManage && (
        <Card title="Create custom role" eyebrow="e.g. Documentation Manager, Sponsor Liaison, Registration Desk">
          <ActionForm action={saveRole} className="space-y-5">
            <div className="grid gap-3 md:grid-cols-[1fr_2fr_120px]">
              <Field label="Name">
                <Input name="name" required />
              </Field>
              <Field label="Description">
                <Input name="description" />
              </Field>
              <Field label="Colour">
                <Input type="color" name="color" defaultValue="#0E7490" className="!p-1" />
              </Field>
            </div>
            <PermissionMatrix selected={new Set()} />
            <SubmitButton size="lg">Create role</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
