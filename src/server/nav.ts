import "server-only";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { mentorProfiles, notifications } from "@/db/schema";
import { allows, allowsAnywhere, PLATFORM } from "@/lib/rbac-core";
import { loadGrants } from "./rbac";

export type NavItem = { href: string; label: string; icon: string; badge?: number };
export type NavGroup = { title: string; items: NavItem[]; collapsible?: boolean };

export async function buildNav(userId: string): Promise<{ groups: NavGroup[]; roles: string[]; unread: number }> {
  const grants = await loadGrants(userId);
  const any = (p: string) => allowsAnywhere(grants, p);
  const plat = (p: string) => allows(grants, p, PLATFORM);
  const unread =
    db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))).get()?.n ?? 0;
  const isMentor = any("mentoring.submit") || !!db.select({ u: mentorProfiles.userId }).from(mentorProfiles).where(eq(mentorProfiles.userId, userId)).get();

  const groups: NavGroup[] = [
    {
      title: "Me",
      items: [
        { href: "/app", label: "Home", icon: "layout" },
        { href: "/app/my-events", label: "My events", icon: "ticket" },
        { href: "/app/opportunities", label: "Opportunities", icon: "sparkles" },
        { href: "/app/find-my-club", label: "Clubs for me", icon: "users" },
        { href: "/app/mentorship", label: "Mentorship", icon: "message" },
        { href: "/app/passport", label: "My passport", icon: "badge" },
      ],
    },
  ];
  const work: NavItem[] = [];
  if (any("events.view") || any("events.create")) work.push({ href: "/app/events", label: "Manage events", icon: "calendar" });
  if (any("events.create")) work.push({ href: "/app/events/new", label: "Create an event", icon: "plus" });
  if (any("evaluations.submit")) work.push({ href: "/app/judge", label: "Judging", icon: "gavel" });
  if (isMentor) work.push({ href: "/app/mentor", label: "Mentoring", icon: "graduation" });
  if (work.length) groups.push({ title: "My work", items: work });

  const admin: NavItem[] = [];
  if (plat("users.view")) admin.push({ href: "/app/admin", label: "Overview", icon: "shield" });
  if (plat("users.view")) admin.push({ href: "/app/admin/users", label: "People & access", icon: "user" });
  if (plat("roles.view")) admin.push({ href: "/app/admin/roles", label: "Roles", icon: "key" });
  if (plat("organizations.edit")) admin.push({ href: "/app/admin/organizations", label: "Colleges & clubs", icon: "building" });
  if (plat("events.view")) admin.push({ href: "/app/admin/events", label: "All events", icon: "calendar" });
  if (plat("opportunities.manage")) admin.push({ href: "/app/admin/opportunities", label: "Opportunities", icon: "sparkles" });
  if (plat("resources.manage")) admin.push({ href: "/app/admin/resources", label: "Learn page", icon: "book" });
  if (plat("mentors.approve")) admin.push({ href: "/app/admin/mentors", label: "Mentors", icon: "graduation" });
  if (plat("recommendations.manage")) admin.push({ href: "/app/admin/recommendations", label: "Club matching", icon: "compass" });
  if (plat("analytics.view")) admin.push({ href: "/app/admin/analytics", label: "Analytics", icon: "chart" });
  if (plat("audit.view")) admin.push({ href: "/app/admin/audit", label: "Audit log", icon: "scroll" });
  if (plat("settings.manage")) admin.push({ href: "/app/admin/settings", label: "Settings", icon: "settings" });
  if (admin.length) groups.push({ title: "Admin", items: admin, collapsible: true });

  const roles = [...new Set(grants.map((g) => g.roleName))];
  return { groups, roles, unread };
}
