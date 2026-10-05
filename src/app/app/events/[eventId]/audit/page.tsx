import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { eventAccess } from "@/server/events";
import { AuditTable } from "@/components/audit-table";
import { Forbidden } from "@/components/ui";

export const metadata = { title: "Event audit log" };

export default async function EventAuditPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { has } = await eventAccess(eventId);
  if (!has("audit.view")) return <Forbidden />;
  const rows = db
    .select({ id: auditLogs.id, summary: auditLogs.summary, action: auditLogs.action, resourceType: auditLogs.resourceType, createdAt: auditLogs.createdAt, before: auditLogs.before, after: auditLogs.after, actor: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(eq(auditLogs.eventId, eventId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(300)
    .all();
  return <AuditTable rows={rows} />;
}
