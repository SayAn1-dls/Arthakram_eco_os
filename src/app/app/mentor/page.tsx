import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, mentorProfiles, mentorRequests, mentorReviews, submissions, teams, users } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { respondMentorRequest, saveMentorProfile, submitMentorReview } from "@/server/actions/student";
import { ActionButton, ActionForm, Field, Input, SubmitButton, Textarea } from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader, Stat, StatRow, StatusBadge } from "@/components/ui";
import { fmtDate, humanize } from "@/lib/format";

export const metadata = { title: "Mentor dashboard" };

const DIMS = ["Problem solving", "Communication", "Business thinking", "Presentation"];

export default async function MentorDashboard() {
  const user = await requireUser();
  const profile = db.select().from(mentorProfiles).where(eq(mentorProfiles.userId, user.id)).get();
  const reqs = db.select({ r: mentorRequests, student: users.name }).from(mentorRequests).innerJoin(users, eq(users.id, mentorRequests.studentId)).where(eq(mentorRequests.mentorId, user.id)).orderBy(desc(mentorRequests.createdAt)).all();
  const reviews = db.select({ r: mentorReviews, student: users.name }).from(mentorReviews).innerJoin(users, eq(users.id, mentorReviews.studentId)).where(eq(mentorReviews.mentorId, user.id)).orderBy(desc(mentorReviews.createdAt)).all();
  const myTeams = db.select({ t: teams, e: events }).from(teams).innerJoin(events, eq(events.id, teams.eventId)).where(eq(teams.mentorUserId, user.id)).all();
  const pending = reqs.filter((x) => x.r.status === "pending");
  const accepted = reqs.filter((x) => x.r.status === "accepted");

  return (
    <>
      <PageHeader eyebrow="Review" title="Mentor dashboard" description="Requests from students, teams you mentor at events, and the structured reviews you've given." />
      {profile?.status === "pending" && <div className="mb-6 rounded-xl border border-warn/30 bg-amber-50 px-4 py-3 text-sm text-warn">Your mentor profile is awaiting admin approval. Students can’t find you yet.</div>}
      <StatRow className="mb-6 lg:grid-cols-4">
        <Stat value={pending.length} label="New requests" tone="brand" />
        <Stat value={accepted.length} label="Reviews to write" />
        <Stat value={reviews.length} label="Reviews given" />
        <Stat value={myTeams.length} label="Event teams" />
      </StatRow>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Requests">
            {pending.length === 0 ? (
              <p className="text-sm text-muted">No new requests.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {pending.map(({ r, student }) => (
                  <li key={r.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-ink">{r.topic}</div>
                        <div className="text-xs text-muted">
                          {student} · {humanize(r.workType)} · {fmtDate(r.createdAt)}
                        </div>
                        {r.message && <p className="mt-1 text-sm text-ink-2">{r.message}</p>}
                        {r.workUrl && (
                          <a href={r.workUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand-deep hover:underline">
                            Open their work ↗
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <ActionButton action={respondMentorRequest} hidden={{ requestId: r.id, decision: "accept" }} variant="primary">
                          Accept
                        </ActionButton>
                        <ActionButton action={respondMentorRequest} hidden={{ requestId: r.id, decision: "decline" }} variant="ghost">
                          Decline
                        </ActionButton>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {accepted.map(({ r, student }) => (
            <Card key={r.id} title={`Review: ${r.topic}`} eyebrow={`${student} · ${humanize(r.workType)}`}>
              {r.workUrl && (
                <a href={r.workUrl} target="_blank" rel="noopener noreferrer" className="mb-3 inline-block text-sm font-semibold text-brand-deep hover:underline">
                  Open their work ↗
                </a>
              )}
              <ActionForm action={submitMentorReview} hidden={{ requestId: r.id }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {DIMS.map((d, i) => (
                    <Field key={d} label={d}>
                      <Input type="number" name={`score_${i}`} min={1} max={10} defaultValue={7} required />
                    </Field>
                  ))}
                </div>
                <Field label="Strengths">
                  <Textarea name="strengths" rows={2} required />
                </Field>
                <Field label="Weaknesses">
                  <Textarea name="weaknesses" rows={2} required />
                </Field>
                <Field label="Improvement areas">
                  <Textarea name="improvements" rows={2} />
                </Field>
                <Field label="Next steps">
                  <Textarea name="nextSteps" rows={2} />
                </Field>
                <SubmitButton>Send review</SubmitButton>
              </ActionForm>
            </Card>
          ))}
          <Card title="Teams you mentor at events">
            {myTeams.length === 0 ? (
              <p className="text-sm text-muted">Organizers assign you to teams from their event workspace.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {myTeams.map(({ t, e }) => {
                  const subs = db.select().from(submissions).where(and(eq(submissions.teamId, t.id))).all();
                  return (
                    <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <Link href={`/app/team/${t.id}`} className="font-semibold text-ink hover:text-brand-deep">
                          {t.name}
                        </Link>
                        <div className="text-xs text-muted">{e.title}</div>
                      </div>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted">{subs.filter((s) => s.submittedAt).length} submissions</span>
                        <StatusBadge status={e.status} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card title="Completed reviews">
            {reviews.length === 0 ? (
              <EmptyState title="None yet" />
            ) : (
              <ul className="space-y-2 text-sm">
                {reviews.map(({ r, student }) => (
                  <li key={r.id} className="flex justify-between">
                    <span>
                      <b className="text-ink">{r.title}</b> · {student}
                    </span>
                    <span className="text-xs text-muted">{fmtDate(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title={profile ? "Mentor profile" : "Become a mentor"} eyebrow={profile ? undefined : "Apply — an admin approves profiles"} actions={profile && <Badge tone={profile.status === "approved" ? "ok" : "warn"}>{humanize(profile.status)}</Badge>}>
          <ActionForm action={saveMentorProfile} className="space-y-3">
            <Field label="Headline">
              <Input name="headline" required defaultValue={profile?.headline ?? ""} placeholder="Product leader · ex-consumer apps" />
            </Field>
            <Field label="Industry">
              <Input name="industry" defaultValue={profile?.industry ?? ""} />
            </Field>
            <Field label="Years of experience">
              <Input type="number" name="experienceYears" min={0} defaultValue={profile?.experienceYears ?? 0} />
            </Field>
            <Field label="Expertise" hint="Comma separated">
              <Input name="expertise" defaultValue={profile?.expertise.join(", ")} />
            </Field>
            <Field label="Skills" hint="Used for matching, e.g. product, strategy, python">
              <Input name="skills" defaultValue={profile?.skills.join(", ")} />
            </Field>
            <Field label="Categories" hint="e.g. product_case, consulting_case, project, portfolio">
              <Input name="categories" defaultValue={profile?.categories.join(", ")} />
            </Field>
            <Field label="Availability">
              <Input name="availability" defaultValue={profile?.availability ?? ""} placeholder="2 sessions / week" />
            </Field>
            <Field label="Bio">
              <Textarea name="bio" rows={3} defaultValue={profile?.bio ?? ""} />
            </Field>
            <Field label="LinkedIn">
              <Input type="url" name="linkedinUrl" defaultValue={profile?.linkedinUrl ?? ""} />
            </Field>
            <SubmitButton className="w-full">{profile ? "Save profile" : "Apply as mentor"}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
