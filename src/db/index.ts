import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __arthakramDb?: DB };

export function databasePath() {
  return path.resolve(process.env.DATABASE_PATH ?? "./storage/arthakram.db");
}

function open(): DB {
  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

export const db: DB = globalForDb.__arthakramDb ?? (globalForDb.__arthakramDb = open());
export { schema };
