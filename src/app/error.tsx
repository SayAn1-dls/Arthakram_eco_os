"use client";

import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="eyebrow text-brand-deep">Something went wrong</div>
      <h1 className="mt-2 text-2xl font-bold">We couldn’t load this page.</h1>
      <p className="mt-2 max-w-md text-sm text-muted">{error.digest ? `Reference: ${error.digest}` : "Please try again."}</p>
      <Button onClick={reset} className="mt-6">Try again</Button>
    </div>
  );
}
