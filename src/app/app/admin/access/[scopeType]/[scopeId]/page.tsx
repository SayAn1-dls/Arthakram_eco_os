import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs, colleges, organizations } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { can, resolveScope } from "@/server/rbac";
import { AccessManager } from "@/components/access-manager";
import { Forbidden, PageHeader } from "@/components/ui";

export const metadata = { title: "Access" };

/** Generic access panel for organization / college / club / platform scopes. */
export default async function ScopeAccess({ params }: { params: Promise<{ scopeType: string; scopeId: string }> }) {
  const { scopeType, scopeId } = await params;
  const user = await requireUser();
  const scope = await resolveScope(scopeType, scopeType === "platform" ? null : scopeId);
  if (!scope) notFound();
  if (!(await can(user.id, "access.grant", scope))) return <Forbidden />;
  const label =
    scopeType === "platform"
      ? "the platform"
      : scopeType === "club"
        ? db.select().from(clubs).where(eq(clubs.id, scopeId)).get()?.name
        : scopeType === "college"
          ? db.select().from(colleges).where(eq(colleges.id, scopeId)).get()?.name
          : db.select().from(organizations).where(eq(organizations.id, scopeId)).get()?.name;
  return (
    <>
      <Link href="/app/admin/organizations" className="text-sm text-muted hover:text-brand-deep">
        ← Organizations
      </Link>
      <PageHeader eyebrow={`${scopeType} access`} title={label ?? scopeId} description="Grants here apply to everything beneath this scope." />
      <AccessManager viewerId={user.id} scope={scope} scopeLabel={label ?? scopeId} />
    </>
  );
}
