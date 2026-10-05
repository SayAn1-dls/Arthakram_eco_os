import { and, count, desc, eq, like, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, events, users } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { AuditTable } from "@/components/audit-table";
import { Input, Select } from "@/components/forms";
import { Forbidden, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Audit log" };

const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; action?: string; event?: string; page?: string }> }) {
  const sp = await searchParams;
  const me = await adminPage("audit.view");
  if (!me) return <Forbidden />;
  const page = Math.max(1, Number(sp.page ?? 1));
  const where: SQL[] = [];
  if (sp.q) where.push(like(auditLogs.summary, `%${sp.q.replace(/[%_]/g, "")}%`));
  if (sp.action) where.push(like(auditLogs.action, `${sp.action}.%`));
  if (sp.event) where.push(eq(auditLogs.eventId, sp.event));
  const cond = where.length ? and(...where) : undefined;
  const total = db.select({ n: count() }).from(auditLogs).where(cond).get()?.n ?? 0;
  const rows = db
    .select({ id: auditLogs.id, summary: auditLogs.summary, action: auditLogs.action, resourceType: auditLogs.resourceType, createdAt: auditLogs.createdAt, before: auditLogs.before, after: auditLogs.after, actor: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(cond)
    .orderBy(desc(auditLogs.createdAt))
    .limit(PAGE)
    .offset((page - 1) * PAGE)
    .all();
  const evs = db.select({ value: events.id, label: events.title }).from(events).all();
  const qs = (p: number) => `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.action ? { action: sp.action } : {}), ...(sp.event ? { event: sp.event } : {}), page: String(p) })}`;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Audit log" description="Append-only record of every important action: who, what, where, when — with before and after values." />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px_240px_auto]">
        <Input name="q" defaultValue={sp.q} placeholder="Search summaries…" />
        <Select name="action" defaultValue={sp.action ?? ""} options={["access", "event", "timer", "evaluation", "results", "document", "rubric", "user", "role", "team", "attendance", "submission", "qr", "announcement"]} placeholder="All actions" />
        <Select name="event" defaultValue={sp.event ?? ""} options={evs} placeholder="All events" />
        <button className="h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">Filter</button>
      </form>
      <AuditTable rows={rows} />
      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>
          {total} entries · page {page} of {Math.max(1, Math.ceil(total / PAGE))}
        </span>
        <span className="flex gap-2">
          {page > 1 && (
            <LinkButton href={qs(page - 1)} variant="outline" size="sm">
              Newer
            </LinkButton>
          )}
          {page * PAGE < total && (
            <LinkButton href={qs(page + 1)} variant="outline" size="sm">
              Older
            </LinkButton>
          )}
        </span>
      </div>
    </>
  );
}
