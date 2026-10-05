"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { DOC_SECTIONS, documentRevisions, documents, files } from "@/db/schema";
import { newId } from "@/lib/utils";
import { act, UserError } from "../action";
import { audit } from "../audit";
import { removeStored, storeUpload } from "../files";
import { requireEventPermission } from "../rbac";

const rev = (eventId: string) => revalidatePath(`/app/events/${eventId}`, "layout");

function getDoc(eventId: string, docId: string) {
  const d = db.select().from(documents).where(and(eq(documents.id, docId), eq(documents.eventId, eventId))).get();
  if (!d) throw new UserError("Document not found.");
  return d;
}

export const createDocument = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("documents.create", eventId);
  const data = z
    .object({
      title: z.string().trim().min(2).max(140),
      section: z.enum(DOC_SECTIONS),
      visibility: z.enum(["internal", "participants", "public"]),
    })
    .parse(Object.fromEntries(fd));
  const id = newId("doc_");
  db.insert(documents).values({ id, eventId, ...data, content: "", createdById: user.id, updatedById: user.id, updatedAt: new Date() }).run();
  audit({ actorId: user.id, action: "document.create", resourceType: "document", resourceId: id, eventId, summary: `${user.name} created document “${data.title}”` });
  redirect(`/app/events/${eventId}/docs/${id}?edit=1`);
});

export const saveDocument = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("documents.edit", eventId);
  const doc = getDoc(eventId, String(fd.get("docId")));
  const data = z
    .object({
      title: z.string().trim().min(2).max(140),
      section: z.enum(DOC_SECTIONS),
      visibility: z.enum(["internal", "participants", "public"]),
      content: z.string().max(200_000),
    })
    .parse(Object.fromEntries(fd));
  if (data.content !== doc.content || data.title !== doc.title) {
    // Keep the previous version — documentation is institutional memory.
    db.insert(documentRevisions).values({ id: newId("dr_"), documentId: doc.id, title: doc.title, content: doc.content, editedById: doc.updatedById }).run();
  }
  db.update(documents).set({ ...data, updatedById: user.id, updatedAt: new Date() }).where(eq(documents.id, doc.id)).run();
  audit({
    actorId: user.id,
    action: "document.update",
    resourceType: "document",
    resourceId: doc.id,
    eventId,
    summary: `${user.name} edited ${data.title}`,
    before: { title: doc.title, visibility: doc.visibility, length: doc.content.length },
    after: { title: data.title, visibility: data.visibility, length: data.content.length },
  });
  rev(eventId);
  return { ok: true, message: "Saved." };
});

export const setDocumentStatus = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("documents.publish", eventId);
  const doc = getDoc(eventId, String(fd.get("docId")));
  const status = z.enum(["draft", "published", "archived"]).parse(fd.get("status"));
  db.update(documents).set({ status, updatedById: user.id, updatedAt: new Date() }).where(eq(documents.id, doc.id)).run();
  audit({ actorId: user.id, action: `document.${status}`, resourceType: "document", resourceId: doc.id, eventId, summary: `${user.name} ${status === "published" ? "published" : status === "archived" ? "archived" : "unpublished"} ${doc.title}`, before: { status: doc.status }, after: { status } });
  rev(eventId);
});

export const restoreRevision = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("documents.edit", eventId);
  const doc = getDoc(eventId, String(fd.get("docId")));
  const r = db.select().from(documentRevisions).where(and(eq(documentRevisions.id, String(fd.get("revisionId"))), eq(documentRevisions.documentId, doc.id))).get();
  if (!r) throw new UserError("Revision not found.");
  db.insert(documentRevisions).values({ id: newId("dr_"), documentId: doc.id, title: doc.title, content: doc.content, editedById: doc.updatedById }).run();
  db.update(documents).set({ title: r.title, content: r.content, updatedById: user.id, updatedAt: new Date() }).where(eq(documents.id, doc.id)).run();
  audit({ actorId: user.id, action: "document.restore", resourceType: "document", resourceId: doc.id, eventId, summary: `${user.name} restored an earlier version of ${doc.title}` });
  rev(eventId);
  return { ok: true, message: "Earlier version restored." };
});

export const deleteDocument = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("documents.delete", eventId);
  const doc = getDoc(eventId, String(fd.get("docId")));
  const attached = db.select().from(files).where(eq(files.documentId, doc.id)).all();
  db.delete(documents).where(eq(documents.id, doc.id)).run();
  for (const f of attached) await removeStored(f.storedName);
  audit({ actorId: user.id, action: "document.delete", resourceType: "document", resourceId: doc.id, eventId, summary: `${user.name} deleted ${doc.title}` });
  redirect(`/app/events/${eventId}/docs`);
});

export const uploadDocumentFile = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("documents.create", eventId);
  const docId = String(fd.get("docId") ?? "") || null;
  if (docId) getDoc(eventId, docId);
  const f = await storeUpload(fd.get("file") as File, { eventId, documentId: docId, uploadedById: user.id });
  audit({ actorId: user.id, action: "file.upload", resourceType: "file", resourceId: f.id, eventId, summary: `${user.name} uploaded ${f.originalName}` });
  rev(eventId);
  return { ok: true, message: `Uploaded ${f.originalName}.`, data: { fileId: f.id, name: f.originalName } };
});

export const deleteFile = act(async (fd) => {
  const eventId = String(fd.get("eventId"));
  const { user } = await requireEventPermission("documents.delete", eventId);
  const f = db.select().from(files).where(and(eq(files.id, String(fd.get("fileId"))), eq(files.eventId, eventId))).get();
  if (!f) throw new UserError("File not found.");
  db.delete(files).where(eq(files.id, f.id)).run();
  await removeStored(f.storedName);
  audit({ actorId: user.id, action: "file.delete", resourceType: "file", eventId, summary: `${user.name} deleted file ${f.originalName}` });
  rev(eventId);
});
