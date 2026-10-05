"use client";

import { useActionState, useState } from "react";
import { login } from "@/server/actions/auth";
import { Field, FormMessage, Input, SubmitButton } from "@/components/forms";

const DEMO = [
  ["Super admin", "admin@arthakram.demo"],
  ["Admin", "ops@arthakram.demo"],
  ["Club lead", "lead@arthakram.demo"],
  ["Organizer", "organizer@arthakram.demo"],
  ["Judge", "judge@arthakram.demo"],
  ["Mentor", "mentor@arthakram.demo"],
  ["Volunteer", "volunteer@arthakram.demo"],
  ["Docs manager", "docs@arthakram.demo"],
  ["Student", "student@arthakram.demo"],
];

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <>
      <form action={action} className="mt-8 space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingText="Signing in…">
          Sign in
        </SubmitButton>
        <FormMessage state={state} />
      </form>
      <div className="mt-10 rounded-xl border border-line bg-card p-4">
        <div className="eyebrow mb-1 !text-[0.62rem]">Demo accounts</div>
        <p className="mb-3 text-xs text-muted">
          Password for all: <code className="rounded bg-paper-2 px-1">arthakram123</code>. Each role sees a different Arthakram.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DEMO.map(([role, mail]) => (
            <button
              key={mail}
              type="button"
              onClick={() => {
                setEmail(mail!);
                setPassword("arthakram123");
              }}
              className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink-2 hover:border-brand hover:text-brand-deep"
            >
              {role}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
