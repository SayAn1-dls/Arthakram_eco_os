import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eventAccess } from "@/server/events";
import { computeResults } from "@/server/results";
import { publishResults, reopenEvaluation, verifyResults } from "@/server/actions/competition";
import { ActionButton } from "@/components/forms";
import { Badge, Card, EmptyState, Forbidden, LinkButton, StatusBadge, Table, Td, Th } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Results" };

export default async function ResultsPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ round?: string }> }) {
  const { eventId } = await params;
  const { round: rp } = await searchParams;
  const { event, has } = await eventAccess(eventId);
  if (!has("evaluations.view")) return <Forbidden />;
  const res = computeResults(eventId, rp);
  const judgeNames = new Map(db.select({ id: users.id, name: users.name }).from(users).all().map((u) => [u.id, u.name]));
  const maxAvg = Math.max(1, ...res.rows.map((r) => r.average));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {res.rounds
            .slice()
            .reverse()
            .map((r) => (
              <a key={r.id} href={`?round=${r.id}`} className={cn("rounded-full border px-3 py-1 text-sm font-semibold", r.id === res.round?.id ? "border-brand bg-brand text-white" : "border-line bg-card text-ink-2 hover:border-brand")}>
                {r.name}
              </a>
            ))}
        </div>
        {has("events.export") && (
          <LinkButton href={`/api/events/${eventId}/export?table=results`} variant="outline" size="sm" prefetch={false}>
            Export leaderboard
          </LinkButton>
        )}
      </div>

      <Card title="Publication" eyebrow="Admin controls when results become public">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={event.resultsVerifiedAt ? "ok" : "warn"}>{event.resultsVerifiedAt ? `Verified ${fmtDateTime(event.resultsVerifiedAt)}` : "Not verified"}</Badge>
          <Badge tone={event.resultsPublished ? "solid" : "neutral"}>{event.resultsPublished ? "Public" : "Private"}</Badge>
          {res.pending > 0 && <Badge tone="warn">{res.pending} evaluations still pending in this round</Badge>}
          <span className="ml-auto flex gap-2">
            {has("results.edit") && (
              <ActionButton action={verifyResults} hidden={{ eventId }} variant="outline" size="md" confirm="Mark the current leaderboard as verified?">
                Verify results
              </ActionButton>
            )}
            {has("results.publish") &&
              (event.resultsPublished ? (
                <ActionButton action={publishResults} hidden={{ eventId, publish: "0" }} variant="outline" size="md" confirm="Hide results from the public page?">
                  Unpublish
                </ActionButton>
              ) : (
                <ActionButton action={publishResults} hidden={{ eventId, publish: "1" }} size="md" confirm="Publish results? Participants are notified and top teams receive Passport awards.">
                  Publish results
                </ActionButton>
              ))}
          </span>
        </div>
        {!has("results.publish") && <p className="mt-3 text-xs text-muted">You can compute and verify results. Publishing is reserved for admins and club leads.</p>}
      </Card>

      {!res.round || res.rows.length === 0 ? (
        <EmptyState title="No scores yet">Results appear as soon as judges submit evaluations.</EmptyState>
      ) : (
        <Card title={`Leaderboard · ${res.round.name}`} eyebrow={`${res.rows.length} teams scored · weighted 0–100`} padded={false}>
          <Table className="rounded-none border-0">
            <thead>
              <tr>
                <Th className="w-14">Rank</Th>
                <Th>Team</Th>
                <Th className="w-56">Average</Th>
                {res.criteria.map((c) => (
                  <Th key={c.id} className="text-center">
                    {c.name}
                    <div className="font-normal normal-case tracking-normal text-muted">{c.weight}%</div>
                  </Th>
                ))}
                <Th>Judges</Th>
              </tr>
            </thead>
            <tbody>
              {res.rows.map((r) => (
                <tr key={r.teamId} className={r.rank <= 3 ? "bg-brand-wash/40" : ""}>
                  <Td>
                    <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full font-extrabold", r.rank === 1 ? "bg-brand text-white" : r.rank <= 3 ? "bg-brand-soft text-brand-deep" : "bg-paper-2")}>{r.rank}</span>
                  </Td>
                  <Td>
                    <div className="font-bold text-ink">{r.teamName}</div>
                    <div className="text-xs text-muted">{r.code}</div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="w-12 tabular text-lg font-extrabold text-ink">{r.average.toFixed(1)}</span>
                      <div className="h-2 flex-1 rounded bg-paper-2">
                        <div className="h-2 rounded bg-brand" style={{ width: `${(r.average / maxAvg) * 100}%` }} />
                      </div>
                    </div>
                  </Td>
                  {res.criteria.map((c) => (
                    <Td key={c.id} className="text-center tabular">
                      {r.criteria[c.id]?.toFixed(1) ?? "—"}
                      <span className="text-xs text-muted">/{c.maxScore}</span>
                    </Td>
                  ))}
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {r.evaluations.map((e) => (
                        <span key={e.id} className="inline-flex items-center gap-1">
                          <Badge title={e.feedback ?? ""}>
                            {judgeNames.get(e.judgeUserId)?.split(" ")[0]} {e.totalScore?.toFixed(0)}
                          </Badge>
                          {has("evaluations.edit") && (
                            <ActionButton action={reopenEvaluation} hidden={{ eventId, evaluationId: e.id }} variant="ghost" className="!h-5 !px-1 text-[10px]" confirm="Reopen this evaluation so the judge can edit it?">
                              reopen
                            </ActionButton>
                          )}
                        </span>
                      ))}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      {res.rows.length > 0 && (
        <Card title="Written feedback from judges">
          <ul className="space-y-3">
            {res.rows.flatMap((r) =>
              r.evaluations
                .filter((e) => e.feedback)
                .map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="font-semibold text-ink">{r.teamName}</span> <span className="text-muted">· {judgeNames.get(e.judgeUserId)}</span>
                    <p className="text-ink-2">“{e.feedback}”</p>
                  </li>
                )),
            )}
          </ul>
        </Card>
      )}
      <p className="text-xs text-muted">
        Ranking = mean of submitted weighted scores per team. Ties share a rank. <StatusBadge status="draft" /> evaluations are excluded until submitted.
      </p>
    </div>
  );
}
