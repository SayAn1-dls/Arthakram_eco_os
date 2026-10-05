import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { feedback, users } from "@/db/schema";
import { eventAccess } from "@/server/events";
import { Card, EmptyState, Forbidden, Progress, Stat, StatRow, Badge } from "@/components/ui";
import { fmtRelative, humanize } from "@/lib/format";

export const metadata = { title: "Feedback" };

export default async function FeedbackPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, has } = await eventAccess(eventId);
  if (!has("feedback.view")) return <Forbidden />;
  const rows = db.select({ f: feedback, name: users.name }).from(feedback).leftJoin(users, eq(users.id, feedback.userId)).where(eq(feedback.eventId, eventId)).orderBy(desc(feedback.createdAt)).all();
  const avg = rows.length ? rows.reduce((a, r) => a + r.f.rating, 0) / rows.length : 0;
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: rows.filter((r) => r.f.rating === s).length }));
  return (
    <div className="space-y-6">
      <StatRow className="lg:grid-cols-3">
        <Stat value={avg ? avg.toFixed(2) : "—"} label="Average rating (out of 5)" tone="brand" />
        <Stat value={rows.length} label="Responses" />
        <Stat value={rows.filter((r) => r.f.comment).length} label="Written comments" />
      </StatRow>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card title="Distribution">
          <ul className="space-y-2">
            {dist.map((d) => (
              <li key={d.s} className="flex items-center gap-2 text-sm">
                <span className="w-8">{d.s}★</span>
                <Progress value={d.n} max={rows.length || 1} />
                <span className="w-6 text-right tabular text-muted">{d.n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            Participants leave feedback from their team page or the feedback QR code. Share <code>/events/{event.slug}/feedback</code>.
          </p>
        </Card>
        <Card title="Comments">
          {rows.filter((r) => r.f.comment).length === 0 ? (
            <EmptyState title="No comments yet" />
          ) : (
            <ul className="divide-y divide-line/70">
              {rows
                .filter((r) => r.f.comment)
                .map((r) => (
                  <li key={r.f.id} className="py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand-deep">{"★".repeat(r.f.rating)}</span>
                      <Badge>{humanize(r.f.role)}</Badge>
                      <span className="text-xs text-muted">{fmtRelative(r.f.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-ink-2">{r.f.comment}</p>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
