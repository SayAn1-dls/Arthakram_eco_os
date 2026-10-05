import fs from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, files, judgeAssignments, participants, submissions, teams } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { canReadDocument } from "@/server/docs";
import { uploadDir } from "@/server/files";
import { can, eventScope } from "@/server/rbac";

/** Streams an uploaded file after a server-side permission check. */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[fileId]">) {
  const { fileId } = await ctx.params;
  const f = db.select().from(files).where(eq(files.id, fileId)).get();
  if (!f) return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  let allowed = false;

  if (f.documentId) {
    const doc = db.select().from(documents).where(eq(documents.id, f.documentId)).get();
    allowed = !!doc && (await canReadDocument(doc, user?.id ?? null));
  } else if (user && f.submissionId) {
    const sub = db.select().from(submissions).where(eq(submissions.id, f.submissionId)).get();
    if (sub) {
      const scope = await eventScope(sub.eventId);
      const member = db.select().from(participants).where(and(eq(participants.teamId, sub.teamId), eq(participants.userId, user.id))).get();
      const judge = db.select().from(judgeAssignments).where(and(eq(judgeAssignments.teamId, sub.teamId), eq(judgeAssignments.judgeUserId, user.id))).get();
      const mentor = db.select().from(teams).where(and(eq(teams.id, sub.teamId), eq(teams.mentorUserId, user.id))).get();
      allowed = !!member || !!judge || !!mentor || (!!scope && (await can(user.id, "submissions.view", scope)));
    }
  } else if (user && f.eventId) {
    const scope = await eventScope(f.eventId);
    allowed = !!scope && (await can(user.id, "documents.view", scope));
  }
  if (!allowed) return new Response(user ? "Forbidden" : "Sign in required", { status: user ? 403 : 401 });

  const data = await fs.readFile(path.join(uploadDir(), path.basename(f.storedName))).catch(() => null);
  if (!data) return new Response("File missing", { status: 410 });
  const inline = f.mimeType.startsWith("image/") || f.mimeType === "application/pdf";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": f.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(f.originalName)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
