import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { isEventMember } from "@/server/docs";
import { getEvent, timersFor } from "@/server/events";
import { can, eventScopeOf } from "@/server/rbac";

/** Live timer state. Staff see every timer; participants/judges/mentors see public ones. */
export async function GET(_req: Request, ctx: RouteContext<"/api/events/[eventId]/live">) {
  const { eventId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const event = await getEvent(eventId);
  if (!event) return NextResponse.json({ error: "not found" }, { status: 404 });
  const staff = await can(user.id, "events.view", eventScopeOf(event));
  if (!staff && !isEventMember(eventId, user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(
    { timers: timersFor(eventId, !staff), serverNow: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
