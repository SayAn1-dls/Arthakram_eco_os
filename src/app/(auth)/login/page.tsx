import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next ?? "/app");
  return (
    <>
      <div className="eyebrow mb-2 text-brand-deep">Welcome back</div>
      <h1 className="text-3xl font-bold">Sign in to Arthakram</h1>
      <p className="mt-2 text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-brand-deep hover:underline">
          Create an account
        </Link>
      </p>
      <LoginForm next={next} />
    </>
  );
}
