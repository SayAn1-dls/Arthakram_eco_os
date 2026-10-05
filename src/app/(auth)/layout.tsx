import { Wordmark } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-paper-2 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Wordmark size="lg" subtitle="Ecosystem OS" />
        <div>
          <h2 className="text-5xl font-extrabold leading-[1.05] tracking-tight">
            First principles
            <br />
            <span className="highlight">to final product.</span>
          </h2>
          <p className="mt-6 max-w-md text-lg text-ink-2">
            One workspace for the college ecosystem — clubs, events, competitions, judging, documentation, mentors and opportunities.
          </p>
        </div>
        <Swoosh />
      </div>
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Wordmark />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Swoosh() {
  return (
    <svg viewBox="0 0 600 160" className="-mx-12 -mb-12 w-[calc(100%+6rem)]" aria-hidden preserveAspectRatio="none">
      <path d="M0 60 Q300 0 600 50 L600 70 Q300 20 0 82Z" fill="#fcd9c3" />
      <path d="M0 95 Q300 30 600 85 L600 105 Q300 55 0 118Z" fill="#f9a26b" />
      <path d="M0 135 Q300 70 600 120 L600 160 L0 160Z" fill="#f26a1b" />
    </svg>
  );
}
