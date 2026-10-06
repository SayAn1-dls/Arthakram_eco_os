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

/** Generate a URL-safe slug from any string. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Truncate a string to maxLength, appending "…" if cut. */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

/** Deep-clone a plain JSON-serialisable object. */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
