import { Wordmark } from "@/components/logo";
import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <Wordmark size="md" />
      <div className="eyebrow mt-10 text-brand-deep">404</div>
      <h1 className="mt-2 text-3xl font-bold">This page doesn’t exist — or isn’t yours to see.</h1>
      <p className="mt-2 text-muted">Private events and documents are hidden from people without access.</p>
      <LinkButton href="/" className="mt-6">Back home</LinkButton>
    </div>
  );
}
