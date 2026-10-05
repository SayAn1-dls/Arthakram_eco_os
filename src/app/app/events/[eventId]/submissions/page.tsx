import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { files, submissions, teams } from "@/db/schema";
import { eventAccess, roundsFor } from "@/server/events";
import { setSubmissionStatus } from "@/server/actions/competition";
import { DataTable } from "@/components/data-table";
import { Card, Forbidden, Stat, StatRow } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Submissions" };

export default async function SubmissionsPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ round?: string }> }) {
  const { eventId } = await params;
  const { round: rp } = await searchParams;
  const { event, has } = await eventAccess(eventId);
  if (!has("submissions.view")) return <Forbidden />;
  const rounds = roundsFor(eventId);
  const round = rounds.find((r) => r.id === rp) ?? rounds.find((r) => r.id === event.currentRoundId) ?? rounds[0];
  if (!round) return <Card>No rounds yet.</Card>;
  const teamRows = db.select().from(teams).where(and(eq(teams.eventId, eventId), eq(teams.status, "active"))).all();
  const subs = db.select().from(submissions).where(eq(submissions.roundId, round.id)).all();
  const fileCount = new Map<string, number>();
  for (const s of subs) fileCount.set(s.id, db.select({ id: files.id }).from(files).where(eq(files.submissionId, s.id)).all().length);
  const rows = teamRows
    .map((t) => {
      const s = subs.find((x) => x.teamId === t.id);
      const links = s ? [s.repoUrl && "Repo", s.demoUrl && "Demo", s.deckUrl && "Deck", s.videoUrl && "Video", s.docsUrl && "Docs", fileCount.get(s.id) ? `${fileCount.get(s.id)} file(s)` : null].filter(Boolean) : [];
      return {
        id: s?.id ?? `none-${t.id}`,
        href: `/app/events/${eventId}/teams/${t.id}`,
        team: t.name,
        title: s?.title ?? "",
        status: s?.status ?? "not_started",
        links: links as string[],
        submitted: s?.submittedAt ? fmtDateTime(s.submittedAt) : "",
      };
    })
    .sort((a, b) => a.team.localeCompare(b.team));
  const count = (st: string[]) => rows.filter((r) => st.includes(r.status)).length;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {rounds.map((r) => (
          <a key={r.id} href={`?round=${r.id}`} className={`rounded-full border px-3 py-1 text-sm font-semibold ${r.id === round.id ? "border-brand bg-brand text-white" : "border-line bg-card text-ink-2 hover:border-brand"}`}>
            {r.name}
          </a>
        ))}
      </div>
      <StatRow className="lg:grid-cols-4">
        <Stat value={`${count(["submitted", "under_review", "reviewed", "final"])}/${rows.length}`} label="Submitted" tone="brand" hint={round.submissionDeadline ? `Deadline ${fmtDateTime(round.submissionDeadline)}` : undefined} />
        <Stat value={count(["draft"])} label="Drafts in progress" />
        <Stat value={count(["not_started"])} label="Not started" />
        <Stat value={count(["under_review", "reviewed"])} label="Being judged" />
      </StatRow>
      <DataTable
        columns={[
          { key: "team", label: "Team" },
          { key: "title", label: "Title" },
          { key: "links", label: "Deliverables", kind: "tags", sortable: false },
          { key: "submitted", label: "Submitted" },
          { key: "status", label: "Status", kind: "status" },
        ]}
        rows={rows}
        filters={[{ key: "status", label: "Statuses", options: ["not_started", "draft", "submitted", "under_review", "reviewed", "final"] }]}
        bulkActions={
          has("submissions.manage")
            ? [{ label: "Set status", action: setSubmissionStatus, hidden: { eventId }, select: { name: "status", placeholder: "Status…", options: ["submitted", "under_review", "reviewed", "final"].map((s) => ({ value: s, label: s })) } }]
            : []
        }
        exportHref={has("events.export") ? `/api/events/${eventId}/export?table=submissions` : undefined}
      />
    </div>
  );
}
