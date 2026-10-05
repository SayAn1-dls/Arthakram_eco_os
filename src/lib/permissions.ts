/**
 * Permission catalog. Pure data — safe to import from client components.
 *
 * A permission is `<module>.<action>`. `*` grants everything (super admin only).
 * `<module>.manage` implies every other action on that module.
 */

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "manage",
  "publish",
  "approve",
  "export",
  "submit",
  "grant",
] as const;

type ModuleDef = {
  key: string;
  label: string;
  group: "Platform" | "Structure" | "Events" | "Operations" | "Competition" | "Ecosystem";
  actions: { action: (typeof PERMISSION_ACTIONS)[number]; label: string }[];
};

export const PERMISSION_MODULES: ModuleDef[] = [
  {
    key: "settings",
    label: "Platform settings",
    group: "Platform",
    actions: [{ action: "manage", label: "Change global settings" }],
  },
  {
    key: "users",
    label: "Users",
    group: "Platform",
    actions: [
      { action: "view", label: "View user directory" },
      { action: "create", label: "Create users" },
      { action: "edit", label: "Edit / suspend users" },
    ],
  },
  {
    key: "roles",
    label: "Roles",
    group: "Platform",
    actions: [
      { action: "view", label: "View roles" },
      { action: "manage", label: "Create & edit custom roles" },
    ],
  },
  {
    key: "access",
    label: "Access control",
    group: "Platform",
    actions: [{ action: "grant", label: "Grant & revoke access within scope" }],
  },
  {
    key: "audit",
    label: "Audit log",
    group: "Platform",
    actions: [{ action: "view", label: "View audit log" }],
  },
  {
    key: "analytics",
    label: "Analytics",
    group: "Platform",
    actions: [{ action: "view", label: "View analytics" }],
  },
  {
    key: "organizations",
    label: "Organizations & colleges",
    group: "Structure",
    actions: [
      { action: "create", label: "Create" },
      { action: "edit", label: "Edit" },
      { action: "delete", label: "Delete" },
    ],
  },
  {
    key: "clubs",
    label: "Clubs",
    group: "Structure",
    actions: [
      { action: "create", label: "Create clubs" },
      { action: "edit", label: "Edit club profile" },
      { action: "delete", label: "Delete clubs" },
      { action: "approve", label: "Approve members" },
    ],
  },
  {
    key: "events",
    label: "Events",
    group: "Events",
    actions: [
      { action: "view", label: "Open event workspace" },
      { action: "create", label: "Create events" },
      { action: "edit", label: "Edit event configuration" },
      { action: "delete", label: "Delete events" },
      { action: "publish", label: "Publish / go live / archive" },
      { action: "export", label: "Export event data" },
    ],
  },
  {
    key: "schedule",
    label: "Rounds & schedule",
    group: "Events",
    actions: [{ action: "manage", label: "Manage rounds, schedule & problem statements" }],
  },
  {
    key: "participants",
    label: "Participants",
    group: "Events",
    actions: [
      { action: "view", label: "View participants" },
      { action: "manage", label: "Manage participants" },
    ],
  },
  {
    key: "teams",
    label: "Teams",
    group: "Events",
    actions: [
      { action: "view", label: "View teams" },
      { action: "manage", label: "Manage teams" },
    ],
  },
  {
    key: "documents",
    label: "Documentation",
    group: "Events",
    actions: [
      { action: "view", label: "View internal documents" },
      { action: "create", label: "Create documents & upload files" },
      { action: "edit", label: "Edit documents" },
      { action: "publish", label: "Publish / archive documents" },
      { action: "delete", label: "Delete documents" },
    ],
  },
  {
    key: "timers",
    label: "Timers",
    group: "Operations",
    actions: [{ action: "manage", label: "Create & control timers" }],
  },
  {
    key: "qr",
    label: "QR codes",
    group: "Operations",
    actions: [{ action: "manage", label: "Generate & manage QR codes" }],
  },
  {
    key: "attendance",
    label: "Check-in & attendance",
    group: "Operations",
    actions: [{ action: "manage", label: "Check in participants, scan QR codes" }],
  },
  {
    key: "rooms",
    label: "Rooms",
    group: "Operations",
    actions: [{ action: "manage", label: "Manage rooms & allocation" }],
  },
  {
    key: "announcements",
    label: "Announcements",
    group: "Operations",
    actions: [{ action: "create", label: "Send announcements" }],
  },
  {
    key: "feedback",
    label: "Feedback",
    group: "Operations",
    actions: [{ action: "view", label: "View feedback" }],
  },
  {
    key: "rubrics",
    label: "Rubrics",
    group: "Competition",
    actions: [
      { action: "view", label: "View rubrics" },
      { action: "manage", label: "Create & edit rubrics" },
    ],
  },
  {
    key: "judges",
    label: "Judges",
    group: "Competition",
    actions: [{ action: "manage", label: "Invite & assign judges" }],
  },
  {
    key: "mentors",
    label: "Mentors",
    group: "Competition",
    actions: [
      { action: "create", label: "Invite & assign event mentors" },
      { action: "approve", label: "Approve mentor profiles (platform)" },
    ],
  },
  {
    key: "submissions",
    label: "Submissions",
    group: "Competition",
    actions: [
      { action: "view", label: "View submissions" },
      { action: "manage", label: "Manage submission status" },
    ],
  },
  {
    key: "evaluations",
    label: "Evaluations",
    group: "Competition",
    actions: [
      { action: "submit", label: "Evaluate assigned submissions" },
      { action: "view", label: "View all evaluations" },
      { action: "edit", label: "Reopen submitted evaluations" },
    ],
  },
  {
    key: "results",
    label: "Results",
    group: "Competition",
    actions: [
      { action: "edit", label: "Compute & verify results" },
      { action: "publish", label: "Publish results publicly" },
    ],
  },
  {
    key: "mentoring",
    label: "Mentoring",
    group: "Ecosystem",
    actions: [{ action: "submit", label: "Act as mentor (respond & review)" }],
  },
  {
    key: "opportunities",
    label: "Opportunities",
    group: "Ecosystem",
    actions: [{ action: "manage", label: "Add & curate opportunities" }],
  },
  {
    key: "resources",
    label: "Learning resources",
    group: "Ecosystem",
    actions: [{ action: "manage", label: "Manage Learn page" }],
  },
  {
    key: "recommendations",
    label: "Recommendation engine",
    group: "Ecosystem",
    actions: [{ action: "manage", label: "Tune club traits & assessment" }],
  },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_MODULES.flatMap((m) =>
  m.actions.map((a) => `${m.key}.${a.action}`),
);

export type Permission = string;

/** Does the granted set satisfy `required`? Handles `*` and `<module>.manage`. */
export function permissionSetAllows(granted: Set<string>, required: Permission): boolean {
  if (granted.has("*") || granted.has(required)) return true;
  const [mod] = required.split(".");
  return granted.has(`${mod}.manage`);
}

export function permissionLabel(p: string): string {
  if (p === "*") return "Everything (super admin)";
  const [mod, action] = p.split(".");
  const m = PERMISSION_MODULES.find((x) => x.key === mod);
  const a = m?.actions.find((x) => x.action === action);
  return m && a ? `${m.label} · ${a.label}` : p;
}

/* ───────────── System roles ───────────── */

const ORGANIZER_PERMS = [
  "events.view",
  "events.create",
  "events.edit",
  "events.publish",
  "events.export",
  "schedule.manage",
  "participants.manage",
  "teams.manage",
  "documents.view",
  "documents.create",
  "documents.edit",
  "documents.publish",
  "documents.delete",
  "timers.manage",
  "qr.manage",
  "attendance.manage",
  "rooms.manage",
  "announcements.create",
  "feedback.view",
  "rubrics.manage",
  "judges.manage",
  "mentors.create",
  "submissions.manage",
  "evaluations.view",
  "results.edit",
  "access.grant",
  "audit.view",
];

export const SYSTEM_ROLES: {
  key: string;
  name: string;
  description: string;
  color: string;
  permissions: string[];
}[] = [
  {
    key: "super_admin",
    name: "Super Admin",
    description: "Ultimate platform control, including managing other admins.",
    color: "#141414",
    permissions: ["*"],
  },
  {
    key: "admin",
    name: "Admin",
    description: "Controls the platform: users, structure, events, permissions and settings.",
    color: "#C2410C",
    permissions: ALL_PERMISSIONS,
  },
  {
    key: "club_lead",
    name: "Club Lead",
    description: "Runs a club: profile, members, and every event the club hosts.",
    color: "#EA580C",
    permissions: [...ORGANIZER_PERMS, "clubs.edit", "clubs.approve", "results.publish"],
  },
  {
    key: "organizer",
    name: "Organizer",
    description: "Operates events within their scope. Cannot publish results or touch platform settings.",
    color: "#F26A1B",
    permissions: ORGANIZER_PERMS,
  },
  {
    key: "judge",
    name: "Judge",
    description: "Evaluates assigned submissions using the published rubric. Cannot edit rubrics.",
    color: "#7C3AED",
    permissions: ["evaluations.submit", "rubrics.view"],
  },
  {
    key: "mentor",
    name: "Mentor",
    description: "Reviews assigned students and teams, gives structured feedback.",
    color: "#0F766E",
    permissions: ["mentoring.submit"],
  },
  {
    key: "volunteer",
    name: "Volunteer",
    description: "Checks in participants, scans QR codes and manages attendance.",
    color: "#2563EB",
    permissions: ["events.view", "participants.view", "attendance.manage"],
  },
  {
    key: "student",
    name: "Student",
    description: "Default role for every member. Discovers, participates and builds a passport.",
    color: "#78716C",
    permissions: [],
  },
];

/** Roles only a super admin may grant or revoke. */
export const PROTECTED_ROLE_KEYS = ["super_admin", "admin"];
