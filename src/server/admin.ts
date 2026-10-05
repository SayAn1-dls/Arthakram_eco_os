import "server-only";
import { PLATFORM, requirePermission } from "./rbac";
import { getCurrentUser } from "./auth";
import { can } from "./rbac";

/** Page guard for admin screens: returns the user or null (render <Forbidden/>). */
export async function adminPage(permission: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return (await can(user.id, permission, PLATFORM)) ? user : null;
}

export { requirePermission };
