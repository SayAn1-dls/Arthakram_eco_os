/**
 * Arthakram discovery engine — transparent, rule-based scoring.
 *
 * Deliberately not a black box: every score is a weighted sum over named
 * dimensions, and every recommendation carries the reasons that produced it.
 * The inputs (assessment, profile, activity) are stored so an ML ranker can be
 * trained later without changing the data model.
 */

export const DIMENSIONS = {
  product: "Product thinking",
  strategy: "Business problem solving",
  finance: "Finance & markets",
  coding: "Coding & engineering",
  ai: "AI & data",
  design: "Design & UX",
  marketing: "Marketing & storytelling",
  communication: "Communication & speaking",
  leadership: "Leadership & organizing",
  analytical: "Analytical & research thinking",
  policy: "Policy, debate & global affairs",
  entrepreneurship: "Building ventures",
} as const;
export type Dimension = keyof typeof DIMENSIONS;
export const DIMENSION_KEYS = Object.keys(DIMENSIONS) as Dimension[];

type Weights = Partial<Record<Dimension, number>>;

export type Question =
  | { id: string; kind: "scale"; section: string; prompt: string; weights: Weights }
  | {
      id: string;
      kind: "choice";
      section: string;
      prompt: string;
      options: { value: string; label: string; weights: Weights }[];
    };

export const ASSESSMENT: Question[] = [
  { id: "q_product", kind: "scale", section: "Interests", prompt: "I enjoy figuring out why some apps feel effortless and others feel frustrating.", weights: { product: 1, design: 0.4 } },
  { id: "q_strategy", kind: "scale", section: "Interests", prompt: "Given a messy business problem, I like structuring it into a clear recommendation.", weights: { strategy: 1, analytical: 0.5 } },
  { id: "q_finance", kind: "scale", section: "Interests", prompt: "I follow markets, company results or personal investing.", weights: { finance: 1, analytical: 0.3 } },
  { id: "q_coding", kind: "scale", section: "Skills", prompt: "I like writing code and seeing something I built actually run.", weights: { coding: 1 } },
  { id: "q_ai", kind: "scale", section: "Skills", prompt: "I'm curious about how machine-learning models work and how to apply them.", weights: { ai: 1, coding: 0.4 } },
  { id: "q_design", kind: "scale", section: "Skills", prompt: "I notice layouts, typography and visual details that others miss.", weights: { design: 1 } },
  { id: "q_marketing", kind: "scale", section: "Skills", prompt: "I like crafting messages that make people care about something.", weights: { marketing: 1, communication: 0.4 } },
  { id: "q_speaking", kind: "scale", section: "How you work", prompt: "I'm comfortable speaking to a room and defending a position.", weights: { communication: 1, policy: 0.4 } },
  { id: "q_leadership", kind: "scale", section: "How you work", prompt: "I usually end up organizing the group when nobody else steps up.", weights: { leadership: 1 } },
  { id: "q_research", kind: "scale", section: "How you work", prompt: "I dig into data and research before forming an opinion.", weights: { analytical: 1, ai: 0.3 } },
  { id: "q_policy", kind: "scale", section: "Interests", prompt: "I follow politics, policy and international affairs.", weights: { policy: 1 } },
  { id: "q_venture", kind: "scale", section: "Goals", prompt: "I'd like to start my own company someday.", weights: { entrepreneurship: 1, product: 0.3 } },
  {
    id: "q_weekend",
    kind: "choice",
    section: "Preferences",
    prompt: "Which weekend sounds the most fun?",
    options: [
      { value: "hackathon", label: "A 36-hour hackathon", weights: { coding: 0.8, ai: 0.4, product: 0.3 } },
      { value: "case", label: "Cracking a case competition", weights: { strategy: 0.8, analytical: 0.4, communication: 0.3 } },
      { value: "brand", label: "Designing a brand from scratch", weights: { design: 0.8, marketing: 0.5 } },
      { value: "mun", label: "A Model UN conference", weights: { policy: 0.8, communication: 0.6 } },
      { value: "pitch", label: "Pitching a startup idea", weights: { entrepreneurship: 0.8, product: 0.4, communication: 0.3 } },
      { value: "stock", label: "Valuing a company's stock", weights: { finance: 0.9, analytical: 0.4 } },
    ],
  },
  {
    id: "q_known_for",
    kind: "choice",
    section: "Goals",
    prompt: "In three years, what do you want to be known for?",
    options: [
      { value: "ship", label: "Shipping products people use", weights: { product: 1, coding: 0.3 } },
      { value: "solve", label: "Solving hard business problems", weights: { strategy: 1, analytical: 0.3 } },
      { value: "intelligent", label: "Building intelligent systems", weights: { ai: 1, coding: 0.5 } },
      { value: "lead", label: "Leading and inspiring people", weights: { leadership: 1, communication: 0.4 } },
      { value: "craft", label: "Making things beautiful and usable", weights: { design: 1, product: 0.3 } },
      { value: "society", label: "Changing policy and society", weights: { policy: 1, communication: 0.3 } },
      { value: "money", label: "Understanding money and markets", weights: { finance: 1 } },
      { value: "grow", label: "Growing brands and audiences", weights: { marketing: 1 } },
    ],
  },
  {
    id: "q_style",
    kind: "choice",
    section: "How you work",
    prompt: "Which work style describes you best?",
    options: [
      { value: "structured", label: "Structured and analytical", weights: { analytical: 0.6, strategy: 0.4, finance: 0.3 } },
      { value: "creative", label: "Creative and exploratory", weights: { design: 0.6, marketing: 0.4 } },
      { value: "people", label: "People and persuasion", weights: { communication: 0.6, leadership: 0.5 } },
      { value: "builder", label: "Hands-on building", weights: { coding: 0.6, product: 0.4, entrepreneurship: 0.3 } },
    ],
  },
  {
    id: "q_competition",
    kind: "choice",
    section: "Preferences",
    prompt: "What kind of competition would you pick?",
    options: [
      { value: "build", label: "Team build (hackathons, product sprints)", weights: { coding: 0.4, product: 0.4 } },
      { value: "solve", label: "Problem solving (cases, analytics)", weights: { strategy: 0.4, analytical: 0.4 } },
      { value: "speak", label: "Speaking (debate, MUN, pitches)", weights: { communication: 0.5, policy: 0.3 } },
      { value: "create", label: "Creative (design, marketing)", weights: { design: 0.4, marketing: 0.4 } },
    ],
  },
  {
    id: "q_hours",
    kind: "choice",
    section: "Availability",
    prompt: "How many hours a week can you give to a club?",
    options: [
      { value: "2", label: "Under 3 hours", weights: {} },
      { value: "5", label: "3 – 6 hours", weights: {} },
      { value: "8", label: "6 – 10 hours", weights: {} },
      { value: "12", label: "More than 10 hours", weights: {} },
    ],
  },
];

export type Answers = Record<string, string | number>;

/** Turn answers into a 0..1 score per dimension (weighted average of contributions). */
export function scoreDimensions(answers: Answers): Record<Dimension, number> {
  const num: Record<string, number> = {};
  const den: Record<string, number> = {};
  for (const q of ASSESSMENT) {
    const a = answers[q.id];
    if (a == null || a === "") continue;
    if (q.kind === "scale") {
      const v = (Math.min(5, Math.max(1, Number(a))) - 1) / 4; // 1..5 → 0..1
      for (const [d, w] of Object.entries(q.weights)) {
        num[d] = (num[d] ?? 0) + v * w!;
        den[d] = (den[d] ?? 0) + w!;
      }
    } else {
      const chosen = q.options.find((o) => o.value === a);
      // A choice question adds evidence for the picked option's dimensions and
      // counter-evidence for dimensions the other options would have signalled.
      const touched = new Set(q.options.flatMap((o) => Object.keys(o.weights)));
      for (const d of touched) {
        const w = chosen?.weights[d as Dimension] ?? 0;
        const maxW = Math.max(...q.options.map((o) => o.weights[d as Dimension] ?? 0));
        num[d] = (num[d] ?? 0) + w;
        den[d] = (den[d] ?? 0) + maxW;
      }
    }
  }
  const out = {} as Record<Dimension, number>;
  for (const d of DIMENSION_KEYS) out[d] = den[d] ? +(num[d]! / den[d]!).toFixed(3) : 0;
  return out;
}

export type ClubForMatch = {
  id: string;
  name: string;
  traits: Partial<Record<string, number>>;
};

export type ClubMatch = { clubId: string; score: number; reasons: string[] };

const level = (v: number) => (v >= 0.75 ? "Strong" : v >= 0.5 ? "Clear" : "Some");

/**
 * Match = 50% coverage (how much of the club's profile you bring)
 *       + 50% cosine similarity (how closely your shape matches the club's).
 */
export function matchClubs(user: Record<string, number>, clubs: ClubForMatch[]): ClubMatch[] {
  return clubs
    .map((club) => {
      const dims = DIMENSION_KEYS.filter((d) => (club.traits[d] ?? 0) > 0);
      if (!dims.length) return { clubId: club.id, score: 0, reasons: [] };
      let cover = 0,
        need = 0,
        dot = 0,
        nu = 0,
        nt = 0;
      for (const d of DIMENSION_KEYS) {
        const u = user[d] ?? 0;
        const t = club.traits[d] ?? 0;
        cover += Math.min(u, t);
        need += t;
        dot += u * t;
        nu += u * u;
        nt += t * t;
      }
      const coverage = need ? cover / need : 0;
      const cosine = nu && nt ? dot / Math.sqrt(nu * nt) : 0;
      const score = Math.round(100 * (0.5 * coverage + 0.5 * cosine));
      const reasons = dims
        .map((d) => ({ d, c: (user[d] ?? 0) * (club.traits[d] ?? 0), u: user[d] ?? 0 }))
        .filter((x) => x.u >= 0.35)
        .sort((a, b) => b.c - a.c)
        .slice(0, 4)
        .map((x) => `${level(x.u)} ${DIMENSIONS[x.d].toLowerCase()}`);
      return { clubId: club.id, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

/* ───────────── Opportunity matching ───────────── */

export const CATEGORY_DIMENSIONS: Record<string, Dimension[]> = {
  hackathon: ["coding", "product", "ai"],
  product_competition: ["product", "strategy", "design"],
  consulting_competition: ["strategy", "analytical", "communication"],
  case_competition: ["strategy", "analytical", "finance"],
  coding_competition: ["coding", "analytical"],
  ai_competition: ["ai", "coding", "analytical"],
  startup_challenge: ["entrepreneurship", "product", "communication"],
  design_competition: ["design", "product"],
  marketing_competition: ["marketing", "communication"],
  mun: ["policy", "communication"],
  debate: ["communication", "policy"],
  business_challenge: ["strategy", "finance"],
  fellowship: ["leadership", "analytical"],
  workshop: [],
  internship: ["leadership"],
  other: [],
};

export type StudentSignals = {
  interests: string[];
  skills: string[];
  careerGoals: string[];
  dimensions: Record<string, number>; // from latest assessment, may be empty
  pastCategories: string[]; // categories/types of events they took part in
  clubCategories: string[];
};

export type OpportunityForMatch = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  deadline: Date | null;
};

const norm = (s: string) => s.toLowerCase().trim();

export function matchOpportunity(
  s: StudentSignals,
  o: OpportunityForMatch,
  now = Date.now(),
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const wanted = new Set([...s.interests, ...s.skills, ...s.careerGoals].map(norm));
  const tagHits = o.tags.filter((t) => wanted.has(norm(t)));
  let score = 40;

  if (tagHits.length) {
    score += Math.min(30, tagHits.length * 12);
    reasons.push(`Matches your interests: ${tagHits.slice(0, 3).join(", ")}`);
  }
  const dims = CATEGORY_DIMENSIONS[o.category] ?? [];
  if (dims.length && Object.keys(s.dimensions).length) {
    const fit = dims.reduce((a, d) => a + (s.dimensions[d] ?? 0), 0) / dims.length;
    score += Math.round(fit * 20);
    const top = dims.filter((d) => (s.dimensions[d] ?? 0) >= 0.6);
    if (top.length) reasons.push(`Your assessment shows strong ${DIMENSIONS[top[0]!].toLowerCase()}`);
  }
  if (s.pastCategories.map(norm).includes(norm(o.category))) {
    score += 6;
    reasons.push("You've competed in this format before — build on that experience");
  } else if (s.pastCategories.length === 0) {
    score += 2;
  }
  if (s.clubCategories.some((c) => dims.includes(c as Dimension) || norm(c) === norm(o.category))) {
    score += 4;
    reasons.push("Relevant to a club you're part of");
  }
  if (o.deadline) {
    const days = (o.deadline.getTime() - now) / 86_400_000;
    if (days < 0) score -= 40;
    else if (days <= 7) reasons.push(`Registration closes in ${Math.max(1, Math.ceil(days))} day(s)`);
  }
  if (!reasons.length) reasons.push("Popular with students at your stage");
  return { score: Math.max(0, Math.min(99, score)), reasons };
}

/* ───────────── "What should I do next?" ───────────── */

export type NextStepInput = {
  hasProfile: boolean;
  hasAssessment: boolean;
  topClub?: { name: string; slug: string; score: number } | null;
  activeClubCount: number;
  participationCount: number;
  topOpportunity?: { id: string; title: string; score: number } | null;
  mentorReviewCount: number;
  pendingMentorRequest: boolean;
  suggestedMentor?: { id: string; name: string; area: string } | null;
  weakestDimension?: string | null;
  upcomingDeadline?: { title: string; href: string; when: Date } | null;
  /** A strong-matching club the student hasn't joined yet (used once they already have a club). */
  exploreClub?: { name: string; slug: string; score: number } | null;
};

export type NextStep = { title: string; detail: string; href: string; cta: string };

export function nextSteps(i: NextStepInput): NextStep[] {
  const steps: NextStep[] = [];
  if (i.upcomingDeadline) {
    steps.push({
      title: `Finish: ${i.upcomingDeadline.title}`,
      detail: "You have a live commitment with a deadline coming up.",
      href: i.upcomingDeadline.href,
      cta: "Open",
    });
  }
  if (!i.hasProfile) {
    steps.push({
      title: "Complete your profile",
      detail: "Add your interests and skills so suggestions fit you.",
      href: "/app/profile",
      cta: "Add interests",
    });
  }
  if (!i.hasAssessment) {
    steps.push({
      title: "Take the Find My Club assessment",
      detail: "17 quick questions. You’ll see which clubs suit you and why.",
      href: "/app/find-my-club",
      cta: "Start",
    });
  } else if (i.activeClubCount === 0 && i.topClub) {
    steps.push({
      title: `Join ${i.topClub.name}`,
      detail: `Your strongest club match (${i.topClub.score}%).`,
      href: `/clubs/${i.topClub.slug}`,
      cta: "View club",
    });
  }
  if (i.topOpportunity) {
    steps.push({
      title: i.participationCount === 0 ? `Enter your first competition: ${i.topOpportunity.title}` : `Participate in ${i.topOpportunity.title}`,
      detail: `${i.topOpportunity.score}% match for your profile.`,
      href: `/app/opportunities#${i.topOpportunity.id}`,
      cta: "See why",
    });
  }
  if (i.mentorReviewCount === 0 && !i.pendingMentorRequest && i.suggestedMentor) {
    steps.push({
      title: `Meet a ${i.suggestedMentor.area} mentor`,
      detail: `${i.suggestedMentor.name} reviews work in this area.`,
      href: `/mentors/${i.suggestedMentor.id}`,
      cta: "Request review",
    });
  }
  if (i.weakestDimension) {
    steps.push({
      title: `Strengthen ${i.weakestDimension.toLowerCase()}`,
      detail: "Your best-matching club relies on this, and it’s where you scored lowest.",
      href: "/learn",
      cta: "Resources",
    });
  }
  if (i.exploreClub) {
    steps.push({
      title: `Explore ${i.exploreClub.name}`,
      detail: `${i.exploreClub.score}% match. Worth a look alongside the club you’re already in.`,
      href: `/clubs/${i.exploreClub.slug}`,
      cta: "View club",
    });
  }
  steps.push({
    title: "Study a past competition",
    detail: "Read real problem statements, rubrics and final reports from the archive.",
    href: "/archive",
    cta: "Archive",
  });
  return steps.slice(0, 3);
}
