import "server-only";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { mentorProfiles, notifications } from "@/db/schema";
import { allows, allowsAnywhere, PLATFORM } from "@/lib/rbac-core";
import { loadGrants } from "./rbac";

export type NavItem = { href: string; label: string; icon: string; badge?: number };
export type NavGroup = { title: string; items: NavItem[] };

export async function buildNav(userId: string): Promise<{ groups: NavGroup[]; roles: string[]; unread: number }> {
  const grants = await loadGrants(userId);
  const any = (p: string) => allowsAnywhere(grants, p);
  const plat = (p: string) => allows(grants, p, PLATFORM);
  const unread =
    db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))).get()?.n ?? 0;
  const isMentor = any("mentoring.submit") || !!db.select({ u: mentorProfiles.userId }).from(mentorProfiles).where(eq(mentorProfiles.userId, userId)).get();

  const groups: NavGroup[] = [
    {
      title: "You",
      items: [
        { href: "/app", label: "Dashboard", icon: "layout" },
        { href: "/app/path", label: "My Path", icon: "compass" },
        { href: "/app/opportunities", label: "Opportunities", icon: "sparkles" },
        { href: "/app/my-events", label: "My Events", icon: "ticket" },
        { href: "/app/find-my-club", label: "Find My Club", icon: "users" },
        { href: "/app/mentorship", label: "Mentorship", icon: "message" },
        { href: "/app/passport", label: "Student Passport", icon: "badge" },
        { href: "/app/notifications", label: "Notifications", icon: "bell", badge: unread || undefined },
      ],
    },
  ];
  const organize: NavItem[] = [];
  if (any("events.view") || any("events.create")) organize.push({ href: "/app/events", label: "Event Workspaces", icon: "calendar" });
  if (any("events.create")) organize.push({ href: "/app/events/new", label: "Event Builder", icon: "plus" });
  if (organize.length) groups.push({ title: "Organize", items: organize });

  const review: NavItem[] = [];
  if (any("evaluations.submit")) review.push({ href: "/app/judge", label: "Judge Dashboard", icon: "gavel" });
  if (isMentor) review.push({ href: "/app/mentor", label: "Mentor Dashboard", icon: "graduation" });
  if (review.length) groups.push({ title: "Review", items: review });

  const admin: NavItem[] = [];
  if (plat("users.view")) admin.push({ href: "/app/admin", label: "Admin Overview", icon: "shield" });
  if (plat("users.view")) admin.push({ href: "/app/admin/users", label: "Users", icon: "user" });
  if (plat("roles.view")) admin.push({ href: "/app/admin/roles", label: "Roles & Permissions", icon: "key" });
  if (plat("organizations.edit")) admin.push({ href: "/app/admin/organizations", label: "Orgs, Colleges & Clubs", icon: "building" });
  if (plat("events.view")) admin.push({ href: "/app/admin/events", label: "All Events", icon: "calendar" });
  if (plat("opportunities.manage")) admin.push({ href: "/app/admin/opportunities", label: "Opportunities", icon: "sparkles" });
  if (plat("resources.manage")) admin.push({ href: "/app/admin/resources", label: "Learning Resources", icon: "book" });
  if (plat("mentors.approve")) admin.push({ href: "/app/admin/mentors", label: "Mentors", icon: "graduation" });
  if (plat("recommendations.manage")) admin.push({ href: "/app/admin/recommendations", label: "Recommendations", icon: "compass" });
  if (plat("analytics.view")) admin.push({ href: "/app/admin/analytics", label: "Analytics", icon: "chart" });
  if (plat("audit.view")) admin.push({ href: "/app/admin/audit", label: "Audit Log", icon: "scroll" });
  if (plat("settings.manage")) admin.push({ href: "/app/admin/settings", label: "Settings", icon: "settings" });
  if (admin.length) groups.push({ title: "Admin", items: admin });

  const roles = [...new Set(grants.map((g) => g.roleName))];
  return { groups, roles, unread };
}
