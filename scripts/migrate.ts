import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, databasePath } from "../src/db";

migrate(db, { migrationsFolder: "./drizzle" });
console.log(`✓ Database migrated → ${databasePath()}`);
