import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { AuthzError } from "./rbac";

export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Free-form payload for client follow-ups (e.g. a generated password). */
  data?: Record<string, string>;
};

export class UserError extends Error {}

/**
 * Wraps a server action so every failure becomes a readable ActionState instead of
 * a crash. Authorization is still the handler's job — call requirePermission first.
 */
export function act(handler: (fd: FormData) => Promise<ActionState | void>) {
  return async (_prev: ActionState | undefined, fd: FormData): Promise<ActionState> => {
    try {
      return (await handler(fd)) ?? { ok: true };
    } catch (err) {
      unstable_rethrow(err); // let redirect()/notFound() through
      if (err instanceof AuthzError || err instanceof UserError) return { ok: false, error: err.message };
      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        for (const i of err.issues) fieldErrors[i.path.join(".")] ??= i.message;
        const first = err.issues[0];
        return {
          ok: false,
          error: first ? `${first.path.join(".") || "Input"}: ${first.message}` : "Invalid input.",
          fieldErrors,
        };
      }
      console.error(err);
      return { ok: false, error: "Something went wrong. Please try again." };
    }
  };
}

/** FormData → plain object of strings (checkbox "on" kept as string). */
export function formObject(fd: FormData) {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
}
