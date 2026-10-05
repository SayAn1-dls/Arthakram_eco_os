import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { signup } from "@/server/actions/auth";
import { ActionForm, Field, Input, SubmitButton } from "@/components/forms";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/app");
  return (
    <>
      <div className="eyebrow mb-2 text-brand-deep">Join the ecosystem</div>
      <h1 className="text-3xl font-extrabold tracking-tight">Create your Arthakram account</h1>
      <p className="mt-2 text-sm text-muted">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-brand-deep hover:underline">
          Sign in
        </Link>
      </p>
      <ActionForm action={signup} className="mt-8 space-y-4">
        <Field label="Full name">
          <Input name="name" required autoComplete="name" />
        </Field>
        <Field label="College email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingText="Creating account…">
          Create account
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-xs text-muted">
        Every new account starts as a <b>Student</b>. Organizer, judge, mentor and admin access is granted by Arthakram admins.
      </p>
    </>
  );
}
