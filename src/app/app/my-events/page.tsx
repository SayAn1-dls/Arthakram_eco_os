import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, participants, teams } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { createTeam, joinTeam, withdrawFromEvent } from "@/server/actions/student";
import { ActionButton, ActionForm, Field, Input, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { fmtDate, fmtTime, humanize } from "@/lib/format";

export const metadata = { title: "My events" };

export default async function MyEvents() {
  const user = await requireUser();
  const rows = db
    .select({ p: participants, e: events, team: teams })
    .from(participants)
    .innerJoin(events, eq(events.id, participants.eventId))
    .leftJoin(teams, eq(teams.id, participants.teamId))
    .where(eq(participants.userId, user.id))
    .orderBy(desc(events.startsAt))
    .all();
  const live = rows.filter((r) => ["live", "published"].includes(r.e.status));
  const past = rows.filter((r) => !["live", "published"].includes(r.e.status));
  return (
    <>
      <PageHeader eyebrow="You" title="My events" description="Everything you've registered for. Your team workspace has the live timer, submissions and announcements." actions={<LinkButton href="/events" variant="outline">Find events</LinkButton>} />
      {rows.length === 0 && <EmptyState title="You haven't joined any events yet" action={<LinkButton href="/app/opportunities">See recommended opportunities</LinkButton>} />}
      <div className="space-y-5">
        {live.map(({ p, e, team }) => (
          <Card key={p.id} className={e.status === "live" ? "border-brand" : ""}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={e.status} />
                  <span className="text-xs text-muted">{humanize(e.type)}</span>
                </div>
                <h2 className="mt-2 text-xl font-extrabold">
                  <Link href={`/events/${e.slug}`} className="hover:text-brand-deep">
                    {e.title}
                  </Link>
                </h2>
                <p className="text-sm text-muted">
                  {fmtDate(e.startsAt)} · {fmtTime(e.startsAt)} · {e.venue ?? humanize(e.mode)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={p.status === "confirmed" ? "ok" : "warn"}>{humanize(p.status)}</Badge>
                  {p.checkedInAt ? <Badge tone="ok">Checked in</Badge> : <Link href={`/app/checkin/${p.checkinToken}`} className="text-xs font-semibold text-brand-deep hover:underline">Show my check-in pass →</Link>}
                </div>
              </div>
              {team ? (
                <div className="text-right">
                  <div className="text-xs text-muted">Your team</div>
                  <div className="text-lg font-bold">{team.name}</div>
                  <LinkButton href={`/app/team/${team.id}`} className="mt-2">
                    Open team workspace
                  </LinkButton>
                </div>
              ) : e.teamSizeMax > 1 ? (
                <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
                  <ActionForm action={createTeam} hidden={{ eventId: e.id }} className="space-y-2">
                    <Field label="Create a team">
                      <Input name="name" placeholder="Team name" required />
                    </Field>
                    <SubmitButton size="sm">Create</SubmitButton>
                  </ActionForm>
                  <ActionForm action={joinTeam} hidden={{ eventId: e.id }} className="space-y-2">
                    <Field label="…or join with an invite code">
                      <Input name="inviteCode" placeholder="Paste code" required />
                    </Field>
                    <SubmitButton size="sm" variant="outline">
                      Join
                    </SubmitButton>
                  </ActionForm>
                </div>
              ) : null}
            </div>
            {e.status === "published" && (
              <div className="mt-4 border-t border-line pt-3">
                <ActionButton action={withdrawFromEvent} hidden={{ eventId: e.id }} variant="ghost" confirm={`Withdraw from ${e.title}?`}>
                  Withdraw registration
                </ActionButton>
              </div>
            )}
          </Card>
        ))}
      </div>
      {past.length > 0 && (
        <>
          <h2 className="eyebrow mb-3 mt-10">Past events</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {past.map(({ p, e, team }) => (
              <Card key={p.id}>
                <div className="flex items-center justify-between">
                  <Link href={`/events/${e.slug}`} className="font-bold text-ink hover:text-brand-deep">
                    {e.title}
                  </Link>
                  <StatusBadge status={e.status} />
                </div>
                <div className="mt-1 text-sm text-muted">
                  {fmtDate(e.startsAt)}
                  {team && (
                    <>
                      {" "}
                      · <Link href={`/app/team/${team.id}`} className="hover:text-brand-deep">{team.name}</Link>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
