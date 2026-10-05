import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { isEventMember } from "@/server/docs";
import { getEvent, timersFor } from "@/server/events";
import { can, eventScopeOf } from "@/server/rbac";
import { LiveTimerFocus } from "@/components/live";
import { Wordmark } from "@/components/logo";

export const metadata = { title: "Timer" };

/** Full-screen projector view — open on the venue screen. */
export default async function PresentTimer({ params }: { params: Promise<{ eventId: string; timerId: string }> }) {
  const { eventId, timerId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/present/${eventId}/${timerId}`);
  const event = await getEvent(eventId);
  if (!event) notFound();
  const staff = await can(user.id, "events.view", eventScopeOf(event));
  if (!staff && !isEventMember(eventId, user.id)) notFound();
  const timers = timersFor(eventId, !staff);
  if (!timers.some((t) => t.id === timerId)) notFound();
  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-paper p-10">
      <div className="flex w-full items-center justify-between">
        <Wordmark size="md" />
        <div className="text-right text-xl font-bold">{event.title}</div>
      </div>
      <LiveTimerFocus eventId={eventId} initial={timers} serverNow={Date.now()} timerId={timerId} />
      <div className="eyebrow text-brand-deep">Arthakram for the 1%</div>
    </div>
  );
}
