/** Server-only helpers (uses node:crypto). */
import { randomBytes } from "node:crypto";

export function newId(prefix = "") {
  return prefix + randomBytes(9).toString("base64url");
}

export function token(bytes = 18) {
  return randomBytes(bytes).toString("base64url");
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 60);
}

export function appUrl(path = "") {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return base + path;
}

export function parseList(value: FormDataEntryValue | null | undefined): string[] {
  if (!value) return [];
  return String(value)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
