import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const file = path.resolve(process.env.DATABASE_PATH ?? "./storage/arthakram.db");
for (const f of [file, `${file}-wal`, `${file}-shm`]) if (fs.existsSync(f)) fs.rmSync(f);
console.log("✓ Removed database");
execSync("npx tsx scripts/migrate.ts", { stdio: "inherit" });
execSync("npx tsx scripts/seed.ts", { stdio: "inherit" });
