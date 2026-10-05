import Link from "next/link";
import { ASSESSMENT, DIMENSIONS, type Dimension } from "@/lib/recommend";
import { requireUser } from "@/server/auth";
import { clubMatches, myClubs } from "@/server/student";
import { requestJoinClub, submitAssessment } from "@/server/actions/student";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, DashList, LinkButton, PageHeader, Progress } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Find My Club" };

export default async function FindMyClub({ searchParams }: { searchParams: Promise<{ retake?: string; done?: string }> }) {
  const { retake, done } = await searchParams;
  const user = await requireUser();
  const result = clubMatches(user.id);
  const joined = new Map(myClubs(user.id).map((c) => [c.club.id, c.status]));

  if (!result || retake) {
    const sections = [...new Set(ASSESSMENT.map((q) => q.section))];
    return (
      <>
        <PageHeader
          eyebrow="Find My Club"
          title="Which club fits how you think?"
          description="Not a personality quiz. Your answers become scores on 12 dimensions — interests, skills, how you work, your goals — and are matched transparently against what each club actually does."
        />
        <ActionForm action={submitAssessment} className="space-y-8">
          {sections.map((sec) => (
            <Card key={sec} eyebrow={sec}>
              <div className="space-y-6">
                {ASSESSMENT.filter((q) => q.section === sec).map((q) => (
                  <fieldset key={q.id}>
                    <legend className="mb-2.5 font-semibold text-ink">{q.prompt}</legend>
                    {q.kind === "scale" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted">Not me</span>
                        {[1, 2, 3, 4, 5].map((v) => (
                          <label key={v} className="cursor-pointer">
                            <input type="radio" name={q.id} value={v} required className="peer sr-only" />
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white font-bold text-ink-2 transition-colors peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 hover:border-brand">
                              {v}
                            </span>
                          </label>
                        ))}
                        <span className="text-xs text-muted">Very me</span>
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {q.options.map((o) => (
                          <label key={o.value} className="cursor-pointer">
                            <input type="radio" name={q.id} value={o.value} required className="peer sr-only" />
                            <span className="block rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink-2 transition-colors peer-checked:border-brand peer-checked:bg-brand-wash peer-checked:font-semibold peer-checked:text-ink hover:border-brand">
                              {o.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </fieldset>
                ))}
              </div>
            </Card>
          ))}
          <div className="flex justify-end">
            <SubmitButton size="lg" pendingText="Matching…">
              See my club matches
            </SubmitButton>
          </div>
        </ActionForm>
      </>
    );
  }

  const dims = Object.entries(result.assessment.dimensionScores).sort((a, b) => b[1] - a[1]) as [Dimension, number][];
  const [top, ...rest] = result.matches;
  return (
    <>
      <PageHeader
        eyebrow="Find My Club · Results"
        title={done ? "Here’s where you fit." : "Your club matches"}
        description={`Based on your assessment from ${fmtDate(result.assessment.createdAt)}. Recommendations get sharper as you compete, build and collect mentor feedback.`}
        actions={<LinkButton href="/app/find-my-club?retake=1" variant="outline">Retake</LinkButton>}
      />
      {top && (
        <Card className="mb-6 border-brand">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <Badge tone="solid">Best match</Badge>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">{top.club!.name}</h2>
              <div className="mt-1 text-5xl font-extrabold text-brand tabular">{top.score}%</div>
              <div className="mt-4 eyebrow !text-[0.65rem]">Why</div>
              <ul className="mt-2 space-y-1 text-sm">
                {top.reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
              <div className="mt-5 flex gap-2">
                {joined.has(top.clubId) ? (
                  <Badge tone="ok">{joined.get(top.clubId) === "active" ? "You're a member" : "Request pending"}</Badge>
                ) : (
                  <ActionButton action={requestJoinClub} hidden={{ clubId: top.clubId }} variant="primary" size="md">
                    Request to join
                  </ActionButton>
                )}
                <LinkButton href={`/clubs/${top.club!.slug}`} variant="outline">
                  Club profile
                </LinkButton>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className="eyebrow mb-2 !text-[0.65rem]">What you’ll learn</div>
                <DashList items={top.club!.learnings.slice(0, 3).map((l) => ({ title: <span className="text-sm">{l}</span> }))} />
              </div>
              <div>
                <div className="eyebrow mb-2 !text-[0.65rem]">What you’ll do</div>
                <DashList items={top.club!.activities.slice(0, 3).map((l) => ({ title: <span className="text-sm">{l}</span> }))} />
              </div>
              <div>
                <div className="eyebrow mb-2 !text-[0.65rem]">Who fits</div>
                <p className="text-sm text-ink-2">{top.club!.fitProfile}</p>
              </div>
              <div>
                <div className="eyebrow mb-2 !text-[0.65rem]">Career paths</div>
                <div className="flex flex-wrap gap-1">
                  {top.club!.careerPaths.map((c) => (
                    <Badge key={c}>{c}</Badge>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="eyebrow mb-2 !text-[0.65rem]">Suggested first steps</div>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {top.club!.firstSteps.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card title="Other matches">
          <ul className="divide-y divide-line/70">
            {rest.map((m) => (
              <li key={m.clubId} className="flex flex-wrap items-center gap-4 py-3">
                <div className="w-14 text-2xl font-extrabold tabular text-ink">{m.score}%</div>
                <div className="min-w-0 flex-1">
                  <Link href={`/clubs/${m.club!.slug}`} className="font-bold text-ink hover:text-brand-deep">
                    {m.club!.name}
                  </Link>
                  <div className="text-xs text-muted">{m.reasons.join(" · ") || "Partial overlap with your profile"}</div>
                </div>
                {joined.has(m.clubId) ? <Badge tone="ok">{joined.get(m.clubId) === "active" ? "Member" : "Pending"}</Badge> : null}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Your profile" eyebrow="Dimension scores">
          <ul className="space-y-2.5">
            {dims.map(([d, v]) => (
              <li key={d}>
                <div className="flex justify-between text-xs">
                  <span className={cn(v >= 0.6 ? "font-semibold text-ink" : "text-ink-2")}>{DIMENSIONS[d]}</span>
                  <span className="tabular text-muted">{Math.round(v * 100)}</span>
                </div>
                <Progress value={v * 100} className="mt-1" />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Match = 50% how much of the club’s profile you cover + 50% how similar your overall shape is. Admins tune each club’s profile.</p>
        </Card>
      </div>
    </>
  );
}
