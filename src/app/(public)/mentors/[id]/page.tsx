import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { MENTOR_WORK_TYPES, mentorProfiles, mentorReviews, users } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { requestMentor } from "@/server/actions/student";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Avatar, Badge, Card, KV, LinkButton } from "@/components/ui";
import { humanize } from "@/lib/format";

export default async function MentorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = db.select({ m: mentorProfiles, name: users.name }).from(mentorProfiles).innerJoin(users, eq(users.id, mentorProfiles.userId)).where(and(eq(mentorProfiles.userId, id), eq(mentorProfiles.status, "approved"))).get();
  if (!row) notFound();
  const { m, name } = row;
  const user = await getCurrentUser();
  const reviewCount = db.select({ id: mentorReviews.id }).from(mentorReviews).where(eq(mentorReviews.mentorId, id)).all().length;
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="flex items-center gap-4">
            <Avatar name={name} size={72} />
            <div>
              <div className="eyebrow text-brand-deep">Mentor</div>
              <h1 className="text-4xl font-extrabold tracking-tight">{name}</h1>
              <p className="text-lg text-ink-2">{m.headline}</p>
            </div>
          </div>
          <hr className="rule my-8 max-w-md" />
          {m.bio && <p className="max-w-2xl text-lg text-ink-2">{m.bio}</p>}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Card title="Expertise"><div className="flex flex-wrap gap-1">{m.expertise.map((e) => <Badge key={e} tone="brand">{e}</Badge>)}</div></Card>
            <Card title="Reviews">
              <KV items={[["Industry", m.industry ?? "—"], ["Experience", `${m.experienceYears} years`], ["Availability", m.availability ?? "—"], ["Reviews given", reviewCount], ["Areas", m.categories.map((c) => humanize(c)).join(", ")]]} />
            </Card>
          </div>
        </div>
        <Card title="Request a review" eyebrow="Mentors respond in-app">
          {!user ? (
            <LinkButton href={`/login?next=/mentors/${id}`} className="w-full">Sign in to request</LinkButton>
          ) : user.id === id ? (
            <p className="text-sm text-muted">This is your public mentor profile.</p>
          ) : (
            <ActionForm action={requestMentor} hidden={{ mentorId: id }} resetOnSuccess className="space-y-3">
              <Field label="What should they review?"><Input name="topic" required placeholder="My Swiggy Instamart teardown" /></Field>
              <Field label="Type of work"><Select name="workType" options={MENTOR_WORK_TYPES.map((w) => ({ value: w, label: humanize(w) }))} /></Field>
              <Field label="Link to your work"><Input name="workUrl" type="url" placeholder="https://…" /></Field>
              <Field label="Context"><Textarea name="message" rows={3} placeholder="What feedback would help most?" /></Field>
              <SubmitButton className="w-full">Send request</SubmitButton>
            </ActionForm>
          )}
        </Card>
      </div>
    </div>
  );
}
