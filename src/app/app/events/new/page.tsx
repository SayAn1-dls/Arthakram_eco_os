import { asc } from "drizzle-orm";
import { db } from "@/db";
import { clubs, organizations } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { can, clubScope } from "@/server/rbac";
import { createEvent } from "@/server/actions/events";
import { EventForm } from "@/components/event-form";
import { Card, Forbidden, PageHeader } from "@/components/ui";

export const metadata = { title: "Event Builder" };

export default async function NewEventPage() {
  const user = await requireUser();
  const orgs = new Map(db.select().from(organizations).all().map((o) => [o.id, o.name]));
  const allowed: { value: string; label: string }[] = [];
  for (const c of db.select().from(clubs).orderBy(asc(clubs.name)).all()) {
    const scope = await clubScope(c.id);
    if (scope && (await can(user.id, "events.create", scope))) allowed.push({ value: c.id, label: `${c.name} · ${orgs.get(c.organizationId)}` });
  }
  if (!allowed.length) return <Forbidden message="You need event-creation access for a club. Ask an admin or your club lead." />;
  return (
    <>
      <PageHeader title="Create an event" description="Fill in the basics now. You can change any of it later, and nothing is public until you publish." />
      <Card>
        <EventForm action={createEvent} clubs={allowed} submitLabel="Create event workspace" />
      </Card>
    </>
  );
}
