import { desc } from "drizzle-orm";
import { db } from "@/db";
import { clubs, events, organizations } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { DataTable } from "@/components/data-table";
import { Forbidden, LinkButton, PageHeader } from "@/components/ui";
import { fmtDate, humanize } from "@/lib/format";

export const metadata = { title: "All events" };

export default async function AllEvents() {
  const me = await adminPage("events.view");
  if (!me) return <Forbidden />;
  const orgs = new Map(db.select().from(organizations).all().map((o) => [o.id, o.name]));
  const cl = new Map(db.select().from(clubs).all().map((c) => [c.id, c.name]));
  const list = db.select().from(events).orderBy(desc(events.startsAt)).all();
  return (
    <>
      <PageHeader eyebrow="Admin" title="All events & competitions" description="Every event across every organization." actions={<LinkButton href="/app/events/new">New event</LinkButton>} />
      <DataTable
        columns={[
          { key: "title", label: "Event" },
          { key: "type", label: "Type" },
          { key: "org", label: "Organization" },
          { key: "club", label: "Club" },
          { key: "starts", label: "Starts" },
          { key: "status", label: "Status", kind: "status" },
          { key: "results", label: "Results" },
        ]}
        rows={list.map((e) => ({
          id: e.id,
          href: `/app/events/${e.id}`,
          title: e.title,
          type: humanize(e.type),
          org: orgs.get(e.organizationId),
          club: e.clubId ? cl.get(e.clubId) : "",
          starts: fmtDate(e.startsAt),
          status: e.status,
          results: e.resultsPublished ? "Published" : e.resultsVerifiedAt ? "Verified" : "",
        }))}
        filters={[
          { key: "status", label: "Statuses", options: ["draft", "published", "live", "completed", "archived"] },
          { key: "org", label: "Organizations", options: [...orgs.values()] },
        ]}
      />
    </>
  );
}
