import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { markAllRead } from "@/server/actions/student";
import { ActionButton } from "@/components/forms";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { fmtRelative, humanize } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const list = db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(100).all();
  return (
    <>
      <PageHeader eyebrow="You" title="Notifications" actions={list.some((n) => !n.readAt) ? <ActionButton action={markAllRead} size="md">Mark all read</ActionButton> : null} />
      {list.length === 0 && <EmptyState title="You're all caught up" />}
      <ul className="space-y-2">
        {list.map((n) => (
          <li key={n.id} className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", n.readAt ? "border-line bg-card/60" : "border-brand/40 bg-card")}>
            <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-line" : "bg-brand")} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{humanize(n.kind)}</Badge>
                <span className="text-xs text-muted">{fmtRelative(n.createdAt)}</span>
              </div>
              {n.link ? (
                <Link href={n.link} className="mt-1 block font-semibold text-ink hover:text-brand-deep">
                  {n.title}
                </Link>
              ) : (
                <div className="mt-1 font-semibold text-ink">{n.title}</div>
              )}
              {n.body && <p className="text-sm text-muted">{n.body}</p>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
