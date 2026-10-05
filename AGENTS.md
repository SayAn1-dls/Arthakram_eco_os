<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Arthakram project notes

- Every mutation lives in `src/server/actions/*` (`"use server"`) and must call `requirePermission` / `requireEventPermission` (or check ownership) before touching data. Only export actions from those files; every export is a public endpoint. Put internal helpers in `server-only` modules.
- Pure logic (RBAC, scoring, timers, recommendations) lives in `src/lib/` and is covered by `npm test`.
- Record important changes with `audit()` and notify affected users with `notify()`.
- Schema changes: edit `src/db/schema.ts`, then `npm run db:generate` and commit the new SQL in `drizzle/`.
- Datetime-local inputs are IST. Use `parseLocalInput` / `toLocalInput` from `src/lib/datetime.ts`.
