import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { DOC_SECTIONS, documentRevisions, documents, files, users } from "@/db/schema";
import { eventAccess } from "@/server/events";
import { deleteDocument, deleteFile, restoreRevision, saveDocument, setDocumentStatus, uploadDocumentFile } from "@/server/actions/documents";
import { DocEditor } from "@/components/doc-editor";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Markdown } from "@/components/markdown";
import { Badge, Card, Forbidden, LinkButton, StatusBadge } from "@/components/ui";
import { fmtBytes, fmtDateTime, humanize } from "@/lib/format";

export default async function DocPage({ params, searchParams }: { params: Promise<{ eventId: string; docId: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { eventId, docId } = await params;
  const { edit } = await searchParams;
  const { has } = await eventAccess(eventId);
  if (!has("documents.view")) return <Forbidden />;
  const doc = db.select().from(documents).where(and(eq(documents.id, docId), eq(documents.eventId, eventId))).get();
  if (!doc) notFound();
  const editor = doc.updatedById ? db.select({ name: users.name }).from(users).where(eq(users.id, doc.updatedById)).get()?.name : null;
  const attachments = db.select().from(files).where(eq(files.documentId, doc.id)).all();
  const revisions = db
    .select({ r: documentRevisions, by: users.name })
    .from(documentRevisions)
    .leftJoin(users, eq(users.id, documentRevisions.editedById))
    .where(eq(documentRevisions.documentId, doc.id))
    .orderBy(desc(documentRevisions.createdAt))
    .limit(15)
    .all();
  const editing = edit === "1" && has("documents.edit");

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/app/events/${eventId}/docs`} className="text-sm text-muted hover:text-brand-deep">
            ← Documentation
          </Link>
          <div className="flex gap-2">
            {has("documents.edit") &&
              (editing ? (
                <LinkButton href={`/app/events/${eventId}/docs/${doc.id}`} variant="outline" size="sm">
                  Done editing
                </LinkButton>
              ) : (
                <LinkButton href={`/app/events/${eventId}/docs/${doc.id}?edit=1`} size="sm">
                  Edit
                </LinkButton>
              ))}
          </div>
        </div>
        {editing ? (
          <Card>
            <DocEditor
              action={saveDocument}
              hidden={{ eventId, docId: doc.id }}
              doc={doc}
              sections={DOC_SECTIONS}
              attachments={attachments.map((a) => ({ id: a.id, name: a.originalName, image: a.mimeType.startsWith("image/") }))}
            />
          </Card>
        ) : (
          <Card>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge tone="brand">{humanize(doc.section)}</Badge>
              <StatusBadge status={doc.status} />
              <StatusBadge status={doc.visibility} />
            </div>
            <h1 className="mt-2 text-3xl font-bold">{doc.title}</h1>
            <p className="mt-1 text-xs text-muted">
              Last edited {fmtDateTime(doc.updatedAt ?? doc.createdAt)}
              {editor && ` by ${editor}`}
            </p>
            <hr className="rule my-5" />
            <Markdown>{doc.content}</Markdown>
          </Card>
        )}
      </div>
      <aside className="space-y-6">
        {has("documents.publish") && (
          <Card title="Publishing">
            <div className="flex flex-wrap gap-2">
              {doc.status !== "published" && (
                <ActionButton action={setDocumentStatus} hidden={{ eventId, docId: doc.id, status: "published" }} variant="primary">
                  Publish
                </ActionButton>
              )}
              {doc.status === "published" && (
                <ActionButton action={setDocumentStatus} hidden={{ eventId, docId: doc.id, status: "draft" }}>
                  Unpublish
                </ActionButton>
              )}
              {doc.status !== "archived" && (
                <ActionButton action={setDocumentStatus} hidden={{ eventId, docId: doc.id, status: "archived" }} variant="ghost">
                  Archive
                </ActionButton>
              )}
            </div>
            <p className="mt-3 text-xs text-muted">Only published documents are visible outside the staff, according to their visibility.</p>
          </Card>
        )}
        <Card title="Attachments">
          <ul className="space-y-2 text-sm">
            {attachments.length === 0 && <li className="text-muted">None yet.</li>}
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <a href={`/api/files/${a.id}`} target="_blank" className="truncate font-semibold text-ink hover:text-brand-deep">
                  {a.originalName}
                </a>
                <span className="flex items-center gap-1">
                  <span className="text-xs text-muted">{fmtBytes(a.size)}</span>
                  {has("documents.delete") && (
                    <ActionButton action={deleteFile} hidden={{ eventId, fileId: a.id }} variant="ghost" confirm="Delete attachment?">
                      ×
                    </ActionButton>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {has("documents.create") && (
            <ActionForm action={uploadDocumentFile} hidden={{ eventId, docId: doc.id }} resetOnSuccess className="mt-3 space-y-2 border-t border-line pt-3">
              <input type="file" name="file" required className="block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-paper-2 file:px-2 file:py-1" />
              <SubmitButton size="sm" variant="outline">
                Upload
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
        <Card title="Version history" eyebrow={`${revisions.length} earlier versions`}>
          <ul className="space-y-2 text-sm">
            {revisions.length === 0 && <li className="text-muted">No earlier versions.</li>}
            {revisions.map(({ r, by }) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span>
                  <span className="text-ink">{fmtDateTime(r.createdAt)}</span>
                  <span className="block text-xs text-muted">{by ?? "Unknown"} · {r.content.length} chars</span>
                </span>
                {has("documents.edit") && (
                  <ActionButton action={restoreRevision} hidden={{ eventId, docId: doc.id, revisionId: r.id }} variant="ghost" confirm="Restore this version? The current text is kept in history.">
                    Restore
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        </Card>
        {has("documents.delete") && (
          <ActionButton action={deleteDocument} hidden={{ eventId, docId: doc.id }} variant="danger" confirm={`Delete “${doc.title}” and its history?`}>
            Delete document
          </ActionButton>
        )}
      </aside>
    </div>
  );
}
