import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { announcements, documents, evaluations, eventRounds, events, feedback, files, participants, problemStatements, rooms, scheduleItems, submissions, teams, users } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { can, eventScopeOf } from "@/server/rbac";
import { timersFor } from "@/server/events";
import { saveSubmission, submitFeedback } from "@/server/actions/competition";
import { leaveTeam } from "@/server/actions/student";
import { ActionButton, ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { LiveTimerStrip } from "@/components/live";
import { QrSvg } from "@/components/qr";
import { Avatar, Badge, Card, StatusBadge } from "@/components/ui";
import { fmtDateTime, fmtRelative, fmtTime } from "@/lib/format";
import { appUrl } from "@/lib/utils";

export const metadata = { title: "Team workspace" };

export default async function TeamWorkspace({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const user = await requireUser();
  const team = db.select().from(teams).where(eq(teams.id, teamId)).get();
  if (!team) notFound();
  const e = db.select().from(events).where(eq(events.id, team.eventId)).get()!;
  const me = db.select().from(participants).where(and(eq(participants.teamId, teamId), eq(participants.userId, user.id))).get();
  const staff = await can(user.id, "teams.view", eventScopeOf(e));
  const isMentor = team.mentorUserId === user.id;
  if (!me && !staff && !isMentor) notFound();

  const members = db.select({ p: participants, name: users.name, email: users.email }).from(participants).innerJoin(users, eq(users.id, participants.userId)).where(eq(participants.teamId, teamId)).all();
  const mentor = team.mentorUserId ? db.select({ name: users.name, headline: users.headline }).from(users).where(eq(users.id, team.mentorUserId)).get() : null;
  const ps = team.problemStatementId ? db.select().from(problemStatements).where(eq(problemStatements.id, team.problemStatementId)).get() : null;
  const room = team.roomId ? db.select().from(rooms).where(eq(rooms.id, team.roomId)).get() : null;
  const rounds = db.select().from(eventRounds).where(eq(eventRounds.eventId, e.id)).orderBy(asc(eventRounds.order)).all();
  const active = rounds.find((r) => r.status === "active");
  const subs = db.select().from(submissions).where(eq(submissions.teamId, teamId)).all();
  const activeSub = active ? subs.find((s) => s.roundId === active.id) : undefined;
  const subFiles = activeSub ? db.select().from(files).where(eq(files.submissionId, activeSub.id)).all() : [];
  const notes = db.select().from(announcements).where(and(eq(announcements.eventId, e.id), inArray(announcements.audience, ["everyone", "participants"]))).orderBy(desc(announcements.pinned), desc(announcements.createdAt)).limit(6).all();
  const sched = db.select().from(scheduleItems).where(eq(scheduleItems.eventId, e.id)).orderBy(asc(scheduleItems.startsAt)).all().filter((s) => (s.endsAt ?? s.startsAt).getTime() > Date.now()).slice(0, 5);
  const docs = db.select({ id: documents.id, title: documents.title }).from(documents).where(and(eq(documents.eventId, e.id), eq(documents.status, "published"), inArray(documents.visibility, ["participants", "public"]))).all();
  const judgeFeedback = e.resultsPublished ? db.select({ fb: evaluations.feedback, round: eventRounds.name }).from(evaluations).innerJoin(eventRounds, eq(eventRounds.id, evaluations.roundId)).where(and(eq(evaluations.teamId, teamId), eq(evaluations.status, "submitted"))).all().filter((x) => x.fb) : [];
  const myFeedback = db.select().from(feedback).where(and(eq(feedback.eventId, e.id), eq(feedback.userId, user.id))).get();
  const editable = !!me && !!active && (!activeSub || ["draft", "submitted"].includes(activeSub.status));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/my-events" className="text-sm text-muted hover:text-brand-deep">
          ← My events
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold">{team.name}</h1>
          <Badge tone="brand">{team.code}</Badge>
          <StatusBadge status={e.status} />
        </div>
        <p className="mt-1 text-sm text-muted">
          <Link href={`/events/${e.slug}`} className="font-semibold text-ink hover:text-brand-deep">
            {e.title}
          </Link>
          {room && <> · {room.name}</>}
        </p>
      </div>

      {e.status === "live" && (
        <Card title="Live timers" eyebrow={active ? `Now: ${active.name}` : "Event clock"}>
          <LiveTimerStrip eventId={e.id} initial={timersFor(e.id, true)} serverNow={Date.now()} />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {active && (
            <Card title={`Submission · ${active.name}`} eyebrow={active.submissionDeadline ? `Closes ${fmtDateTime(active.submissionDeadline)}` : "Open"} actions={<StatusBadge status={activeSub?.status ?? "not_started"} />}>
              {editable ? (
                <ActionForm action={saveSubmission} hidden={{ teamId, roundId: active.id }} className="grid gap-3 sm:grid-cols-2">
                  <Field label="Project title" className="sm:col-span-2">
                    <Input name="title" required defaultValue={activeSub?.title ?? ""} />
                  </Field>
                  <Field label="Description" className="sm:col-span-2">
                    <Textarea name="description" rows={3} defaultValue={activeSub?.description ?? ""} />
                  </Field>
                  <Field label="GitHub repository">
                    <Input name="repoUrl" type="url" defaultValue={activeSub?.repoUrl ?? ""} placeholder="https://github.com/…" />
                  </Field>
                  <Field label="Live demo">
                    <Input name="demoUrl" type="url" defaultValue={activeSub?.demoUrl ?? ""} />
                  </Field>
                  <Field label="Deck (PPT/PDF link)">
                    <Input name="deckUrl" type="url" defaultValue={activeSub?.deckUrl ?? ""} />
                  </Field>
                  <Field label="Video">
                    <Input name="videoUrl" type="url" defaultValue={activeSub?.videoUrl ?? ""} />
                  </Field>
                  <Field label="Documentation">
                    <Input name="docsUrl" type="url" defaultValue={activeSub?.docsUrl ?? ""} />
                  </Field>
                  <Field label="Upload a file (PDF, PPTX, images, ZIP · 10 MB)">
                    <input type="file" name="file" className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-paper-2 file:px-3 file:py-1.5 file:text-sm file:font-semibold" />
                  </Field>
                  {subFiles.length > 0 && (
                    <div className="text-xs text-muted sm:col-span-2">
                      Attached: {subFiles.map((f) => f.originalName).join(", ")}
                    </div>
                  )}
                  <div className="flex gap-2 sm:col-span-2">
                    <SubmitButton name="op" value="draft" variant="outline">
                      Save draft
                    </SubmitButton>
                    <SubmitButton name="op" value="submit">
                      {activeSub?.status === "submitted" ? "Update submission" : "Submit"}
                    </SubmitButton>
                  </div>
                </ActionForm>
              ) : (
                <p className="text-sm text-muted">{activeSub ? `Your submission is ${activeSub.status.replace("_", " ")}.` : "Submissions are handled by team members."}</p>
              )}
            </Card>
          )}
          <Card title="Submission history">
            <ul className="space-y-2 text-sm">
              {rounds.map((r) => {
                const s = subs.find((x) => x.roundId === r.id);
                return (
                  <li key={r.id} className="flex items-center justify-between">
                    <span>
                      <b className="text-ink">{r.name}</b> {s?.title && <span className="text-muted">· {s.title}</span>}
                    </span>
                    <StatusBadge status={s?.status ?? "not_started"} />
                  </li>
                );
              })}
            </ul>
          </Card>
          {judgeFeedback.length > 0 && (
            <Card title="Judge feedback" eyebrow="Shared after results were published">
              <ul className="space-y-3 text-sm">
                {judgeFeedback.map((j, i) => (
                  <li key={i}>
                    <span className="text-xs text-muted">{j.round}</span>
                    <p className="text-ink-2">“{j.fb}”</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Announcements">
            {notes.length === 0 ? (
              <p className="text-sm text-muted">Nothing yet.</p>
            ) : (
              <ul className="space-y-4">
                {notes.map((n) => (
                  <li key={n.id}>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={n.priority} />
                      <span className="text-xs text-muted">{fmtRelative(n.createdAt)}</span>
                    </div>
                    <div className="mt-1 font-semibold text-ink">{n.title}</div>
                    <p className="text-sm text-ink-2">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <aside className="space-y-6">
          {me && (
            <Card title="My check-in pass">
              <div className="flex justify-center rounded-lg bg-white p-3">
                <QrSvg value={appUrl(`/app/checkin/${me.checkinToken}`)} size={170} />
              </div>
              <p className="mt-2 text-center text-xs text-muted">{me.checkedInAt ? `Checked in at ${fmtTime(me.checkedInAt)}` : "Show this at the check-in desk."}</p>
            </Card>
          )}
          <Card title="Team" eyebrow={`${members.length}/${e.teamSizeMax} members`}>
            <ul className="space-y-2.5">
              {members.map((m) => (
                <li key={m.p.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={m.name} size={26} />
                  <span className="font-semibold text-ink">{m.name}</span>
                  {m.p.isTeamLead && <Badge tone="brand">Lead</Badge>}
                </li>
              ))}
            </ul>
            {me && members.length < e.teamSizeMax && (
              <div className="mt-4 rounded-lg bg-paper-2 p-3 text-xs">
                <div className="font-semibold text-ink-2">Invite code</div>
                <code className="mt-1 block break-all font-mono text-ink">{team.id}</code>
                <div className="mt-1 text-muted">Teammates paste this on their My Events page.</div>
              </div>
            )}
          </Card>
          {ps && (
            <Card title="Problem statement">
              <Badge tone="brand">{ps.code}</Badge>
              <div className="mt-2 font-bold text-ink">{ps.title}</div>
              <p className="mt-1 text-sm text-muted">{ps.description}</p>
            </Card>
          )}
          <Card title="Mentor">{mentor ? <div className="text-sm"><b>{mentor.name}</b><div className="text-muted">{mentor.headline}</div></div> : <p className="text-sm text-muted">No mentor assigned yet.</p>}</Card>
          {sched.length > 0 && (
            <Card title="Up next">
              <ul className="space-y-2 text-sm">
                {sched.map((s) => (
                  <li key={s.id}>
                    <b className="tabular">{fmtTime(s.startsAt)}</b> · {s.title}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {docs.length > 0 && (
            <Card title="Event documents">
              <ul className="space-y-1.5 text-sm">
                {docs.map((d) => (
                  <li key={d.id}>
                    <Link href={`/events/${e.slug}/docs/${d.id}`} className="font-semibold text-brand-deep hover:underline">
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {me && (
            <Card title={myFeedback ? "Update your feedback" : "Event feedback"}>
              <ActionForm action={submitFeedback} hidden={{ eventId: e.id }} className="space-y-2">
                <Select name="rating" defaultValue={String(myFeedback?.rating ?? 5)} options={["5", "4", "3", "2", "1"].map((v) => ({ value: v, label: `${"★".repeat(Number(v))} (${v})` }))} />
                <Textarea name="comment" rows={2} defaultValue={myFeedback?.comment ?? ""} placeholder="What should organizers keep or change?" />
                <SubmitButton size="sm" variant="outline">
                  Send feedback
                </SubmitButton>
              </ActionForm>
            </Card>
          )}
          {me && e.status !== "live" && (
            <ActionButton action={leaveTeam} hidden={{ teamId }} variant="ghost" confirm="Leave this team?">
              Leave team
            </ActionButton>
          )}
        </aside>
      </div>
    </div>
  );
}
