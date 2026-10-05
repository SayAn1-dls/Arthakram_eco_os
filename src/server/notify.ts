import { db } from "@/db";
import { notifications } from "@/db/schema";
import { newId } from "@/lib/utils";

export type NotificationInput = { kind: string; title: string; body?: string; link?: string };

export function notify(userIds: Iterable<string>, n: NotificationInput) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  db.insert(notifications)
    .values(ids.map((userId) => ({ id: newId("nt_"), userId, ...n })))
    .run();
}
