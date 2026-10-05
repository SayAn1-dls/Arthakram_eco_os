import { EVENT_TYPES, type events } from "@/db/schema";
import { toLocalInput } from "@/lib/datetime";
import { humanize } from "@/lib/format";
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea, type FormAction } from "./forms";
import { Eyebrow } from "./ui";

type Ev = Partial<typeof events.$inferSelect>;

export function EventForm({
  action,
  event,
  clubs,
  submitLabel,
  hidden,
}: {
  action: FormAction;
  event?: Ev;
  clubs?: { value: string; label: string }[];
  submitLabel: string;
  hidden?: Record<string, string>;
}) {
  const e = event ?? {};
  return (
    <ActionForm action={action} hidden={hidden} className="space-y-8">
      <section>
        <Eyebrow className="mb-4">Basics</Eyebrow>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Event name" className="md:col-span-2">
            <Input name="title" required defaultValue={e.title} placeholder="Product Hackathon 2026" />
          </Field>
          <Field label="Event type">
            <Select name="type" defaultValue={e.type ?? "hackathon"} options={EVENT_TYPES.map((t) => ({ value: t, label: humanize(t) }))} />
          </Field>
          {clubs ? (
            <Field label="Hosted by" hint="Only clubs where you can create events are listed.">
              <Select name="clubId" required options={clubs} placeholder="Choose a club…" />
            </Field>
          ) : (
            <Field label="Visibility">
              <Select name="visibility" defaultValue={e.visibility ?? "public"} options={[{ value: "public", label: "Public — listed on Arthakram" }, { value: "private", label: "Private — invite only" }]} />
            </Field>
          )}
          <Field label="Tagline" className="md:col-span-2">
            <Input name="tagline" defaultValue={e.tagline ?? ""} placeholder="One line that makes students want to join" />
          </Field>
          <Field label="Description" className="md:col-span-2" hint="Markdown supported.">
            <Textarea name="description" rows={5} defaultValue={e.description ?? ""} />
          </Field>
        </div>
      </section>

      <section>
        <Eyebrow className="mb-4">When & where</Eyebrow>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Starts (IST)">
            <Input type="datetime-local" name="startsAt" required defaultValue={toLocalInput(e.startsAt)} />
          </Field>
          <Field label="Ends (IST)">
            <Input type="datetime-local" name="endsAt" required defaultValue={toLocalInput(e.endsAt)} />
          </Field>
          <Field label="Registration deadline">
            <Input type="datetime-local" name="registrationDeadline" defaultValue={toLocalInput(e.registrationDeadline)} />
          </Field>
          <Field label="Mode">
            <Select name="mode" defaultValue={e.mode ?? "offline"} options={["offline", "online", "hybrid"].map((m) => ({ value: m, label: humanize(m) }))} />
          </Field>
          <Field label="Venue" className="md:col-span-2">
            <Input name="venue" defaultValue={e.venue ?? ""} placeholder="Academic Block, Rishihood University" />
          </Field>
        </div>
      </section>

      <section>
        <Eyebrow className="mb-4">Participation</Eyebrow>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Min team size">
            <Input type="number" name="teamSizeMin" min={1} max={20} defaultValue={e.teamSizeMin ?? 1} />
          </Field>
          <Field label="Max team size">
            <Input type="number" name="teamSizeMax" min={1} max={20} defaultValue={e.teamSizeMax ?? 4} />
          </Field>
          <Field label="Eligibility" className="md:col-span-2">
            <Input name="eligibility" defaultValue={e.eligibility ?? ""} placeholder="All undergraduate students" />
          </Field>
          <Field label="Rules" className="md:col-span-4" hint="Markdown. Also mirrored in the Rules document.">
            <Textarea name="rules" rows={6} defaultValue={e.rules ?? ""} />
          </Field>
          <Field label="Prizes" className="md:col-span-2">
            <Textarea name="prizes" rows={3} defaultValue={e.prizes ?? ""} />
          </Field>
          <div className="space-y-4 md:col-span-2">
            <Field label="Sponsors" hint="Comma separated.">
              <Input name="sponsors" defaultValue={(e.sponsors ?? []).join(", ")} />
            </Field>
            <Field label="Tags" hint="Used for opportunity matching, e.g. product, ai, design.">
              <Input name="tags" defaultValue={(e.tags ?? []).join(", ")} />
            </Field>
          </div>
          <Field label="Contact email" className="md:col-span-2">
            <Input type="email" name="contactEmail" defaultValue={e.contactEmail ?? ""} />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <Eyebrow className="mb-1">Judging</Eyebrow>
        <Checkbox name="allowJudgeEditAfterSubmit" defaultChecked={e.allowJudgeEditAfterSubmit ?? false} label="Let judges edit evaluations after submitting (otherwise an organizer must reopen them)" />
        {clubs && (
          <>
            <input type="hidden" name="visibility" value="public" />
            <Checkbox name="starterKit" defaultChecked label="Add starter kit: two rounds, documentation skeleton and a rubric template for this event type" />
          </>
        )}
      </section>

      <div className="flex justify-end border-t border-line pt-5">
        <SubmitButton size="lg" pendingText="Saving…">
          {submitLabel}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
