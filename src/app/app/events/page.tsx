import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { clubs, events } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { eventScopeOf, loadGrants } from "@/server/rbac";
import { allows, allowsAnywhere, grantsAt } from "@/lib/rbac-core";
import { EmptyState, LinkButton, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { fmtDate, humanize } from "@/lib/format";

export const metadata = { title: "Event workspaces" };

export default async function MyEventWorkspaces() {
  const user = await requireUser();
  const grants = await loadGrants(user.id);
  const clubNames = new Map(db.select({ id: clubs.id, name: clubs.name }).from(clubs).all().map((c) => [c.id, c.name]));
  const rows = db
    .select()
    .from(events)
    .orderBy(desc(events.startsAt))
    .all()
    .filter((e) => allows(grants, "events.view", eventScopeOf(e)))
    .map((e) => ({ e, via: [...new Set(grantsAt(grants, eventScopeOf(e)).map((g) => `${g.roleName}${g.scopeType === "event" ? "" : ` (${g.scopeType})`}`))] }));
  const order = ["live", "published", "draft", "completed", "archived"];
  rows.sort((a, b) => order.indexOf(a.e.status) - order.indexOf(b.e.status));
  return (
    <>
      <PageHeader
        eyebrow="Organize"
        title="Manage events"
        description="Events you help run. Open one to see its control room."
        actions={allowsAnywhere(grants, "events.create") ? <LinkButton href="/app/events/new">New event</LinkButton> : null}
      />
      {rows.length === 0 ? (
        <EmptyState title="No event workspaces yet">Ask an admin or organizer to give you access to an event.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Event</Th>
              <Th>Status</Th>
              <Th>Club</Th>
              <Th>Dates</Th>
              <Th>Your access</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, via }) => (
              <tr key={e.id} className="hover:bg-brand-wash/40">
                <Td>
                  <Link href={`/app/events/${e.id}`} className="font-bold text-ink hover:text-brand-deep">
                    {e.title}
                  </Link>
                  <div className="text-xs text-muted">{humanize(e.type)}</div>
                </Td>
                <Td>
                  <StatusBadge status={e.status} />
                </Td>
                <Td>{e.clubId ? clubNames.get(e.clubId) : "—"}</Td>
                <Td className="whitespace-nowrap">{fmtDate(e.startsAt)}</Td>
                <Td className="text-xs">{via.join(", ")}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
