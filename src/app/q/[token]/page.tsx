import { notFound, redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, participants, qrCodes, rooms } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { qrSelfAction } from "@/server/actions/student";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Wordmark } from "@/components/logo";
import { humanize } from "@/lib/format";

export const metadata = { title: "Scan" };

/** Every Arthakram QR code resolves here, then routes to the module it was generated for. */
export default async function QrResolver({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const q = db.select().from(qrCodes).where(eq(qrCodes.token, token)).get();
  if (!q) notFound();
  const e = db.select().from(events).where(eq(events.id, q.eventId)).get()!;
  if (!q.active) return <Shell title="This code is disabled" body={`The organizers of ${e.title} have turned this QR code off.`} />;
  db.update(qrCodes).set({ scans: sql`${qrCodes.scans} + 1` }).where(eq(qrCodes.id, q.id)).run();

  switch (q.purpose) {
    case "registration":
    case "event_info":
      redirect(`/events/${e.slug}`);
    case "schedule":
      redirect(`/events/${e.slug}#schedule`);
    case "documentation":
      redirect(`/events/${e.slug}#docs`);
    case "feedback":
      redirect(`/events/${e.slug}/feedback`);
    case "judge_evaluation":
      redirect("/app/judge");
    case "mentor_access":
      redirect("/app/mentor");
  }
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/q/${token}`);
  const p = db.select().from(participants).where(and(eq(participants.eventId, e.id), eq(participants.userId, user.id))).get();
  if ((q.purpose === "submission" || q.purpose === "team_verification") && p?.teamId) redirect(`/app/team/${p.teamId}`);
  if (q.purpose === "submission" || q.purpose === "team_verification") redirect("/app/my-events");

  const room = q.roomId ? db.select().from(rooms).where(eq(rooms.id, q.roomId)).get() : null;
  return (
    <Shell title={`${humanize(q.purpose)} · ${e.title}`} body={room ? `Room: ${room.name}` : q.label}>
      {p ? (
        <ActionForm action={qrSelfAction} hidden={{ token }} className="mt-6">
          <SubmitButton size="lg" className="w-full">
            {q.purpose === "checkin" ? (p.checkedInAt ? "Already checked in — log entry" : "Check me in") : "Record my attendance"}
          </SubmitButton>
        </ActionForm>
      ) : (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-bad">You’re signed in as {user.name}, who isn’t registered for this event.</p>
      )}
    </Shell>
  );
}

function Shell({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center">
        <Wordmark size="sm" />
        <h1 className="mt-6 text-xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted">{body}</p>
        {children}
      </div>
    </div>
  );
}
