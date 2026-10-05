import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, events } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { canReadDocument } from "@/server/docs";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui";
import { fmtDate, humanize } from "@/lib/format";

export default async function PublicDoc({ params }: { params: Promise<{ slug: string; docId: string }> }) {
  const { slug, docId } = await params;
  const e = db.select().from(events).where(eq(events.slug, slug)).get();
  if (!e) notFound();
  const d = db.select().from(documents).where(and(eq(documents.id, docId), eq(documents.eventId, e.id))).get();
  const user = await getCurrentUser();
  if (!d || !(await canReadDocument(d, user?.id ?? null))) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <Link href={`/events/${slug}#docs`} className="text-sm text-muted hover:text-brand-deep">← {e.title}</Link>
      <div className="mt-4"><Badge tone="brand">{humanize(d.section)}</Badge></div>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-muted">Updated {fmtDate(d.updatedAt ?? d.createdAt)}</p>
      <hr className="rule my-8" />
      <Markdown>{d.content}</Markdown>
    </article>
  );
}
