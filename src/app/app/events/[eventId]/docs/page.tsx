import Link from "next/link";
import { asc, desc, eq, isNull, and } from "drizzle-orm";
import { FileText, Paperclip } from "lucide-react";
import { db } from "@/db";
import { DOC_SECTIONS, documents, files, users } from "@/db/schema";
import { eventAccess } from "@/server/events";
import { createDocument, deleteFile, uploadDocumentFile } from "@/server/actions/documents";
import { ActionButton, ActionForm, Field, Input, Select, SubmitButton } from "@/components/forms";
import { Badge, Card, Forbidden, StatusBadge } from "@/components/ui";
import { fmtBytes, fmtRelative, humanize } from "@/lib/format";

export const metadata = { title: "Documents" };

export default async function DocsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, has } = await eventAccess(eventId);
  if (!has("documents.view")) return <Forbidden />;
  const docs = db
    .select({ d: documents, editor: users.name })
    .from(documents)
    .leftJoin(users, eq(users.id, documents.updatedById))
    .where(eq(documents.eventId, eventId))
    .orderBy(asc(documents.order), desc(documents.updatedAt))
    .all();
  const loose = db.select().from(files).where(and(eq(files.eventId, eventId), isNull(files.documentId), isNull(files.submissionId))).orderBy(desc(files.createdAt)).all();
  const bySection = new Map<string, typeof docs>();
  for (const r of docs) bySection.set(r.d.section, [...(bySection.get(r.d.section) ?? []), r]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <Card title={`${event.title}`} eyebrow="Documentation workspace" padded={false}>
        <ul className="divide-y divide-line/70">
          {DOC_SECTIONS.map((section) => {
            const items = bySection.get(section) ?? [];
            return (
              <li key={section} className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted">├──</span>
                  <span className={items.length ? "font-bold text-ink" : "text-muted"}>{humanize(section)}</span>
                  {items.length > 0 && <span className="text-xs text-muted">({items.length})</span>}
                </div>
                {items.length > 0 && (
                  <ul className="mt-2 space-y-1.5 pl-9">
                    {items.map(({ d, editor }) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <FileText className="h-3.5 w-3.5 text-brand" />
                        <Link href={`/app/events/${eventId}/docs/${d.id}`} className="font-semibold text-ink hover:text-brand-deep">
                          {d.title}
                        </Link>
                        <StatusBadge status={d.status} />
                        <StatusBadge status={d.visibility} />
                        <span className="text-xs text-muted">
                          edited {fmtRelative(d.updatedAt ?? d.createdAt)}
                          {editor && ` by ${editor}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <aside className="space-y-6">
        {has("documents.create") && (
          <Card title="New document">
            <ActionForm action={createDocument} hidden={{ eventId }} className="space-y-3">
              <Field label="Title">
                <Input name="title" required />
              </Field>
              <Field label="Section">
                <Select name="section" options={DOC_SECTIONS.map((s) => ({ value: s, label: humanize(s) }))} />
              </Field>
              <Field label="Visibility">
                <Select name="visibility" options={[{ value: "internal", label: "Internal" }, { value: "participants", label: "Participants" }, { value: "public", label: "Public" }]} />
              </Field>
              <SubmitButton className="w-full">Create & edit</SubmitButton>
            </ActionForm>
          </Card>
        )}
        <Card title="Event files" eyebrow="Media, photos, attachments">
          <ul className="mb-3 space-y-2 text-sm">
            {loose.length === 0 && <li className="text-muted">No files yet.</li>}
            {loose.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2">
                <a href={`/api/files/${f.id}`} className="flex min-w-0 items-center gap-1.5 font-semibold text-ink hover:text-brand-deep" target="_blank">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{f.originalName}</span>
                </a>
                <span className="flex items-center gap-1">
                  <Badge>{fmtBytes(f.size)}</Badge>
                  {has("documents.delete") && (
                    <ActionButton action={deleteFile} hidden={{ eventId, fileId: f.id }} variant="ghost" confirm={`Delete ${f.originalName}?`}>
                      ×
                    </ActionButton>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {has("documents.create") && (
            <ActionForm action={uploadDocumentFile} hidden={{ eventId }} resetOnSuccess className="space-y-2 border-t border-line pt-3">
              <input type="file" name="file" required className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-paper-2 file:px-3 file:py-1.5 file:text-sm file:font-semibold" />
              <SubmitButton size="sm" variant="outline">
                Upload (max 10 MB)
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
      </aside>
    </div>
  );
}
