import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { roleAssignments, roles, users } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { createUser } from "@/server/actions/access";
import { DataTable } from "@/components/data-table";
import { ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { Card, Forbidden, PageHeader } from "@/components/ui";
import { fmtDate, fmtRelative } from "@/lib/format";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await adminPage("users.view");
  if (!me) return <Forbidden />;
  const list = db.select().from(users).orderBy(asc(users.name)).all();
  const ra = db
    .select({ userId: roleAssignments.userId, role: roles.name, scope: roleAssignments.scopeType })
    .from(roleAssignments)
    .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
    .where(and(isNull(roleAssignments.revokedAt)))
    .all();
  const rolesOf = (id: string) => [...new Set(ra.filter((r) => r.userId === id).map((r) => (r.scope === "platform" ? r.role : `${r.role} (${r.scope})`)))];
  const roleNames = [...new Set(ra.map((r) => r.role))];
  return (
    <>
      <PageHeader eyebrow="Admin" title="Users" description="Select a person to grant or revoke access at any scope — platform, organization, college, club or event." />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <DataTable
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email", kind: "muted" },
            { key: "roles", label: "Roles", kind: "tags", sortable: false },
            { key: "status", label: "Status", kind: "status" },
            { key: "joined", label: "Joined" },
            { key: "lastLogin", label: "Last sign-in", kind: "muted" },
          ]}
          rows={list.map((u) => ({
            id: u.id,
            href: `/app/admin/users/${u.id}`,
            name: u.name,
            email: u.email,
            roles: rolesOf(u.id),
            primaryRole: rolesOf(u.id).join(" "),
            status: u.status,
            joined: fmtDate(u.createdAt),
            lastLogin: u.lastLoginAt ? fmtRelative(u.lastLoginAt) : "never",
          }))}
          filters={[{ key: "status", label: "Statuses", options: ["active", "suspended"] }]}
          searchPlaceholder={`Search ${list.length} users by name, email or role (${roleNames.slice(0, 3).join(", ")}…)`}
        />
        <Card title="Create account" eyebrow="Generates a temporary password">
          <ActionForm action={createUser} resetOnSuccess className="space-y-3">
            <Field label="Full name">
              <Input name="name" required />
            </Field>
            <Field label="Email">
              <Input type="email" name="email" required />
            </Field>
            <Field label="Headline">
              <Input name="headline" placeholder="e.g. Industry judge" />
            </Field>
            <SubmitButton className="w-full">Create account</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
