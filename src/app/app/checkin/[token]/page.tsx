import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, participants, teams, users } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { can, eventScopeOf } from "@/server/rbac";
import { manualCheckIn } from "@/server/actions/operations";
import { ActionForm, SubmitButton } from "@/components/forms";
import { QrSvg } from "@/components/qr";
import { Avatar, Badge, Card } from "@/components/ui";
import { fmtTime } from "@/lib/format";
import { appUrl } from "@/lib/utils";

export const metadata = { title: "Check-in pass" };

/** Personal pass. Staff scanning it get a confirm button; the owner sees their pass. */
export default async function PassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireUser();
  const p = db.select().from(participants).where(eq(participants.checkinToken, token)).get();
  if (!p) notFound();
  const e = db.select().from(events).where(eq(events.id, p.eventId)).get()!;
  const owner = db.select().from(users).where(eq(users.id, p.userId)).get()!;
  const team = p.teamId ? db.select().from(teams).where(eq(teams.id, p.teamId)).get() : null;
  const staff = await can(user.id, "attendance.manage", eventScopeOf(e));
  if (!staff && user.id !== p.userId) notFound();
  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <div className="text-center">
          <div className="eyebrow text-brand-deep">{e.title}</div>
          <div className="mt-4 flex justify-center">
            <Avatar name={owner.name} size={56} />
          </div>
          <h1 className="mt-3 text-2xl font-extrabold">{owner.name}</h1>
          {team && (
            <div className="text-sm text-muted">
              {team.name} · {team.code}
            </div>
          )}
          <div className="mt-3">{p.checkedInAt ? <Badge tone="ok">Checked in at {fmtTime(p.checkedInAt)}</Badge> : <Badge tone="warn">Not checked in</Badge>}</div>
          {staff ? (
            !p.checkedInAt && (
              <ActionForm action={manualCheckIn} hidden={{ eventId: e.id, participantId: p.id }} className="mt-6">
                <SubmitButton size="lg" className="w-full">
                  Confirm check-in
                </SubmitButton>
              </ActionForm>
            )
          ) : (
            <div className="mt-6 flex justify-center rounded-xl bg-white p-4">
              <QrSvg value={appUrl(`/app/checkin/${token}`)} size={220} />
            </div>
          )}
          {staff && (
            <Link href={`/app/events/${e.id}/checkin`} className="mt-4 inline-block text-sm font-semibold text-brand-deep">
              Back to check-in desk
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
