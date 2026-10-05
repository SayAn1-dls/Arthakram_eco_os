import { eventAccess } from "@/server/events";
import { AccessManager } from "@/components/access-manager";
import { Forbidden } from "@/components/ui";

export const metadata = { title: "Event access" };

export default async function EventAccessPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { user, event, scope, has } = await eventAccess(eventId);
  if (!has("access.grant")) return <Forbidden />;
  return <AccessManager viewerId={user.id} scope={scope} scopeLabel={event.title} />;
}
