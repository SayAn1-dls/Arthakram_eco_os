import Link from "next/link";
import { getCurrentUser } from "@/server/auth";
import { Wordmark } from "./logo";
import { LinkButton } from "./ui";
import { MobileNav } from "./mobile-nav";

export const PUBLIC_NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/events", label: "Events" },
  { href: "/competitions", label: "Competitions" },
  { href: "/clubs", label: "Clubs" },
  { href: "/mentors", label: "Mentors" },
  { href: "/organizations", label: "Organizations" },
  { href: "/learn", label: "Learn" },
];

export async function PublicHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Wordmark size="sm" priority />
        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {PUBLIC_NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-2.5 py-1.5 text-[13.5px] font-medium text-ink-2 hover:bg-paper-2 hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <LinkButton href="/app" size="sm">
              Open dashboard
            </LinkButton>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                Sign in
              </LinkButton>
              <LinkButton href="/signup" size="sm">
                Get started
              </LinkButton>
            </>
          )}
          <MobileNav items={[{ href: "/", label: "Home" }, ...PUBLIC_NAV]} />
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark size="md" withClubLine />
          <p className="mt-4 max-w-xs text-sm text-muted">
            Helping students discover where they belong — and helping organizations run the ecosystem around them.
          </p>
          <p className="mt-4 text-sm font-semibold text-ink-2">arthakram@rishihood.edu.in</p>
        </div>
        {[
          ["Students", [["Find my club", "/app/find-my-club"], ["Opportunities", "/opportunities"], ["Mentors", "/mentors"], ["Learn", "/learn"]]],
          ["Organizers", [["Events", "/events"], ["Competitions", "/competitions"], ["Archive", "/archive"], ["Organizations", "/organizations"]]],
          ["Arthakram", [["Clubs", "/clubs"], ["Sign in", "/login"], ["Create account", "/signup"]]],
        ].map(([title, links]) => (
          <div key={title as string}>
            <div className="eyebrow mb-3">{title as string}</div>
            <ul className="space-y-2 text-sm">
              {(links as string[][]).map(([l, h]) => (
                <li key={h}>
                  <Link href={h!} className="text-ink-2 hover:text-brand-deep">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-muted">
        Founders Day 2026 · Arthakram for the 1%
      </div>
    </footer>
  );
}
