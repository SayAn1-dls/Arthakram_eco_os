/**
 * Next.js instrumentation hook — runs once on server startup.
 * Applies any pending Drizzle migrations so the SQLite DB is
 * always in sync, even on a cold Vercel function start.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
    const { db } = await import("./db");
    const path = await import("node:path");

    migrate(db, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  }
}
