import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { submitFeedback } from "@/server/actions/competition";
import { ActionForm, Field, Select, SubmitButton, Textarea } from "@/components/forms";
import { Card, LinkButton } from "@/components/ui";

export const metadata = { title: "Feedback" };

export default async function FeedbackForm({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = db.select().from(events).where(eq(events.slug, slug)).get();
  if (!e || e.status === "draft") notFound();
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="eyebrow mb-2 text-brand-deep">Feedback</div>
      <h1 className="mb-6 text-3xl font-extrabold">How was {e.title}?</h1>
      <Card>
        {user ? (
          <ActionForm action={submitFeedback} hidden={{ eventId: e.id }} className="space-y-4">
            <Field label="Overall rating">
              <Select name="rating" defaultValue="5" options={["5", "4", "3", "2", "1"].map((v) => ({ value: v, label: `${"★".repeat(Number(v))} (${v})` }))} />
            </Field>
            <Field label="What should the organizers keep or change?">
              <Textarea name="comment" rows={4} />
            </Field>
            <SubmitButton className="w-full">Send feedback</SubmitButton>
          </ActionForm>
        ) : (
          <LinkButton href={`/login?next=/events/${slug}/feedback`} className="w-full">Sign in to leave feedback</LinkButton>
        )}
      </Card>
    </div>
  );
}
