import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements, users } from "@/db/schema";
import { eventAccess } from "@/server/events";
import { createAnnouncement, deleteAnnouncement, togglePin } from "@/server/actions/operations";
import { ActionButton, ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Badge, Card, EmptyState, StatusBadge } from "@/components/ui";
import { fmtDateTime, humanize } from "@/lib/format";

export const metadata = { title: "Announcements" };

const TEMPLATES = ["Round started", "Submission deadline changed", "Room changed", "Judge briefing", "Break started", "Final presentations start", "Results published"];

export default async function AnnouncementsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { has } = await eventAccess(eventId);
  const list = db
    .select({ a: announcements, by: users.name })
    .from(announcements)
    .leftJoin(users, eq(users.id, announcements.createdById))
    .where(eq(announcements.eventId, eventId))
    .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
    .all();
  const canPost = has("announcements.create");
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        {list.length === 0 && <EmptyState title="No announcements yet" />}
        {list.map(({ a, by }) => (
          <Card key={a.id} className={a.priority === "urgent" ? "border-bad/40" : a.pinned ? "border-brand/50" : ""}>
            <div className="flex flex-wrap items-center gap-2">
              {a.pinned && <Badge tone="brand">Pinned</Badge>}
              <StatusBadge status={a.priority} />
              <Badge>To {humanize(a.audience)}</Badge>
              <span className="text-xs text-muted">
                {fmtDateTime(a.createdAt)} · {by}
              </span>
              {canPost && (
                <span className="ml-auto flex gap-1">
                  <ActionButton action={togglePin} hidden={{ eventId, id: a.id }} variant="ghost">
                    {a.pinned ? "Unpin" : "Pin"}
                  </ActionButton>
                  <ActionButton action={deleteAnnouncement} hidden={{ eventId, id: a.id }} variant="ghost" confirm="Delete this announcement?">
                    Delete
                  </ActionButton>
                </span>
              )}
            </div>
            <h3 className="mt-2 text-lg font-bold text-ink">{a.title}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{a.body}</p>
          </Card>
        ))}
      </div>
      {canPost && (
        <Card title="New announcement" eyebrow="Sends in-app notifications">
          <ActionForm action={createAnnouncement} hidden={{ eventId }} resetOnSuccess className="space-y-3">
            <Field label="Title">
              <Input name="title" required list="announcement-templates" />
              <datalist id="announcement-templates">
                {TEMPLATES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
            <Field label="Message">
              <Textarea name="body" rows={4} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority">
                <Select name="priority" options={["info", "important", "urgent"].map((p) => ({ value: p, label: humanize(p) }))} />
              </Field>
              <Field label="Audience">
                <Select name="audience" options={["everyone", "participants", "judges", "mentors", "staff"].map((p) => ({ value: p, label: humanize(p) }))} />
              </Field>
            </div>
            <Checkbox name="pinned" label="Pin to top" />
            <SubmitButton className="w-full">Send announcement</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
