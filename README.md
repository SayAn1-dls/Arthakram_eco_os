# Arthakram Ecosystem OS

> **Arthakram helps students discover where they belong and helps organizations run the ecosystem around them.**

A single operating system for the college ecosystem. Students use it to discover clubs, competitions, mentors and opportunities, and to build an evidence-based Student Passport. Clubs, colleges and organizers use it to **create → organize → operate → judge → document → publish → archive** events from one Event Workspace. Admins **control → configure → delegate → monitor → analyze** through role-based access that goes down to a single event.

It replaces *WhatsApp + Forms + Sheets + Notion + Drive + a timer + a QR generator + judging sheets* with one workspace.

---

## Quick start

```bash
npm install
cp .env.example .env          # optional — defaults work locally
npm run db:migrate            # creates storage/arthakram.db
npm run db:seed               # realistic demo ecosystem
npm run dev                   # http://localhost:3000
```

`npm run db:reset` wipes the database and re-runs migrate + seed. **Stop the dev server first**, because a running server keeps the old database file open.

Run the checks with `npm test` (access control, scoring, timers and recommendations), `npm run typecheck` and `npm run build`.

### Demo accounts (password `arthakram123` for all)

| Role | Email | Try |
|---|---|---|
| Super Admin | `admin@arthakram.demo` | Admin → Users → grant/revoke; Roles; Audit Log |
| Admin | `ops@arthakram.demo` | Platform control without super-admin powers |
| Club Lead | `lead@arthakram.demo` | Owns every Arthakram-club event; can publish results |
| Organizer | `organizer@arthakram.demo` | Full access to *Product Hackathon*, view-only on *AI Hackathon*, judge on *CodeSprint* |
| Judge | `judge@arthakram.demo` | Judge Dashboard → score with the rubric |
| Mentor | `mentor@arthakram.demo` | Requests, reviews, event teams |
| Volunteer | `volunteer@arthakram.demo` | Check-in desk only |
| Documentation Manager (custom role) | `docs@arthakram.demo` | Documents tab only |
| Student | `student@arthakram.demo` | Dashboard, My Path, Find My Club, Passport, team workspace |
| Partner club lead | `northfield@arthakram.demo` | A separate organization. Its data is isolated from Arthakram's. |

Demo data is relative to *now*, so the **Product Hackathon 2026 is always live** when you seed. It has 12 teams, 4 judges, running timers, partial Round 2 submissions and judging in progress. Other events: the AI Hackathon (registration open), the Consulting Case Challenge (completed, results published, archived with a final report), CodeSprint, the Founders Day Startup Challenge, a draft MUN, and a Northfield event in another organization.

---

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions) + **React 19** + **TypeScript**
- **SQLite** via **better-sqlite3** + **Drizzle ORM**, with versioned SQL migrations in `drizzle/`
- **Tailwind CSS 4** with the Arthakram poster palette (cream paper, one orange). Type is **Source Sans 3**, a humanist face that stays readable in dense tables. The logo is the real Arthakram mark, cut from the Founders Day poster with `scripts/extract-logo.cjs` into `public/brand/`
- `zod` validation, `qrcode` for QR SVGs, `react-markdown` (raw HTML disabled) for documents

Everything runs as one deployable app. The "backend" is the `src/server/` layer (server actions, route handlers and queries), and every request goes through it.

## Architecture

```
src/
  db/schema.ts            Relational data model (≈40 tables)
  lib/                    Pure logic (unit-tested, client-safe)
    permissions.ts        Permission catalog + system roles
    rbac-core.ts          Scope chain, effective permissions, escalation guard
    scoring.ts            Weighted rubric scores, ranking, judge calibration
    timer.ts              Timer state machine (start/pause/resume/reset/end)
    recommend.ts          Find My Club, opportunity matching, "what next"
  server/                 Server-only layer
    auth.ts               scrypt passwords, hashed session tokens, httpOnly cookie
    rbac.ts               requirePermission / requireEventPermission (used by every mutation)
    audit.ts, notify.ts   Append-only audit log, in-app notifications
    actions/*.ts          Server actions — each one authenticates, authorizes, validates, audits
    events.ts, results.ts, student.ts, search.ts, docs.ts, files.ts
  app/
    (public)/             Home, Explore, Opportunities, Events, Competitions, Clubs, Mentors, Organizations, Learn, Archive
    app/                  Signed-in shell (role-aware sidebar)
      events/[eventId]/   Event Workspace: 20 permission-gated modules
      judge/, mentor/, admin/, path, find-my-club, passport, …
    api/                  Live timers, CSV export, permission-checked file downloads
    q/[token]             Resolver for every Arthakram QR code
    present/…             Full-screen projector timer
```

### Access control (RBAC)

- **Hierarchy:** `Platform → Organization → College → Club → Event`. A grant applies to its scope and everything beneath it, never sideways. That is how event data stays isolated between organizations.
- **Permissions** are `module.action` (`events.edit`, `rubrics.manage`, `results.publish`, …). `module.manage` implies every action on that module. The full catalog is in `src/lib/permissions.ts`.
- **System roles:** Super Admin, Admin, Club Lead, Organizer, Judge, Mentor, Volunteer, Student. Admins can create **custom roles** (for example the seeded *Documentation Manager* and *Event Viewer*) from a permission matrix.
- **Grants** carry a scope, an optional expiry and a note. **Revocation** keeps the row with `revokedAt` so the full permission history survives.
- **Escalation guard:** you can only grant or revoke a role whose permissions you already hold at that scope. Only a super admin can touch admin roles. `judges.manage` is a narrow delegation that may grant exactly the Judge role on one event.
- **Enforced on the server.** Every server action and route handler calls `requirePermission(...)` or checks ownership. The UI hides what you can't use, but it is never the security boundary.
- Built-in rules: judges cannot modify rubrics; organizers can compute and verify results but **only admins or club leads can publish them**; results cannot be published while evaluations are pending; students see no organizer data.

### Event Workspace modules

Control Room (live status, timers, judge progress, room occupancy, lifecycle checklist, recent activity) · Setup & lifecycle (draft → published → live → completed → archived) · Rounds, schedule & problem statements · Participants & Teams (searchable, filterable, sortable tables with bulk actions and CSV export) · Check-in (personal QR passes, scanner input, manual) · Rooms · Timers (event, round, submission, judging, presentation and break; synced to every screen; projector view) · QR codes (12 purposes, each tied to the event or module, with scan counts) · Announcements (audience-targeted, in-app notifications) · Documentation (event-aware sections, Markdown editor with live preview, tables, attachments, publish states, visibility, version history with restore) · Rubrics · Judges (invite, balanced auto-assignment, assignment matrix, **calibration**) · Mentors · Submissions · Results (weighted leaderboard, criteria breakdown, verify → publish, Passport awards) · Feedback · Final Report (print/PDF) · Access · Audit log.

### Student ecosystem

- **Find My Club:** 17 questions produce scores on 12 dimensions, matched against admin-tunable club trait profiles (50% coverage + 50% cosine similarity). Every match shows its reasons, what you'll learn and do, who fits, career paths and first steps.
- **Opportunity feed:** ranked by interests, skills, assessment, clubs and past competitions, with a percentage and the reasons. External listings (for example Unstop) always link to the original registration page. They are added by admins or a permitted feed, never scraped.
- **What should I do next?** (dashboard and My Path): a rule-based three-step plan across club → competition → mentor → resource, plus the personal Arthakram graph.
- **Student Passport:** evidence instead of badges. It records competitions, submissions, published results, awards, mentor reviews and clubs, with the skills derived from them.
- **Mentor Connect:** mentor profiles (admin-approved), requests, and structured reviews that feed the Passport.
- **Learn:** cards that link to the separate **Product Guys** and **Consulting** products. Set `PRODUCT_GUYS_URL` / `CONSULTING_URL` before seeding, or edit the cards under Admin → Learning Resources.

### Security notes

Passwords are hashed with scrypt. Session tokens are random, stored only as SHA-256 hashes, and sent in an httpOnly SameSite cookie. Server Actions get Next.js's built-in origin checks. Input is validated with zod. Uploads are type- and size-checked (10 MB), stored under random names, and served only after a permission check. CSV exports neutralize spreadsheet formulas. Markdown never renders raw HTML. Datetime inputs are interpreted as IST, so the server's timezone can't shift event times.

## Roadmap (from the product brief)

Phases 1–4 are implemented here: the event ecosystem, competition engine, student ecosystem and discovery engine. Next:

- **Phase 5, intelligence:** an ML ranker trained on the stored assessment, activity and feedback signals; an event assistant; document summarization.
- Postgres for multi-campus scale (the schema is relational and portable; swap `sqlite-core` for `pg-core`).
- Official opportunity-feed integrations, email/push notifications, SSO for colleges, real-time push (SSE) in place of the 4-second timer polling.
