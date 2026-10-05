import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { files } from "@/db/schema";
import { newId } from "@/lib/utils";
import { UserError } from "./action";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/zip": "zip",
};

export function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR ?? "./storage/uploads");
}

/** Validates type/size, stores under a random name (never the user's filename). */
export async function storeUpload(
  file: File,
  link: { eventId?: string | null; documentId?: string | null; submissionId?: string | null; uploadedById: string },
) {
  if (!file || file.size === 0) throw new UserError("Choose a file to upload.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UserError("Files must be 10 MB or smaller.");
  const ext = ALLOWED[file.type];
  if (!ext) throw new UserError("Unsupported file type. Use PDF, images, Office documents, CSV, text or ZIP.");
  const storedName = `${newId()}.${ext}`;
  await fs.mkdir(uploadDir(), { recursive: true });
  await fs.writeFile(path.join(uploadDir(), storedName), Buffer.from(await file.arrayBuffer()));
  const id = newId("f_");
  const originalName = path.basename(file.name).replace(/[^\w.\- ()]/g, "_").slice(0, 120) || `file.${ext}`;
  db.insert(files)
    .values({ id, storedName, originalName, mimeType: file.type, size: file.size, ...link })
    .run();
  return { id, originalName };
}

export async function removeStored(storedName: string) {
  await fs.rm(path.join(uploadDir(), path.basename(storedName)), { force: true });
}
