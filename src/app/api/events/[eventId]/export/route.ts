import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { participants, rooms, submissions, teams, users, eventRounds } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { audit } from "@/server/audit";
import { getEvent } from "@/server/events";
import { can, eventScopeOf } from "@/server/rbac";
import { computeResults } from "@/server/results";

const csv = (rows: (string | number | null | undefined)[][]) =>
  rows
    .map((r) =>
      r
        .map((v) => {
          let s = v == null ? "" : String(v);
          if (/^[=+\-@]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");

/** CSV export of event tables. Requires events.export on the event. */
export async function GET(req: Request, ctx: RouteContext<"/api/events/[eventId]/export">) {
  const { eventId } = await ctx.params;
  const table = new URL(req.url).searchParams.get("table") ?? "participants";
  const user = await getCurrentUser();
  const event = await getEvent(eventId);
  if (!user || !event) return new Response("Not found", { status: 404 });
  if (!(await can(user.id, "events.export", eventScopeOf(event)))) return new Response("Forbidden", { status: 403 });

  let rows: (string | number | null)[][] = [];
  if (table === "participants") {
    rows = [["Name", "Email", "College", "Team", "Status", "Checked in"]];
    for (const p of db
      .select({ name: users.name, email: users.email, college: participants.college, team: teams.name, status: participants.status, checkedInAt: participants.checkedInAt })
      .from(participants)
      .innerJoin(users, eq(users.id, participants.userId))
      .leftJoin(teams, eq(teams.id, participants.teamId))
      .where(eq(participants.eventId, eventId))
      .all())
      rows.push([p.name, p.email, p.college, p.team, p.status, p.checkedInAt ? p.checkedInAt.toISOString() : ""]);
  } else if (table === "teams") {
    rows = [["Code", "Team", "Status", "Room", "Members"]];
    for (const t of db.select({ id: teams.id, code: teams.code, name: teams.name, status: teams.status, room: rooms.name }).from(teams).leftJoin(rooms, eq(rooms.id, teams.roomId)).where(eq(teams.eventId, eventId)).all()) {
      const members = db.select({ n: users.name }).from(participants).innerJoin(users, eq(users.id, participants.userId)).where(eq(participants.teamId, t.id)).all().map((m) => m.n);
      rows.push([t.code, t.name, t.status, t.room, members.join("; ")]);
    }
  } else if (table === "submissions") {
    rows = [["Round", "Team", "Status", "Title", "Repo", "Demo", "Deck", "Video", "Submitted at"]];
    for (const s of db
      .select({ round: eventRounds.name, team: teams.name, s: submissions })
      .from(submissions)
      .innerJoin(teams, eq(teams.id, submissions.teamId))
      .innerJoin(eventRounds, eq(eventRounds.id, submissions.roundId))
      .where(and(eq(submissions.eventId, eventId)))
      .all())
      rows.push([s.round, s.team, s.s.status, s.s.title, s.s.repoUrl, s.s.demoUrl, s.s.deckUrl, s.s.videoUrl, s.s.submittedAt?.toISOString() ?? ""]);
  } else if (table === "results") {
    if (!(await can(user.id, "evaluations.view", eventScopeOf(event)))) return new Response("Forbidden", { status: 403 });
    const r = computeResults(eventId);
    rows = [["Rank", "Team", "Average", "Judges", ...r.criteria.map((c) => `${c.name} (${c.weight}%)`)]];
    for (const x of r.rows) rows.push([x.rank, x.teamName, x.average, x.judgeCount, ...r.criteria.map((c) => x.criteria[c.id] ?? "")]);
  } else return new Response("Unknown table", { status: 400 });

  audit({ actorId: user.id, action: "event.export", resourceType: "event", resourceId: eventId, eventId, summary: `${user.name} exported ${table} as CSV` });
  return new Response(csv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${event.slug}-${table}.csv"` },
  });
}
