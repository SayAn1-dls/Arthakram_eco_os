import { requireUser } from "@/server/auth";
import { loadGrants } from "@/server/rbac";
import { db } from "@/db";
import { clubs, colleges, events, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { permissionLabel } from "@/lib/permissions";
import { Card, PageHeader, Badge } from "@/components/ui";

export const metadata = { title: "My access" };

function scopeName(type: string, id: string | null) {
  if (!id) return "Entire platform";
  const t = { event: events, club: clubs, college: colleges, organization: organizations }[type as "event"];
  if (!t) return id;
  const row = db.select().from(t).where(eq(t.id, id)).get() as { title?: string; name?: string } | undefined;
  return row?.title ?? row?.name ?? id;
}

export default async function MyAccess() {
  const user = await requireUser();
  const grants = await loadGrants(user.id);
  return (
    <>
      <PageHeader eyebrow="You" title="My access" description="Every role you hold and exactly what it lets you do. Access is granted and revoked by Arthakram admins and organizers — and every change is logged." />
      <div className="space-y-4">
        {grants.map((g) => (
          <Card key={g.assignmentId} title={g.roleName} eyebrow={`${g.scopeType} · ${scopeName(g.scopeType, g.scopeId)}`}>
            {g.permissions.size === 0 ? (
              <p className="text-sm text-muted">Baseline member access: discover, participate, build your passport.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {[...g.permissions].sort().map((p) => (
                  <Badge key={p} tone="neutral">
                    {permissionLabel(p)}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
