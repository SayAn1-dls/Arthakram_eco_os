import "server-only";
import { cache } from "react";
import { and, desc, eq, gt, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  awards,
  clubAssessments,
  clubMembers,
  clubs,
  eventRounds,
  events,
  evaluations,
  mentorProfiles,
  mentorRequests,
  mentorReviews,
  opportunities,
  participants,
  savedOpportunities,
  studentProfiles,
  submissions,
  teams,
  users,
} from "@/db/schema";
import {
  CATEGORY_DIMENSIONS,
  DIMENSIONS,
  matchOpportunity,
  nextSteps,
  type Dimension,
  type StudentSignals,
} from "@/lib/recommend";

const TYPE_TO_CATEGORY: Record<string, string> = {
  hackathon: "hackathon",
  product_competition: "product_competition",
  consulting_case: "consulting_competition",
  business_competition: "business_challenge",
  coding_competition: "coding_competition",
  ai_competition: "ai_competition",
  design_competition: "design_competition",
  mun: "mun",
  debate: "debate",
  startup_competition: "startup_challenge",
  marketing_competition: "marketing_competition",
};

/** Memoised per request. */
export const latestAssessment = cache((userId: string) => {
  return db.select().from(clubAssessments).where(eq(clubAssessments.userId, userId)).orderBy(desc(clubAssessments.createdAt)).get() ?? null;
});

/** Memoised per request. */
export const profileOf = cache((userId: string) => {
  return db.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).get() ?? null;
});

/** Memoised per request. */
export const myClubs = cache((userId: string) => {
  return db
    .select({ club: clubs, role: clubMembers.role, status: clubMembers.status })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubs.id, clubMembers.clubId))
    .where(eq(clubMembers.userId, userId))
    .all();
});

/** Memoised per request. */
export const participationHistory = cache((userId: string) => {
  return db
    .select({ p: participants, e: events, team: teams })
    .from(participants)
    .innerJoin(events, eq(events.id, participants.eventId))
    .leftJoin(teams, eq(teams.id, participants.teamId))
    .where(and(eq(participants.userId, userId), ne(participants.status, "withdrawn")))
    .orderBy(desc(events.startsAt))
    .all();
});

/** Memoised per request. */
export const signalsFor = cache((userId: string): StudentSignals => {
  const profile = profileOf(userId);
  const a = latestAssessment(userId);
  const history = participationHistory(userId);
  const clubsJoined = myClubs(userId).filter((c) => c.status === "active");
  return {
    interests: profile?.interests ?? [],
    skills: profile?.skills ?? [],
    careerGoals: profile?.careerGoals ?? [],
    dimensions: a?.dimensionScores ?? {},
    pastCategories: [...new Set(history.map((h) => TYPE_TO_CATEGORY[h.e.type]).filter((x): x is string => !!x))],
    clubCategories: [...new Set(clubsJoined.flatMap((c) => [c.club.category, ...Object.keys(c.club.traits)]))],
  };
});

const allRecommendations = cache((userId: string) => {
  const s = signalsFor(userId);
  const saved = new Set(db.select({ id: savedOpportunities.opportunityId }).from(savedOpportunities).where(eq(savedOpportunities.userId, userId)).all().map((r) => r.id));
  const registered = new Set(db.select({ e: participants.eventId }).from(participants).where(eq(participants.userId, userId)).all().map((r) => r.e));
  const eventSlug = new Map(db.select({ id: events.id, slug: events.slug }).from(events).all().map((e) => [e.id, e.slug]));
  return db
    .select()
    .from(opportunities)
    .where(eq(opportunities.status, "active"))
    .all()
    .filter((o) => !o.eventId || !registered.has(o.eventId))
    .map((o) => {
      const m = matchOpportunity(s, { id: o.id, title: o.title, category: o.category, tags: o.tags, deadline: o.deadline });
      return { o, ...m, saved: saved.has(o.id), href: o.eventId ? `/events/${eventSlug.get(o.eventId)}` : o.sourceUrl };
    })
    .filter((x) => !x.o.deadline || x.o.deadline.getTime() > Date.now())
    .sort((a, b) => b.score - a.score);
});

export function recommendedOpportunities(userId: string, limit = 50) {
  return allRecommendations(userId).slice(0, limit);
}

/** Memoised per request. */
export const clubMatches = cache((userId: string) => {
  const a = latestAssessment(userId);
  if (!a) return null;
  const byId = new Map(db.select().from(clubs).all().map((c) => [c.id, c]));
  return {
    assessment: a,
    matches: a.results.map((r) => ({ ...r, club: byId.get(r.clubId) })).filter((r) => r.club),
  };
});

/** Memoised per request. */
export const suggestedMentor = cache((userId: string) => {
  const s = signalsFor(userId);
  const want = new Set([...s.interests, ...s.skills, ...Object.entries(s.dimensions).filter(([, v]) => v >= 0.6).map(([d]) => d)]);
  const rows = db
    .select({ userId: mentorProfiles.userId, name: users.name, expertise: mentorProfiles.expertise, skills: mentorProfiles.skills, categories: mentorProfiles.categories, headline: mentorProfiles.headline })
    .from(mentorProfiles)
    .innerJoin(users, eq(users.id, mentorProfiles.userId))
    .where(eq(mentorProfiles.status, "approved"))
    .all();
  const scored = rows
    .map((m) => {
      const hits = [...m.skills, ...m.categories].filter((x) => want.has(x.toLowerCase()));
      return { m, hits, score: hits.length };
    })
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;
  return { id: best.m.userId, name: best.m.name, area: best.hits[0] ?? best.m.categories[0] ?? "career", headline: best.m.headline, hits: best.hits };
});

export function mentorMatches(userId: string) {
  const s = signalsFor(userId);
  const want = new Set([...s.interests, ...s.skills, ...Object.entries(s.dimensions).filter(([, v]) => v >= 0.55).map(([d]) => d)].map((x) => x.toLowerCase()));
  return (mentorId: { skills: string[]; categories: string[] }) => {
    const hits = [...mentorId.skills, ...mentorId.categories].filter((x) => want.has(x.toLowerCase()));
    return { score: Math.min(98, 45 + hits.length * 15), hits: [...new Set(hits)] };
  };
}

/** Memoised per request. */
export const whatNext = cache((userId: string) => {
  const profile = profileOf(userId);
  const a = clubMatches(userId);
  const active = myClubs(userId).filter((c) => c.status === "active");
  const history = participationHistory(userId);
  const opp = recommendedOpportunities(userId, 1)[0];
  const reviews = db.select({ id: mentorReviews.id }).from(mentorReviews).where(eq(mentorReviews.studentId, userId)).all().length;
  const pending = !!db.select({ id: mentorRequests.id }).from(mentorRequests).where(and(eq(mentorRequests.studentId, userId), inArray(mentorRequests.status, ["pending", "accepted"]))).get();
  const top = a?.matches.find((m) => !active.some((c) => c.club.id === m.clubId));

  // Upcoming deadline: an active round of a live event the student's team still needs to submit for.
  let deadline: { title: string; href: string; when: Date } | null = null;
  for (const h of history) {
    if (h.e.status !== "live" || !h.team) continue;
    const r = db.select().from(eventRounds).where(and(eq(eventRounds.eventId, h.e.id), eq(eventRounds.status, "active"))).get();
    if (!r) continue;
    const s = db.select().from(submissions).where(and(eq(submissions.roundId, r.id), eq(submissions.teamId, h.team.id))).get();
    if (!s || s.status === "draft" || s.status === "not_started") deadline = { title: `${r.name} submission`, href: `/app/team/${h.team.id}`, when: r.submissionDeadline ?? h.e.endsAt };
  }

  // Weakest dimension among the traits their top club values.
  let weakest: string | null = null;
  const best = a?.matches[0]?.club;
  if (a && best) {
    const dims = Object.entries(best.traits)
      .filter(([, w]) => (w ?? 0) >= 0.4)
      .map(([d]) => d as Dimension)
      .filter((d) => d in DIMENSIONS)
      .sort((x, y) => (a.assessment.dimensionScores[x] ?? 0) - (a.assessment.dimensionScores[y] ?? 0));
    if (dims[0] && (a.assessment.dimensionScores[dims[0]] ?? 0) < 0.5) weakest = DIMENSIONS[dims[0]];
  }
  const mentor = suggestedMentor(userId);
  return nextSteps({
    hasProfile: !!profile && (profile.interests.length > 0 || profile.skills.length > 0),
    hasAssessment: !!a,
    topClub: top?.club ? { name: top.club.name, slug: top.club.slug, score: top.score } : null,
    activeClubCount: active.length,
    participationCount: history.length,
    topOpportunity: opp ? { id: opp.o.id, title: opp.o.title, score: opp.score } : null,
    mentorReviewCount: reviews,
    pendingMentorRequest: pending,
    suggestedMentor: mentor ? { id: mentor.id, name: mentor.name, area: mentor.area } : null,
    exploreClub: top?.club && active.length > 0 ? { name: top.club.name, slug: top.club.slug, score: top.score } : null,
    weakestDimension: weakest,
    upcomingDeadline: deadline,
  });
});

/** Evidence-based record of what the student has actually done. */
/** Memoised per request. */
export const passport = cache((userId: string) => {
  const history = participationHistory(userId);
  const myAwards = db.select({ a: awards, e: events }).from(awards).innerJoin(events, eq(events.id, awards.eventId)).where(eq(awards.userId, userId)).orderBy(desc(awards.createdAt)).all();
  const reviews = db.select({ r: mentorReviews, mentor: users.name }).from(mentorReviews).innerJoin(users, eq(users.id, mentorReviews.mentorId)).where(eq(mentorReviews.studentId, userId)).orderBy(desc(mentorReviews.createdAt)).all();
  const clubsJoined = myClubs(userId).filter((c) => c.status === "active");
  const teamIds = history.map((h) => h.team?.id).filter((x): x is string => !!x);
  const subs = teamIds.length
    ? db.select({ s: submissions, e: events, round: eventRounds.name }).from(submissions).innerJoin(events, eq(events.id, submissions.eventId)).innerJoin(eventRounds, eq(eventRounds.id, submissions.roundId)).where(and(inArray(submissions.teamId, teamIds), isNotNull(submissions.submittedAt))).all()
    : [];
  // Average judge score per published event (only once results are public).
  const scored = teamIds.length
    ? db
        .select({ teamId: evaluations.teamId, eventId: evaluations.eventId, total: evaluations.totalScore })
        .from(evaluations)
        .innerJoin(events, eq(events.id, evaluations.eventId))
        .where(and(inArray(evaluations.teamId, teamIds), eq(evaluations.status, "submitted"), eq(events.resultsPublished, true)))
        .all()
    : [];

  // Skills evidence: map each activity to dimensions.
  const evidence = new Map<string, { competitions: number; projects: number; reviews: number; awards: number; clubs: number }>();
  const bump = (dim: string, k: "competitions" | "projects" | "reviews" | "awards" | "clubs") => {
    const e = evidence.get(dim) ?? { competitions: 0, projects: 0, reviews: 0, awards: 0, clubs: 0 };
    e[k]++;
    evidence.set(dim, e);
  };
  for (const h of history) for (const d of CATEGORY_DIMENSIONS[TYPE_TO_CATEGORY[h.e.type] ?? "other"] ?? []) bump(d, "competitions");
  for (const s of subs) for (const d of (CATEGORY_DIMENSIONS[TYPE_TO_CATEGORY[s.e.type] ?? "other"] ?? []).slice(0, 1)) bump(d, "projects");
  const REVIEW_DIMS: Record<string, Dimension[]> = { product_case: ["product"], consulting_case: ["strategy"], project: ["coding"], competition: ["strategy"], startup_idea: ["entrepreneurship"], portfolio: ["design"], presentation: ["communication"] };
  for (const r of reviews) for (const d of REVIEW_DIMS[r.r.workType] ?? []) bump(d, "reviews");
  for (const a of myAwards) for (const d of (CATEGORY_DIMENSIONS[TYPE_TO_CATEGORY[a.e.type] ?? "other"] ?? []).slice(0, 1)) bump(d, "awards");
  for (const c of clubsJoined) for (const [d, w] of Object.entries(c.club.traits)) if ((w ?? 0) >= 0.8) bump(d, "clubs");

  const skills = [...evidence.entries()]
    .map(([dim, e]) => ({ dim, label: DIMENSIONS[dim as Dimension] ?? dim, ...e, weight: e.competitions + e.projects * 1.5 + e.reviews * 2 + e.awards * 3 + e.clubs }))
    .sort((a, b) => b.weight - a.weight);

  return { history, awards: myAwards, reviews, clubs: clubsJoined, submissions: subs, skills, scored };
});

/** Memoised per request. */
export const upcomingDeadlines = cache((userId: string) => {
  const regs = participationHistory(userId).filter((h) => ["published", "live"].includes(h.e.status));
  const saved = db
    .select({ o: opportunities })
    .from(savedOpportunities)
    .innerJoin(opportunities, eq(opportunities.id, savedOpportunities.opportunityId))
    .where(and(eq(savedOpportunities.userId, userId), gt(opportunities.deadline, new Date())))
    .all();
  const items: { title: string; when: Date; href: string; kind: string }[] = [];
  for (const h of regs)
    items.push({ title: h.e.title, when: h.e.status === "live" ? h.e.endsAt : h.e.startsAt, href: h.team ? `/app/team/${h.team.id}` : "/app/my-events", kind: h.e.status === "live" ? "Live · ends" : "Starts" });
  for (const s of saved) items.push({ title: s.o.title, when: s.o.deadline!, href: "/app/opportunities", kind: "Registration closes" });
  return items.sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, 6);
});
