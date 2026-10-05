import Link from "next/link";
import { Check } from "lucide-react";
import { requireUser } from "@/server/auth";
import { clubMatches, myClubs, passport, profileOf, recommendedOpportunities, suggestedMentor, whatNext } from "@/server/student";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";

export const metadata = { title: "My Path" };

export default async function MyPath({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const user = await requireUser();
  const steps = whatNext(user.id);
  const profile = profileOf(user.id);
  const cm = clubMatches(user.id);
  const clubs = myClubs(user.id).filter((c) => c.status === "active");
  const pp = passport(user.id);
  const opp = recommendedOpportunities(user.id, 1)[0];
  const mentor = suggestedMentor(user.id);

  const journey: { label: string; done: boolean; detail: string; href: string }[] = [
    { label: "Student", done: !!profile && (profile.interests.length > 0 || profile.skills.length > 0), detail: profile?.interests.length ? `Interested in ${profile.interests.slice(0, 3).join(", ")}` : "Tell us your interests", href: "/app/profile" },
    { label: "Club", done: clubs.length > 0, detail: clubs[0]?.club.name ?? (cm?.matches[0] ? `Best match: ${cm.matches[0].club!.name}` : "Take Find My Club"), href: clubs[0] ? `/clubs/${clubs[0].club.slug}` : "/app/find-my-club" },
    { label: "Learning", done: false, detail: "Product Guys, Consulting & the archive", href: "/learn" },
    { label: "Competition", done: pp.history.length > 0, detail: pp.history[0]?.e.title ?? opp?.o.title ?? "Find your first competition", href: pp.history.length ? "/app/my-events" : "/app/opportunities" },
    { label: "Mentor", done: pp.reviews.length > 0, detail: pp.reviews[0] ? `Reviewed by ${pp.reviews[0].mentor}` : mentor ? `Suggested: ${mentor.name}` : "Browse mentors", href: "/app/mentorship" },
    { label: "Project", done: pp.submissions.length > 0, detail: pp.submissions[0]?.s.title ?? "Submit work in an event", href: "/app/my-events" },
    { label: "Feedback", done: pp.reviews.length > 0 || pp.scored.length > 0, detail: pp.scored.length ? "Judge scores on record" : "Judges & mentors review your work", href: "/app/passport" },
    { label: "Next opportunity", done: false, detail: opp ? `${opp.o.title} · ${opp.score}%` : "Keep exploring", href: "/app/opportunities" },
  ];
  const firstOpen = journey.findIndex((j) => !j.done);

  return (
    <>
      {welcome && (
        <div className="mb-6 rounded-xl border border-brand/30 bg-brand-wash px-5 py-4">
          <div className="font-bold text-ink">Welcome to Arthakram, {user.name.split(" ")[0]}.</div>
          <div className="text-sm text-ink-2">Start by telling us what you’re into — every recommendation builds on it.</div>
        </div>
      )}
      <PageHeader eyebrow="My Path" title="What should I do next?" description="Arthakram connects you from interest to club, learning, competition, mentor, project, feedback — and on to the next opportunity." />
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <Card key={s.title} className={i === 0 ? "border-brand" : ""}>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-white">{i + 1}</span>
              <span className="eyebrow !text-[0.6rem]">Step {i + 1}</span>
            </div>
            <h3 className="mt-3 text-lg font-bold text-ink">{s.title}</h3>
            <p className="mt-1 text-sm text-muted">{s.detail}</p>
            <LinkButton href={s.href} size="sm" className="mt-4" variant={i === 0 ? "primary" : "outline"}>
              {s.cta}
            </LinkButton>
          </Card>
        ))}
      </div>
      <Card title="Your journey" eyebrow="The Arthakram graph, for you">
        <ol className="relative grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          {journey.map((j, i) => (
            <li key={j.label}>
              <Link href={j.href} className={cn("block h-full rounded-xl border p-3 transition-colors hover:border-brand", j.done ? "border-ok/30 bg-green-50/60" : i === firstOpen ? "border-brand bg-brand-wash" : "border-line bg-white/60")}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-muted">{String(i + 1).padStart(2, "0")}</span>
                  {j.done ? <Check className="h-4 w-4 text-ok" /> : i === firstOpen ? <Badge tone="solid">Next</Badge> : null}
                </div>
                <div className="mt-2 font-bold text-ink">{j.label}</div>
                <div className="mt-1 text-xs text-muted">{j.detail}</div>
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
