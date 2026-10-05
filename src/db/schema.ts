/**
 * Arthakram Ecosystem OS — relational data model.
 *
 * Hierarchy:  Platform → Organization → College → Club → Event → Round → Module
 * Every access decision is resolved against this chain (see src/server/rbac.ts).
 *
 * Timestamps are stored as epoch milliseconds and surface as `Date` objects.
 * JSON columns hold small lists/maps (tags, traits) — never relational data.
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
const createdAt = () =>
  ts("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`);
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();
const bool = (name: string) => integer(name, { mode: "boolean" });

/* ───────────────────────────── Identity ───────────────────────────── */

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  headline: text("headline"),
  status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
  createdAt: createdAt(),
  lastLoginAt: ts("last_login_at"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256(token) — the raw token only lives in the cookie
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ─────────────────────── Roles & permissions (RBAC) ─────────────────────── */

export const roles = sqliteTable("roles", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: bool("is_system").notNull().default(false),
  color: text("color").notNull().default("#F26A1B"),
  createdAt: createdAt(),
});

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permission] })],
);

export const SCOPE_TYPES = ["platform", "organization", "college", "club", "event"] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

export const roleAssignments = sqliteTable(
  "role_assignments",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    scopeType: text("scope_type", { enum: SCOPE_TYPES }).notNull(),
    scopeId: text("scope_id"), // null for platform scope
    note: text("note"),
    grantedById: text("granted_by_id").references(() => users.id),
    createdAt: createdAt(),
    expiresAt: ts("expires_at"),
    revokedAt: ts("revoked_at"),
    revokedById: text("revoked_by_id").references(() => users.id),
  },
  (t) => [
    index("ra_user_idx").on(t.userId),
    index("ra_scope_idx").on(t.scopeType, t.scopeId),
  ],
);

/* ─────────────────────────── Organizations ─────────────────────────── */

export const organizations = sqliteTable("organizations", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["network", "university", "company", "community"] })
    .notNull()
    .default("community"),
  description: text("description"),
  website: text("website"),
  contactEmail: text("contact_email"),
  color: text("color").notNull().default("#F26A1B"),
  createdAt: createdAt(),
});

export const colleges = sqliteTable("colleges", {
  id: id(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  city: text("city"),
  description: text("description"),
  website: text("website"),
  createdAt: createdAt(),
});

/** Dimension → weight (0..1). Used by the transparent club recommendation engine. */
export type TraitMap = Partial<Record<string, number>>;

export const clubs = sqliteTable("clubs", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  collegeId: text("college_id").references(() => colleges.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  color: text("color").notNull().default("#F26A1B"),
  contactEmail: text("contact_email"),
  fitProfile: text("fit_profile"),
  learnings: json<string[]>("learnings").notNull().default([]),
  activities: json<string[]>("activities").notNull().default([]),
  careerPaths: json<string[]>("career_paths").notNull().default([]),
  firstSteps: json<string[]>("first_steps").notNull().default([]),
  traits: json<TraitMap>("traits").notNull().default({}),
  isRecruiting: bool("is_recruiting").notNull().default(true),
  createdAt: createdAt(),
});

export const clubMembers = sqliteTable(
  "club_members",
  {
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["member", "core", "lead"] }).notNull().default("member"),
    status: text("status", { enum: ["pending", "active"] }).notNull().default("pending"),
    joinedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.clubId, t.userId] })],
);

/* ───────────────────────────── Events ───────────────────────────── */

export const EVENT_TYPES = [
  "hackathon",
  "product_competition",
  "consulting_case",
  "business_competition",
  "coding_competition",
  "ai_competition",
  "design_competition",
  "mun",
  "debate",
  "startup_competition",
  "marketing_competition",
  "sports_esports",
  "workshop",
  "seminar",
  "conference",
  "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = ["draft", "published", "live", "completed", "archived"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const events = sqliteTable(
  "events",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    type: text("type", { enum: EVENT_TYPES }).notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    collegeId: text("college_id").references(() => colleges.id, { onDelete: "set null" }),
    clubId: text("club_id").references(() => clubs.id, { onDelete: "set null" }),
    tagline: text("tagline"),
    description: text("description"),
    mode: text("mode", { enum: ["online", "offline", "hybrid"] }).notNull().default("offline"),
    venue: text("venue"),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    registrationDeadline: ts("registration_deadline"),
    teamSizeMin: integer("team_size_min").notNull().default(1),
    teamSizeMax: integer("team_size_max").notNull().default(4),
    eligibility: text("eligibility"),
    rules: text("rules"),
    prizes: text("prizes"),
    sponsors: json<string[]>("sponsors").notNull().default([]),
    tags: json<string[]>("tags").notNull().default([]),
    contactEmail: text("contact_email"),
    status: text("status", { enum: EVENT_STATUSES }).notNull().default("draft"),
    visibility: text("visibility", { enum: ["public", "private"] }).notNull().default("public"),
    registrationOpen: bool("registration_open").notNull().default(false),
    resultsPublished: bool("results_published").notNull().default(false),
    resultsVerifiedAt: ts("results_verified_at"),
    allowJudgeEditAfterSubmit: bool("allow_judge_edit").notNull().default(false),
    currentRoundId: text("current_round_id"),
    createdById: text("created_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("events_org_idx").on(t.organizationId), index("events_club_idx").on(t.clubId)],
);

export const eventRounds = sqliteTable("event_rounds", {
  id: id(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  submissionDeadline: ts("submission_deadline"),
  status: text("status", { enum: ["upcoming", "active", "judging", "completed"] })
    .notNull()
    .default("upcoming"),
  isFinal: bool("is_final").notNull().default(false),
});

export const scheduleItems = sqliteTable("schedule_items", {
  id: id(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  kind: text("kind", { enum: ["session", "break", "deadline", "judging", "ceremony"] })
    .notNull()
    .default("session"),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at"),
  location: text("location"),
});

export const problemStatements = sqliteTable("problem_statements", {
  id: id(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  track: text("track"),
  description: text("description"),
});

export const rooms = sqliteTable("rooms", {
  id: id(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  location: text("location"),
  capacity: integer("capacity").notNull().default(0),
  notes: text("notes"),
});

export const teams = sqliteTable(
  "teams",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    status: text("status", { enum: ["active", "disqualified", "withdrawn"] })
      .notNull()
      .default("active"),
    roomId: text("room_id").references(() => rooms.id, { onDelete: "set null" }),
    problemStatementId: text("problem_statement_id").references(() => problemStatements.id, {
      onDelete: "set null",
    }),
    mentorUserId: text("mentor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("teams_event_idx").on(t.eventId)],
);

export const participants = sqliteTable(
  "participants",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    isTeamLead: bool("is_team_lead").notNull().default(false),
    status: text("status", { enum: ["registered", "confirmed", "waitlisted", "withdrawn"] })
      .notNull()
      .default("registered"),
    college: text("college"),
    checkinToken: text("checkin_token").notNull().unique(),
    checkedInAt: ts("checked_in_at"),
    checkedInById: text("checked_in_by_id").references(() => users.id),
    registeredAt: createdAt(),
  },
  (t) => [
    uniqueIndex("participant_event_user_uq").on(t.eventId, t.userId),
    index("participants_team_idx").on(t.teamId),
  ],
);

export const attendanceLogs = sqliteTable("attendance_logs", {
  id: id(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  participantId: text("participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["checkin", "room_entry", "session"] }).notNull(),
  roomId: text("room_id").references(() => rooms.id, { onDelete: "set null" }),
  recordedById: text("recorded_by_id").references(() => users.id),
  createdAt: createdAt(),
});

/* ─────────────────────── Competition engine ─────────────────────── */

export const SUBMISSION_STATUSES = [
  "not_started",
  "draft",
  "submitted",
  "under_review",
  "reviewed",
  "final",
] as const;

export const submissions = sqliteTable(
  "submissions",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    roundId: text("round_id")
      .notNull()
      .references(() => eventRounds.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    status: text("status", { enum: SUBMISSION_STATUSES }).notNull().default("draft"),
    title: text("title"),
    description: text("description"),
    repoUrl: text("repo_url"),
    demoUrl: text("demo_url"),
    deckUrl: text("deck_url"),
    videoUrl: text("video_url"),
    docsUrl: text("docs_url"),
    submittedAt: ts("submitted_at"),
    submittedById: text("submitted_by_id").references(() => users.id),
    updatedAt: ts("updated_at"),
  },
  (t) => [uniqueIndex("submission_round_team_uq").on(t.roundId, t.teamId)],
);

export const rubrics = sqliteTable("rubrics", {
  id: id(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  roundId: text("round_id").references(() => eventRounds.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  createdById: text("created_by_id").references(() => users.id),
  createdAt: createdAt(),
});

export const rubricCriteria = sqliteTable("rubric_criteria", {
  id: id(),
  rubricId: text("rubric_id")
    .notNull()
    .references(() => rubrics.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  instructions: text("instructions"),
  weight: real("weight").notNull(), // percentage, criteria of a rubric sum to 100
  minScore: integer("min_score").notNull().default(0),
  maxScore: integer("max_score").notNull().default(10),
  order: integer("order").notNull().default(0),
});

export const judgeAssignments = sqliteTable(
  "judge_assignments",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    roundId: text("round_id")
      .notNull()
      .references(() => eventRounds.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    judgeUserId: text("judge_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("judge_assignment_uq").on(t.roundId, t.teamId, t.judgeUserId)],
);

export const evaluations = sqliteTable(
  "evaluations",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    roundId: text("round_id")
      .notNull()
      .references(() => eventRounds.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    judgeUserId: text("judge_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rubricId: text("rubric_id")
      .notNull()
      .references(() => rubrics.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["draft", "submitted"] }).notNull().default("draft"),
    totalScore: real("total_score"), // weighted, normalised to 0..100
    feedback: text("feedback"),
    privateNotes: text("private_notes"),
    submittedAt: ts("submitted_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => [uniqueIndex("evaluation_uq").on(t.roundId, t.teamId, t.judgeUserId)],
);

export const evaluationScores = sqliteTable(
  "evaluation_scores",
  {
    evaluationId: text("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    criterionId: text("criterion_id")
      .notNull()
      .references(() => rubricCriteria.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    comment: text("comment"),
  },
  (t) => [primaryKey({ columns: [t.evaluationId, t.criterionId] })],
);

/** Recognitions created when results are published — evidence for the Student Passport. */
export const awards = sqliteTable("awards", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  rank: integer("rank"),
  createdAt: createdAt(),
});

/* ─────────────────────── Operations modules ─────────────────────── */

export const TIMER_KINDS = ["event", "round", "submission", "judging", "presentation", "break"] as const;

export const timers = sqliteTable("timers", {
  id: id(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  roundId: text("round_id").references(() => eventRounds.id, { onDelete: "set null" }),
  label: text("label").notNull(),
  kind: text("kind", { enum: TIMER_KINDS }).notNull().default("round"),
  durationSec: integer("duration_sec").notNull(),
  status: text("status", { enum: ["idle", "running", "paused", "ended"] }).notNull().default("idle"),
  startedAt: ts("started_at"), // start of the current running segment
  elapsedBeforeSec: integer("elapsed_before_sec").notNull().default(0),
  endedAt: ts("ended_at"),
  visibleToParticipants: bool("visible_to_participants").notNull().default(true),
  updatedAt: ts("updated_at"),
  createdAt: createdAt(),
});

export const QR_PURPOSES = [
  "registration",
  "checkin",
  "attendance",
  "room_entry",
  "submission",
  "judge_evaluation",
  "feedback",
  "event_info",
  "documentation",
  "schedule",
  "team_verification",
  "mentor_access",
] as const;
export type QrPurpose = (typeof QR_PURPOSES)[number];

export const qrCodes = sqliteTable("qr_codes", {
  id: id(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  purpose: text("purpose", { enum: QR_PURPOSES }).notNull(),
  label: text("label").notNull(),
  roomId: text("room_id").references(() => rooms.id, { onDelete: "set null" }),
  roundId: text("round_id").references(() => eventRounds.id, { onDelete: "set null" }),
  scans: integer("scans").notNull().default(0),
  active: bool("active").notNull().default(true),
  createdById: text("created_by_id").references(() => users.id),
  createdAt: createdAt(),
});

export const announcements = sqliteTable("announcements", {
  id: id(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  priority: text("priority", { enum: ["info", "important", "urgent"] }).notNull().default("info"),
  audience: text("audience", { enum: ["everyone", "participants", "judges", "mentors", "staff"] })
    .notNull()
    .default("everyone"),
  pinned: bool("pinned").notNull().default(false),
  createdById: text("created_by_id").references(() => users.id),
  createdAt: createdAt(),
});

export const feedback = sqliteTable("feedback", {
  id: id(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  role: text("role", { enum: ["participant", "judge", "mentor", "organizer", "guest"] })
    .notNull()
    .default("participant"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: createdAt(),
});

/* ─────────────────────── Documentation OS ─────────────────────── */

export const DOC_SECTIONS = [
  "overview",
  "rules",
  "problem_statements",
  "schedule",
  "teams",
  "judges",
  "mentors",
  "submissions",
  "rubrics",
  "announcements",
  "resources",
  "results",
  "feedback",
  "media",
  "final_report",
] as const;
export type DocSection = (typeof DOC_SECTIONS)[number];

export const documents = sqliteTable(
  "documents",
  {
    id: id(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    section: text("section", { enum: DOC_SECTIONS }).notNull(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
    visibility: text("visibility", { enum: ["internal", "participants", "public"] })
      .notNull()
      .default("internal"),
    order: integer("order").notNull().default(0),
    createdById: text("created_by_id").references(() => users.id),
    updatedById: text("updated_by_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: ts("updated_at"),
  },
  (t) => [index("documents_event_idx").on(t.eventId)],
);

export const documentRevisions = sqliteTable("document_revisions", {
  id: id(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  editedById: text("edited_by_id").references(() => users.id),
  createdAt: createdAt(),
});

export const files = sqliteTable("files", {
  id: id(),
  eventId: text("event_id").references(() => events.id, { onDelete: "cascade" }),
  documentId: text("document_id").references(() => documents.id, { onDelete: "cascade" }),
  submissionId: text("submission_id").references(() => submissions.id, { onDelete: "cascade" }),
  uploadedById: text("uploaded_by_id").references(() => users.id),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  createdAt: createdAt(),
});

/* ─────────────────────── Student ecosystem ─────────────────────── */

export const studentProfiles = sqliteTable("student_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  collegeId: text("college_id").references(() => colleges.id, { onDelete: "set null" }),
  program: text("program"),
  year: integer("year"),
  bio: text("bio"),
  interests: json<string[]>("interests").notNull().default([]),
  skills: json<string[]>("skills").notNull().default([]),
  careerGoals: json<string[]>("career_goals").notNull().default([]),
  linkedinUrl: text("linkedin_url"),
  githubUrl: text("github_url"),
  portfolioUrl: text("portfolio_url"),
  weeklyHours: integer("weekly_hours"),
  updatedAt: ts("updated_at"),
});

export const clubAssessments = sqliteTable("club_assessments", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  answers: json<Record<string, string | number>>("answers").notNull(),
  dimensionScores: json<Record<string, number>>("dimension_scores").notNull(),
  results: json<{ clubId: string; score: number; reasons: string[] }[]>("results").notNull(),
  createdAt: createdAt(),
});

export const mentorProfiles = sqliteTable("mentor_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  headline: text("headline").notNull(),
  bio: text("bio"),
  industry: text("industry"),
  experienceYears: integer("experience_years").notNull().default(0),
  expertise: json<string[]>("expertise").notNull().default([]),
  skills: json<string[]>("skills").notNull().default([]),
  categories: json<string[]>("categories").notNull().default([]),
  availability: text("availability"),
  linkedinUrl: text("linkedin_url"),
  status: text("status", { enum: ["pending", "approved", "paused"] }).notNull().default("pending"),
  createdAt: createdAt(),
});

export const MENTOR_WORK_TYPES = [
  "project",
  "product_case",
  "consulting_case",
  "competition",
  "startup_idea",
  "portfolio",
  "presentation",
] as const;

export const mentorRequests = sqliteTable("mentor_requests", {
  id: id(),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mentorId: text("mentor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  message: text("message"),
  workType: text("work_type", { enum: MENTOR_WORK_TYPES }).notNull().default("project"),
  workUrl: text("work_url"),
  status: text("status", { enum: ["pending", "accepted", "declined", "completed"] })
    .notNull()
    .default("pending"),
  createdAt: createdAt(),
  respondedAt: ts("responded_at"),
});

export const mentorReviews = sqliteTable("mentor_reviews", {
  id: id(),
  requestId: text("request_id").references(() => mentorRequests.id, { onDelete: "set null" }),
  mentorId: text("mentor_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  workType: text("work_type", { enum: MENTOR_WORK_TYPES }).notNull().default("project"),
  scores: json<{ dimension: string; score: number }[]>("scores").notNull().default([]),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  improvements: text("improvements"),
  nextSteps: text("next_steps"),
  createdAt: createdAt(),
});

export const OPPORTUNITY_CATEGORIES = [
  "hackathon",
  "product_competition",
  "consulting_competition",
  "case_competition",
  "coding_competition",
  "ai_competition",
  "startup_challenge",
  "design_competition",
  "marketing_competition",
  "mun",
  "debate",
  "business_challenge",
  "fellowship",
  "workshop",
  "internship",
  "other",
] as const;

export const opportunities = sqliteTable("opportunities", {
  id: id(),
  title: text("title").notNull(),
  organizer: text("organizer").notNull(),
  category: text("category", { enum: OPPORTUNITY_CATEGORIES }).notNull(),
  source: text("source", { enum: ["arthakram", "unstop", "external"] }).notNull().default("external"),
  sourceUrl: text("source_url"),
  eventId: text("event_id").references(() => events.id, { onDelete: "set null" }),
  description: text("description"),
  tags: json<string[]>("tags").notNull().default([]),
  mode: text("mode", { enum: ["online", "offline", "hybrid"] }).notNull().default("online"),
  location: text("location"),
  prize: text("prize"),
  eligibility: text("eligibility"),
  deadline: ts("deadline"),
  startsAt: ts("starts_at"),
  status: text("status", { enum: ["draft", "active", "closed"] }).notNull().default("active"),
  featured: bool("featured").notNull().default(false),
  createdById: text("created_by_id").references(() => users.id),
  createdAt: createdAt(),
});

export const savedOpportunities = sqliteTable(
  "saved_opportunities",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.opportunityId] })],
);

export const learningResources = sqliteTable("learning_resources", {
  id: id(),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url"),
  ctaLabel: text("cta_label").notNull().default("Visit"),
  kind: text("kind", { enum: ["arthakram_product", "guide", "course", "video", "tool"] })
    .notNull()
    .default("guide"),
  tags: json<string[]>("tags").notNull().default([]),
  order: integer("order").notNull().default(0),
  active: bool("active").notNull().default(true),
  createdAt: createdAt(),
});

/* ─────────────────────── Platform services ─────────────────────── */

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    eventId: text("event_id"),
    summary: text("summary").notNull(),
    before: json<unknown>("before"),
    after: json<unknown>("after"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_event_idx").on(t.eventId), index("audit_created_idx").on(t.createdAt)],
);

export const platformSettings = sqliteTable("platform_settings", {
  key: text("key").primaryKey(),
  value: json<unknown>("value").notNull(),
  updatedAt: ts("updated_at"),
});
