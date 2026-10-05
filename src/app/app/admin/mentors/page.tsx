import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { mentorProfiles, mentorReviews, users } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { setMentorStatus } from "@/server/actions/admin";
import { ActionButton } from "@/components/forms";
import { Avatar, Badge, Card, Forbidden, PageHeader, StatusBadge } from "@/components/ui";

export const metadata = { title: "Mentors" };

export default async function AdminMentors() {
  const me = await adminPage("mentors.approve");
  if (!me) return <Forbidden />;
  const list = db.select({ m: mentorProfiles, name: users.name, email: users.email }).from(mentorProfiles).innerJoin(users, eq(users.id, mentorProfiles.userId)).orderBy(asc(mentorProfiles.status), asc(users.name)).all();
  const reviews = (id: string) => db.select({ id: mentorReviews.id }).from(mentorReviews).where(eq(mentorReviews.mentorId, id)).all().length;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Mentor network" description="Approve mentor profiles before students can find them. Approval also grants the Mentor role." />
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map(({ m, name, email }) => (
          <Card key={m.userId}>
            <div className="flex items-start gap-3">
              <Avatar name={name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">{name}</span>
                  <StatusBadge status={m.status} />
                </div>
                <div className="text-sm text-muted">{m.headline}</div>
                <div className="text-xs text-muted">
                  {email} · {m.experienceYears} yrs · {m.industry} · {reviews(m.userId)} reviews
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.expertise.map((x) => (
                    <Badge key={x}>{x}</Badge>
                  ))}
                </div>
                {m.bio && <p className="mt-2 text-sm text-ink-2">{m.bio}</p>}
              </div>
            </div>
            <div className="mt-4 flex gap-2 border-t border-line pt-3">
              {m.status !== "approved" && (
                <ActionButton action={setMentorStatus} hidden={{ userId: m.userId, status: "approved" }} variant="primary">
                  Approve
                </ActionButton>
              )}
              {m.status === "approved" && (
                <ActionButton action={setMentorStatus} hidden={{ userId: m.userId, status: "paused" }}>
                  Pause
                </ActionButton>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
