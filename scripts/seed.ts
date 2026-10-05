/**
 * Demo data so the ecosystem feels alive. Dates are relative to "now" so the
 * Product Hackathon is always live when you run `npm run db:reset`.
 *
 * Every demo account uses the password:  arthakram123
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import * as s from "../src/db/schema";
import { ALL_PERMISSIONS, SYSTEM_ROLES } from "../src/lib/permissions";
import { matchClubs, scoreDimensions } from "../src/lib/recommend";
import { rankTeams, weightedScore } from "../src/lib/scoring";
import { hashPassword } from "../src/server/password";
import { newId, token } from "../src/lib/utils";

const PASSWORD = "arthakram123";
const NOW = Date.now();
const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;
const at = (offset: number) => new Date(NOW + offset);

// deterministic randomness
let seed = 20261005;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
const between = (a: number, b: number) => a + Math.round(rand() * (b - a));

async function main() {
  if (db.select().from(s.users).limit(1).all().length) {
    console.log("Database already has data — run `npm run db:reset` for a fresh demo.");
    return;
  }
  const pw = await hashPassword(PASSWORD);

  /* ───────── Roles ───────── */
  const roleId: Record<string, string> = {};
  for (const r of SYSTEM_ROLES) {
    const id = newId("role_");
    roleId[r.key] = id;
    db.insert(s.roles).values({ id, key: r.key, name: r.name, description: r.description, color: r.color, isSystem: true }).run();
    if (r.permissions.length)
      db.insert(s.rolePermissions).values(r.permissions.map((permission) => ({ roleId: id, permission }))).run();
  }
  const customRole = (key: string, name: string, description: string, color: string, perms: string[]) => {
    const id = newId("role_");
    roleId[key] = id;
    db.insert(s.roles).values({ id, key, name, description, color, isSystem: false }).run();
    db.insert(s.rolePermissions).values(perms.map((permission) => ({ roleId: id, permission }))).run();
  };
  customRole("documentation_manager", "Documentation Manager", "Owns an event's documentation workspace.", "#0E7490", [
    "events.view",
    "documents.view",
    "documents.create",
    "documents.edit",
    "documents.publish",
  ]);
  customRole("event_viewer", "Event Viewer", "Read-only access to an event workspace.", "#57534E", [
    "events.view",
    "participants.view",
    "teams.view",
    "documents.view",
    "submissions.view",
    "rubrics.view",
  ]);
  if (ALL_PERMISSIONS.length < 40) throw new Error("permission catalog unexpectedly small");

  /* ───────── Users ───────── */
  const userIds: Record<string, string> = {};
  const mkUser = (key: string, name: string, email: string, headline?: string) => {
    const id = newId("u_");
    userIds[key] = id;
    db.insert(s.users).values({ id, name, email, passwordHash: pw, headline: headline ?? null, createdAt: at(-between(20, 200) * D) }).run();
    return id;
  };
  mkUser("superadmin", "Aarav Mehta", "admin@arthakram.demo", "Platform owner");
  mkUser("admin", "Ishita Rao", "ops@arthakram.demo", "Platform operations");
  mkUser("lead", "Kabir Malhotra", "lead@arthakram.demo", "Lead, Arthakram Product & Consulting Club");
  mkUser("organizer", "Rahul Verma", "organizer@arthakram.demo", "Event organizer");
  mkUser("docs", "Meera Iyer", "docs@arthakram.demo", "Documentation manager");
  mkUser("volunteer", "Dev Patel", "volunteer@arthakram.demo", "Volunteer");
  const judges = [
    mkUser("judge1", "Ankit Sharma", "judge@arthakram.demo", "Senior PM, fintech"),
    mkUser("judge2", "Priya Nair", "judge2@arthakram.demo", "Engineering manager"),
    mkUser("judge3", "Vikram Sethi", "judge3@arthakram.demo", "Strategy consultant"),
    mkUser("judge4", "Neha Kapoor", "judge4@arthakram.demo", "Founder, B2B SaaS"),
  ];
  const mentors = [
    mkUser("mentor1", "Rohan Gupta", "mentor@arthakram.demo", "Product leader · 9 yrs"),
    mkUser("mentor2", "Sana Qureshi", "mentor2@arthakram.demo", "Management consultant"),
    mkUser("mentor3", "Arjun Bhat", "mentor3@arthakram.demo", "ML engineer"),
    mkUser("mentor4", "Tara Menon", "mentor4@arthakram.demo", "Brand & design lead"),
  ];
  const ananya = mkUser("student", "Ananya Singh", "student@arthakram.demo", "2nd year · Product & strategy");
  mkUser("nfLead", "Kriti Joshi", "northfield@arthakram.demo", "Lead, Northfield Coders");

  const first = ["Aditya", "Riya", "Kunal", "Sneha", "Harsh", "Pooja", "Yash", "Diya", "Rohit", "Isha", "Manav", "Tanvi", "Siddharth", "Aisha", "Varun", "Nisha", "Karan", "Simran", "Arnav", "Mehak", "Parth", "Kavya", "Dhruv", "Anjali", "Rehan", "Shruti", "Nikhil", "Zoya", "Pranav", "Saanvi", "Ishaan", "Avni", "Abhinav", "Jhanvi", "Aman", "Ritika", "Samar", "Pallavi", "Tushar", "Gauri", "Vivaan", "Lavanya"];
  const last = ["Sharma", "Reddy", "Gupta", "Khan", "Iyer", "Das", "Bose", "Jain", "Mishra", "Pillai", "Chopra", "Saxena", "Kulkarni", "Banerjee", "Rathore", "Ahuja"];
  const students: string[] = [ananya];
  first.forEach((f, i) => {
    const name = `${f} ${last[i % last.length]}`;
    students.push(mkUser(`s${i}`, name, `${f.toLowerCase()}.${last[i % last.length]!.toLowerCase()}@student.demo`));
  });

  /* ───────── Organizations, colleges, clubs ───────── */
  const orgArth = newId("org_");
  const orgRU = newId("org_");
  const orgNF = newId("org_");
  db.insert(s.organizations).values([
    { id: orgArth, slug: "arthakram", name: "Arthakram Network", kind: "network", description: "The ecosystem layer connecting students, clubs and opportunities across colleges.", contactEmail: "arthakram@rishihood.edu.in", color: "#F26A1B" },
    { id: orgRU, slug: "rishihood-university", name: "Rishihood University", kind: "university", description: "A university for changemakers — home of the Arthakram Product & Consulting Club.", website: "https://rishihood.edu.in", color: "#C2410C" },
    { id: orgNF, slug: "northfield", name: "Northfield Tech Collective", kind: "community", description: "Demo partner organization — shows how event data stays isolated between organizations.", color: "#2563EB" },
  ]).run();
  const colRU = newId("col_");
  const colNF = newId("col_");
  db.insert(s.colleges).values([
    { id: colRU, organizationId: orgRU, slug: "rishihood", name: "Rishihood University", city: "Sonipat, Haryana", description: "Main campus." },
    { id: colNF, organizationId: orgNF, slug: "northfield-institute", name: "Northfield Institute of Technology (demo)", city: "Pune", description: "Fictional demo college." },
  ]).run();

  const clubIds: Record<string, string> = {};
  const mkClub = (key: string, v: Omit<typeof s.clubs.$inferInsert, "id" | "organizationId"> & { organizationId?: string }) => {
    const id = newId("club_");
    clubIds[key] = id;
    db.insert(s.clubs).values({ id, organizationId: orgRU, collegeId: colRU, ...v }).run();
    return id;
  };
  mkClub("arthakram", {
    slug: "arthakram",
    name: "Arthakram — Product & Consulting Club",
    category: "product",
    tagline: "First principles to final product.",
    description: "We study products, break them down, build strategies, and win competitions with them. Arthakram for the 1%.",
    color: "#F26A1B",
    contactEmail: "arthakram@rishihood.edu.in",
    fitProfile: "Curious about why products win, comfortable with ambiguity, enjoys turning messy problems into crisp recommendations.",
    learnings: ["Product teardown & product sense", "Structured problem solving (cases)", "Market sizing & prioritisation", "Writing PRDs and strategy decks"],
    activities: ["Weekly product breakdowns", "Live consulting mandates with real clients", "Case & product competition squads", "First-principles thinking sessions"],
    careerPaths: ["Product Manager", "Management Consultant", "Strategy & Ops", "Founder"],
    firstSteps: ["Attend a Thursday product breakdown", "Join a case squad for the next competition", "Read the Product Guys starter track"],
    traits: { product: 1, strategy: 0.9, analytical: 0.6, communication: 0.5, design: 0.3, entrepreneurship: 0.4 },
  });
  mkClub("dev", {
    slug: "devclub", name: "DevClub", category: "coding", tagline: "Ship code that people use.", color: "#2563EB",
    description: "Builders who learn by shipping — web, mobile, systems and open source.",
    fitProfile: "Likes building, debugging and learning tools fast.",
    learnings: ["Full-stack development", "Git & open source", "System design basics"],
    activities: ["Build nights", "Hackathon teams", "Open-source sprints"],
    careerPaths: ["Software Engineer", "Founding Engineer", "DevRel"],
    firstSteps: ["Join a build night", "Pick a good-first-issue", "Team up for a hackathon"],
    traits: { coding: 1, ai: 0.4, product: 0.3, analytical: 0.4 },
  });
  mkClub("ai", {
    slug: "ai-society", name: "AI Society", category: "ai", tagline: "Understand models. Build with them.", color: "#7C3AED",
    description: "Reading groups, applied ML projects and AI competitions.",
    fitProfile: "Mathematically curious, enjoys experiments and data.",
    learnings: ["ML fundamentals", "LLM application design", "Evaluation & data work"],
    activities: ["Paper reading circles", "Kaggle squads", "LLM build sprints"],
    careerPaths: ["ML Engineer", "Data Scientist", "AI Product Manager"],
    firstSteps: ["Attend a reading circle", "Join the AI Hackathon"],
    traits: { ai: 1, coding: 0.7, analytical: 0.8 },
  });
  mkClub("finance", {
    slug: "finance-club", name: "Finance & Investment Club", category: "finance", tagline: "Think in cash flows.", color: "#15803D",
    description: "Markets, valuation, and investing — with a student-run mock portfolio.",
    fitProfile: "Numbers-driven, follows markets, patient with detail.",
    learnings: ["Valuation", "Financial statements", "Equity research"],
    activities: ["Stock pitches", "Mock portfolio", "Finance case competitions"],
    careerPaths: ["Investment Banking", "Equity Research", "VC Analyst"],
    firstSteps: ["Pitch a stock at the weekly meet"],
    traits: { finance: 1, analytical: 0.8, strategy: 0.4 },
  });
  mkClub("design", {
    slug: "design-guild", name: "Design Guild", category: "design", tagline: "Make it usable. Make it beautiful.", color: "#BE123C",
    description: "UI/UX, visual design and design critique.",
    fitProfile: "Detail-oriented, visual, empathetic toward users.",
    learnings: ["UX research", "Interface design in Figma", "Design critique"],
    activities: ["Redesign challenges", "Crit nights", "Design competitions"],
    careerPaths: ["Product Designer", "UX Researcher", "Brand Designer"],
    firstSteps: ["Submit to the monthly redesign challenge"],
    traits: { design: 1, product: 0.5, marketing: 0.3 },
  });
  mkClub("marketing", {
    slug: "marketing-collective", name: "Marketing Collective", category: "marketing", tagline: "Stories that move people.", color: "#B45309",
    description: "Brand, growth and content for campus and real clients.",
    fitProfile: "Creative communicator, curious about people and attention.",
    learnings: ["Brand strategy", "Growth experiments", "Content craft"],
    activities: ["Campus campaigns", "Brand sprints", "Marketing case competitions"],
    careerPaths: ["Brand Manager", "Growth Marketer", "Content Strategist"],
    firstSteps: ["Join the next campaign sprint"],
    traits: { marketing: 1, communication: 0.7, design: 0.3, strategy: 0.3 },
  });
  mkClub("debate", {
    slug: "debate-mun", name: "Debate & MUN Society", category: "policy", tagline: "Argue well. Listen better.", color: "#0F766E",
    description: "Parliamentary debate, Model UN and public policy discussions.",
    fitProfile: "Enjoys argument, reads widely, comfortable on stage.",
    learnings: ["Argumentation", "Public speaking", "Policy research"],
    activities: ["Weekly debates", "MUN delegations", "Policy roundtables"],
    careerPaths: ["Policy Analyst", "Law", "Public Affairs"],
    firstSteps: ["Attend an open house debate"],
    traits: { policy: 1, communication: 0.9, analytical: 0.4, leadership: 0.3 },
  });
  mkClub("ecell", {
    slug: "e-cell", name: "E-Cell", category: "entrepreneurship", tagline: "From idea to company.", color: "#9333EA",
    description: "Entrepreneurship cell — founder talks, pitch nights and incubation support.",
    fitProfile: "Restless builder with ideas; likes ownership and risk.",
    learnings: ["Customer discovery", "Pitching", "Fundraising basics"],
    activities: ["Pitch nights", "Founder fireside chats", "Startup challenges"],
    careerPaths: ["Founder", "Venture Capital", "Early-stage operator"],
    firstSteps: ["Pitch at the next open mic"],
    traits: { entrepreneurship: 1, product: 0.5, leadership: 0.6, communication: 0.5 },
  });
  const nfClub = newId("club_");
  db.insert(s.clubs).values({
    id: nfClub, slug: "northfield-coders", name: "Northfield Coders", organizationId: orgNF, collegeId: colNF, category: "coding",
    tagline: "Demo club at a partner org.", color: "#2563EB", traits: { coding: 1 }, description: "Fictional partner club.",
  }).run();

  // memberships
  db.insert(s.clubMembers).values([
    { clubId: clubIds.arthakram!, userId: userIds.lead!, role: "lead", status: "active" },
    { clubId: clubIds.arthakram!, userId: ananya, role: "member", status: "active" },
    ...students.slice(1, 9).map((u) => ({ clubId: clubIds.arthakram!, userId: u, role: "member" as const, status: "active" as const })),
    ...students.slice(9, 18).map((u) => ({ clubId: clubIds.dev!, userId: u, role: "member" as const, status: "active" as const })),
    ...students.slice(18, 24).map((u) => ({ clubId: clubIds.ai!, userId: u, role: "member" as const, status: "active" as const })),
    ...students.slice(24, 28).map((u) => ({ clubId: clubIds.debate!, userId: u, role: "member" as const, status: "active" as const })),
    { clubId: clubIds.design!, userId: students[30]!, role: "member", status: "pending" },
    { clubId: nfClub, userId: userIds.nfLead!, role: "lead", status: "active" },
  ]).run();

  /* ───────── Role assignments ───────── */
  const grant = (user: string, role: string, scopeType: s.ScopeType, scopeId: string | null, by = userIds.superadmin!) =>
    db.insert(s.roleAssignments).values({ id: newId("ra_"), userId: user, roleId: roleId[role]!, scopeType, scopeId, grantedById: by }).run();
  grant(userIds.superadmin!, "super_admin", "platform", null);
  grant(userIds.admin!, "admin", "platform", null);
  grant(userIds.lead!, "club_lead", "club", clubIds.arthakram!);
  grant(userIds.nfLead!, "club_lead", "club", nfClub);
  for (const m of mentors) grant(m, "mentor", "platform", null, userIds.admin!);
  for (const u of students) grant(u, "student", "platform", null, userIds.admin!);

  /* ───────── Mentor profiles ───────── */
  db.insert(s.mentorProfiles).values([
    { userId: mentors[0]!, headline: "Product leader · ex-consumer apps", industry: "Consumer tech", experienceYears: 9, expertise: ["Product strategy", "Product sense", "PM interviews"], skills: ["product", "strategy", "user research"], categories: ["product", "product_case"], availability: "2 sessions / week", bio: "I help students build product judgement through teardown reviews and mock PM interviews.", status: "approved" },
    { userId: mentors[1]!, headline: "Management consultant", industry: "Consulting", experienceYears: 6, expertise: ["Case interviews", "Problem structuring", "Slide writing"], skills: ["strategy", "consulting", "market sizing"], categories: ["consulting", "consulting_case"], availability: "Weekends", bio: "Case-prep and storyline reviews for consulting competitions.", status: "approved" },
    { userId: mentors[2]!, headline: "ML engineer · applied LLMs", industry: "AI", experienceYears: 5, expertise: ["LLM apps", "Model evaluation", "Python"], skills: ["ai", "python", "coding"], categories: ["ai", "project", "hackathon"], availability: "Weekday evenings", bio: "Reviews AI hackathon projects and ML portfolios.", status: "approved" },
    { userId: mentors[3]!, headline: "Brand & design lead", industry: "Design", experienceYears: 7, expertise: ["Brand strategy", "UI review", "Pitch decks"], skills: ["design", "marketing", "presentation"], categories: ["design", "marketing", "presentation"], availability: "1 session / week", bio: "Helps make decks and products clearer and more beautiful.", status: "pending" },
  ]).run();

  /* ───────── Student profiles & assessments ───────── */
  const interestPool = ["product", "strategy", "consulting", "ai", "coding", "design", "marketing", "finance", "policy", "startups", "data"];
  const skillPool = ["figma", "sql", "python", "excel", "public speaking", "react", "user research", "market sizing", "writing"];
  db.insert(s.studentProfiles).values({
    userId: ananya, collegeId: colRU, program: "B.Tech + Entrepreneurship", year: 2,
    bio: "I like taking apps apart to understand why they work. Aiming for product management.",
    interests: ["product", "strategy", "design", "startups"], skills: ["figma", "sql", "user research", "market sizing"],
    careerGoals: ["product manager"], weeklyHours: 8, linkedinUrl: "https://www.linkedin.com/", updatedAt: at(-3 * D),
  }).run();
  for (const u of students.slice(1)) {
    db.insert(s.studentProfiles).values({
      userId: u, collegeId: colRU, program: pick(["B.Tech CSE", "BBA", "B.Des", "B.Tech + Entrepreneurship", "BA Psychology"]), year: between(1, 4),
      interests: [pick(interestPool), pick(interestPool)].filter((v, i, a) => a.indexOf(v) === i),
      skills: [pick(skillPool), pick(skillPool)].filter((v, i, a) => a.indexOf(v) === i),
      careerGoals: [], weeklyHours: between(3, 10),
    }).run();
  }
  const allClubs = db.select().from(s.clubs).where(eq(s.clubs.organizationId, orgRU)).all();
  const ananyaAnswers = { q_product: 5, q_strategy: 5, q_finance: 2, q_coding: 3, q_ai: 3, q_design: 4, q_marketing: 3, q_speaking: 4, q_leadership: 4, q_research: 4, q_policy: 2, q_venture: 4, q_weekend: "case", q_known_for: "ship", q_style: "structured", q_competition: "solve", q_hours: "8" };
  const dims = scoreDimensions(ananyaAnswers);
  db.insert(s.clubAssessments).values({ id: newId("ca_"), userId: ananya, answers: ananyaAnswers, dimensionScores: dims, results: matchClubs(dims, allClubs), createdAt: at(-40 * D) }).run();

  /* ───────── Events ───────── */
  type EventInsert = typeof s.events.$inferInsert;
  const mkEvent = (v: Omit<EventInsert, "id">) => {
    const id = newId("ev_");
    db.insert(s.events).values({ id, createdById: userIds.lead, ...v }).run();
    return id;
  };

  const hackRules = `## Code of conduct
Be kind, be honest, credit your sources. Harassment of any kind leads to disqualification.

## Team rules
- Teams of **2–4** students. Cross-year teams are encouraged.
- All code and designs must be created during the event. Open-source libraries are allowed.
- Use of AI tools is allowed — **disclose** how you used them in your submission.

## Submissions
Each round has its own deadline shown on the event timer. Late submissions are not evaluated.

## Judging
Judges score each team on the published rubric. Scores are averaged across judges; ties are broken by the *Business Value* criterion.`;

  const ph = mkEvent({
    slug: "product-hackathon-2026", title: "Product Hackathon 2026", type: "hackathon", organizationId: orgRU, collegeId: colRU, clubId: clubIds.arthakram,
    tagline: "36 hours. One real user problem. Ship the product.",
    description: "Arthakram's flagship Founders Day hackathon. Teams pick a real problem statement from a partner organization, frame it from first principles, build a working product and pitch it to industry judges.",
    mode: "offline", venue: "Rishihood University, Academic Block", startsAt: at(-6 * H), endsAt: at(30 * H), registrationDeadline: at(-3 * D),
    teamSizeMin: 2, teamSizeMax: 4, eligibility: "All undergraduate students. Teams of 2–4.", rules: hackRules,
    prizes: "🥇 ₹50,000 · 🥈 ₹25,000 · 🥉 ₹10,000 · Best First-Year Team: mentorship with a product leader",
    sponsors: ["Product Guys", "Arthakram Consulting"], tags: ["product", "hackathon", "strategy", "design"], contactEmail: "arthakram@rishihood.edu.in",
    status: "live", visibility: "public", registrationOpen: false, allowJudgeEditAfterSubmit: false,
  });
  const aiHack = mkEvent({
    slug: "ai-hackathon-build-with-llms", title: "AI Hackathon: Build with LLMs", type: "ai_competition", organizationId: orgRU, collegeId: colRU, clubId: clubIds.ai,
    tagline: "Design, evaluate and ship an LLM-powered tool in 24 hours.",
    description: "Hosted by AI Society with DevClub. Build an assistant, agent or data tool that solves a campus problem. Evaluation-first: show how you know it works.",
    mode: "hybrid", venue: "Innovation Lab + online", startsAt: at(12 * D), endsAt: at(13 * D), registrationDeadline: at(9 * D),
    teamSizeMin: 1, teamSizeMax: 3, eligibility: "Open to all colleges. Basic Python recommended.", rules: "Teams of 1–3. Bring your own API keys; credits available for the first 20 teams.",
    prizes: "₹40,000 pool + cloud credits", tags: ["ai", "coding", "data", "hackathon"], status: "published", visibility: "public", registrationOpen: true,
  });
  const consulting = mkEvent({
    slug: "consulting-case-challenge-2026", title: "Consulting Case Challenge 2026", type: "consulting_case", organizationId: orgRU, collegeId: colRU, clubId: clubIds.arthakram,
    tagline: "Crack a live mandate from a real client.",
    description: "Teams worked on a live market-entry mandate for a D2C brand. Two rounds: written recommendation, then a partner-style presentation.",
    mode: "offline", venue: "Seminar Hall 2", startsAt: at(-62 * D), endsAt: at(-61 * D), registrationDeadline: at(-70 * D),
    teamSizeMin: 3, teamSizeMax: 4, eligibility: "Undergraduate students", rules: "Teams of 3–4. Decks capped at 12 slides.",
    prizes: "₹30,000 pool + internship interviews", tags: ["consulting", "strategy", "case"], status: "archived", visibility: "public", resultsPublished: true, resultsVerifiedAt: at(-60 * D),
  });
  const codesprint = mkEvent({
    slug: "codesprint-2026", title: "CodeSprint 2026", type: "coding_competition", organizationId: orgRU, collegeId: colRU, clubId: clubIds.dev,
    tagline: "Three hours, six problems, one leaderboard.", description: "DevClub's competitive programming contest.",
    mode: "online", venue: "Online", startsAt: at(-25 * D), endsAt: at(-25 * D + 3 * H), teamSizeMin: 1, teamSizeMax: 1,
    tags: ["coding"], status: "completed", visibility: "public", resultsPublished: true, resultsVerifiedAt: at(-24 * D),
  });
  const startup = mkEvent({
    slug: "founders-day-startup-challenge", title: "Founders Day Startup Challenge", type: "startup_competition", organizationId: orgRU, collegeId: colRU, clubId: clubIds.ecell,
    tagline: "Pitch your venture to founders and investors.", description: "E-Cell's pitch competition. Shortlisted teams get office hours with founders.",
    mode: "offline", venue: "Auditorium", startsAt: at(20 * D), endsAt: at(20 * D + 8 * H), registrationDeadline: at(14 * D),
    teamSizeMin: 1, teamSizeMax: 4, tags: ["startups", "product", "entrepreneurship"], status: "published", visibility: "public", registrationOpen: true,
  });
  mkEvent({
    slug: "rishihood-mun-2026", title: "Rishihood MUN 2026", type: "mun", organizationId: orgRU, collegeId: colRU, clubId: clubIds.debate,
    tagline: "Diplomacy, debate and draft resolutions.", description: "Draft — committees and agendas being finalised.",
    mode: "offline", venue: "Main campus", startsAt: at(45 * D), endsAt: at(46 * D), tags: ["policy", "mun", "debate"], status: "draft", visibility: "public",
  });
  const nfEvent = mkEvent({
    slug: "northfield-hack-night", title: "Northfield Hack Night", type: "hackathon", organizationId: orgNF, collegeId: colNF, clubId: nfClub,
    tagline: "Partner-org demo event.", description: "Belongs to a different organization — Arthakram organizers cannot see its workspace.",
    mode: "offline", venue: "Northfield campus", startsAt: at(8 * D), endsAt: at(8 * D + 10 * H), status: "published", visibility: "public", registrationOpen: true,
    tags: ["coding"], createdById: userIds.nfLead,
  });

  // Event-scoped access (Rahul: full access to A, view-only on B, judge on C)
  grant(userIds.organizer!, "organizer", "event", ph, userIds.lead!);
  grant(userIds.organizer!, "event_viewer", "event", aiHack, userIds.admin!);
  grant(userIds.organizer!, "judge", "event", codesprint, userIds.admin!);
  grant(userIds.docs!, "documentation_manager", "event", ph, userIds.admin!);
  grant(userIds.volunteer!, "volunteer", "event", ph, userIds.organizer!);
  for (const j of judges) grant(j, "judge", "event", ph, userIds.lead!);
  grant(judges[2]!, "judge", "event", consulting, userIds.lead!);
  grant(judges[3]!, "judge", "event", consulting, userIds.lead!);

  /* ───────── Product Hackathon: full operating data ───────── */
  const r1 = newId("rd_"), r2 = newId("rd_"), r3 = newId("rd_");
  db.insert(s.eventRounds).values([
    { id: r1, eventId: ph, name: "Round 1 · Problem Framing", description: "One-page problem framing: user, pain, insight, success metric.", order: 1, startsAt: at(-6 * H), endsAt: at(-3 * H), submissionDeadline: at(-4 * H), status: "completed" },
    { id: r2, eventId: ph, name: "Round 2 · Build Sprint", description: "Build a working prototype. Submit repo, demo link and a 3-minute video.", order: 2, startsAt: at(-3 * H + 15 * MIN), endsAt: at(1 * H + 45 * MIN), submissionDeadline: at(1 * H + 42 * MIN), status: "active" },
    { id: r3, eventId: ph, name: "Round 3 · Final Pitch", description: "Top 6 teams pitch to the jury. 5 minutes + 3 minutes Q&A.", order: 3, startsAt: at(26 * H), endsAt: at(29 * H), status: "upcoming", isFinal: true },
  ]).run();
  db.update(s.events).set({ currentRoundId: r2 }).where(eq(s.events.id, ph)).run();

  db.insert(s.scheduleItems).values([
    { id: newId("si_"), eventId: ph, title: "Check-in & breakfast", kind: "session", startsAt: at(-7 * H), endsAt: at(-6 * H), location: "Atrium" },
    { id: newId("si_"), eventId: ph, title: "Opening keynote: First principles to final product", kind: "ceremony", startsAt: at(-6 * H), endsAt: at(-5.5 * H), location: "Auditorium" },
    { id: newId("si_"), eventId: ph, title: "Round 1 submissions close", kind: "deadline", startsAt: at(-4 * H) },
    { id: newId("si_"), eventId: ph, title: "Round 1 judging", kind: "judging", startsAt: at(-4 * H), endsAt: at(-3 * H), location: "Judges' lounge" },
    { id: newId("si_"), eventId: ph, title: "Lunch", kind: "break", startsAt: at(-3 * H), endsAt: at(-2.5 * H), location: "Cafeteria" },
    { id: newId("si_"), eventId: ph, title: "Mentor office hours", kind: "session", startsAt: at(-1 * H), endsAt: at(1 * H), location: "Room B-204" },
    { id: newId("si_"), eventId: ph, title: "Round 2 submissions close", kind: "deadline", startsAt: at(1 * H + 42 * MIN) },
    { id: newId("si_"), eventId: ph, title: "Round 2 judging", kind: "judging", startsAt: at(2 * H), endsAt: at(5 * H), location: "Judges' lounge" },
    { id: newId("si_"), eventId: ph, title: "Final pitches", kind: "ceremony", startsAt: at(26 * H), endsAt: at(29 * H), location: "Auditorium" },
    { id: newId("si_"), eventId: ph, title: "Results & closing", kind: "ceremony", startsAt: at(29.5 * H), endsAt: at(30 * H), location: "Auditorium" },
  ]).run();

  const ps = [
    { code: "PS-01", title: "First-year onboarding that actually sticks", track: "EdTech", description: "New students drop out of clubs within 6 weeks. Design a product that helps them find their people and stay." },
    { code: "PS-02", title: "Reducing food waste in campus cafeterias", track: "Sustainability", description: "Cafeterias throw away ~18% of cooked food. Build a product that predicts demand or redistributes surplus." },
    { code: "PS-03", title: "Kirana stores vs quick commerce", track: "Retail", description: "Help neighbourhood stores compete with 10-minute delivery apps without becoming one." },
    { code: "PS-04", title: "Trustworthy second-hand textbooks", track: "Marketplace", description: "Students overpay for textbooks. Build a trusted peer-to-peer marketplace for one campus." },
  ].map((p) => ({ id: newId("ps_"), eventId: ph, ...p }));
  db.insert(s.problemStatements).values(ps).run();

  const roomRows = [
    { id: newId("rm_"), eventId: ph, name: "Room A-101", location: "Academic Block, Floor 1", capacity: 16 },
    { id: newId("rm_"), eventId: ph, name: "Room A-102", location: "Academic Block, Floor 1", capacity: 16 },
    { id: newId("rm_"), eventId: ph, name: "Room B-204", location: "Academic Block, Floor 2", capacity: 16, notes: "Also used for mentor office hours" },
    { id: newId("rm_"), eventId: ph, name: "Auditorium", location: "Ground floor", capacity: 300 },
  ];
  db.insert(s.rooms).values(roomRows).run();

  const teamNames = ["Pivot Point", "Null Pointers", "First Principles", "Byte Me", "The Hypothesis", "Zero to One", "Ship It", "Product Hunters", "Blue Ocean", "MVP Squad", "Sprint Zero", "North Star"];
  const teamIds: string[] = [];
  const memberMap = new Map<string, string[]>();
  let sIdx = 0;
  teamNames.forEach((name, i) => {
    const id = newId("tm_");
    teamIds.push(id);
    db.insert(s.teams).values({
      id, eventId: ph, name, code: `PH-${String(i + 1).padStart(2, "0")}`, roomId: roomRows[Math.floor(i / 4)]!.id,
      problemStatementId: ps[i % ps.length]!.id, mentorUserId: mentors[i % 3]!,
    }).run();
    const size = i === 0 ? 4 : between(3, 4);
    const members: string[] = [];
    for (let k = 0; k < size; k++) {
      const u = students[sIdx++ % students.length]!;
      members.push(u);
      db.insert(s.participants).values({
        id: newId("pt_"), eventId: ph, userId: u, teamId: id, isTeamLead: k === 0, status: "confirmed", college: "Rishihood University",
        checkinToken: token(12), checkedInAt: rand() < 0.9 ? at(-6.5 * H + between(0, 50) * MIN) : null, checkedInById: userIds.volunteer, registeredAt: at(-between(4, 15) * D),
      }).run();
    }
    memberMap.set(id, members);
  });
  // a couple of unassigned registrants
  for (const u of students.slice(sIdx, sIdx + 3)) {
    db.insert(s.participants).values({ id: newId("pt_"), eventId: ph, userId: u, status: "waitlisted", college: "Rishihood University", checkinToken: token(12) }).run();
  }

  // Rubric
  const rubricId = newId("rb_");
  db.insert(s.rubrics).values({ id: rubricId, eventId: ph, name: "Hackathon Rubric", description: "Used for Rounds 1 and 2. Scores 0–10 per criterion.", createdById: userIds.lead }).run();
  const crit = [
    { name: "Problem Understanding", weight: 20, description: "Is the user and their pain crisply defined, with evidence?", instructions: "10 = sharp insight backed by evidence. 5 = plausible but generic. 0 = no clear user." },
    { name: "Innovation", weight: 20, description: "Is the approach meaningfully different from the obvious solution?", instructions: "Reward non-obvious insights, not novelty for its own sake." },
    { name: "Technical Implementation", weight: 25, description: "Does it work? Is the build appropriate for the time available?", instructions: "Judge the demo, not the slide." },
    { name: "Business Value", weight: 20, description: "Would someone pay or switch? Is there a path to adoption?", instructions: "Look for a credible first customer and metric." },
    { name: "Presentation", weight: 15, description: "Clarity of story and demo.", instructions: "Clear > flashy." },
  ].map((c, i) => ({ id: newId("cr_"), rubricId, minScore: 0, maxScore: 10, order: i, ...c }));
  db.insert(s.rubricCriteria).values(crit).run();

  // Submissions + judge assignments + evaluations
  const evaluate = (roundId: string, teamId: string, judge: string, submit: boolean, quality: number) => {
    const scores: Record<string, number> = {};
    for (const c of crit) scores[c.id] = Math.max(2, Math.min(10, Math.round(quality + (rand() - 0.5) * 3)));
    const evId = newId("evl_");
    db.insert(s.evaluations).values({
      id: evId, eventId: ph, roundId, teamId, judgeUserId: judge, rubricId, status: submit ? "submitted" : "draft",
      totalScore: weightedScore(crit, scores), feedback: submit ? pick(["Sharp problem framing — push harder on the first customer.", "Great demo. The business case needs evidence.", "Strong insight; the build is thin but promising.", "Clear story. Consider narrowing the user segment."]) : null,
      submittedAt: submit ? at(-between(10, 200) * MIN) : null, updatedAt: at(-between(5, 200) * MIN),
    }).run();
    db.insert(s.evaluationScores).values(crit.map((c) => ({ evaluationId: evId, criterionId: c.id, score: scores[c.id]! }))).run();
  };
  teamIds.forEach((t, i) => {
    const quality = 4 + rand() * 5 + (i === 0 ? 1 : 0);
    const js = [judges[i % 4]!, judges[(i + 1) % 4]!];
    // Round 1: all submitted, all evaluated
    db.insert(s.submissions).values({ id: newId("sb_"), eventId: ph, roundId: r1, teamId: t, status: "reviewed", title: `${teamNames[i]} — problem framing`, description: "One-page framing document.", docsUrl: "https://docs.google.com/", submittedAt: at(-4.2 * H), submittedById: memberMap.get(t)![0], updatedAt: at(-4.2 * H) }).run();
    for (const j of js) {
      db.insert(s.judgeAssignments).values({ id: newId("ja_"), eventId: ph, roundId: r1, teamId: t, judgeUserId: j }).run();
      evaluate(r1, t, j, true, quality);
    }
    // Round 2: 9 of 12 submitted so far, evaluations in progress
    const submitted = i < 9;
    db.insert(s.submissions).values({
      id: newId("sb_"), eventId: ph, roundId: r2, teamId: t, status: submitted ? "submitted" : i < 11 ? "draft" : "not_started",
      title: submitted || i < 11 ? `${teamNames[i]} — prototype` : null, description: submitted ? "Working prototype with onboarding flow and analytics dashboard." : null,
      repoUrl: submitted ? "https://github.com/" : null, demoUrl: submitted ? "https://example.com/demo" : null, videoUrl: submitted ? "https://youtu.be/" : null,
      submittedAt: submitted ? at(-between(10, 90) * MIN) : null, submittedById: submitted ? memberMap.get(t)![0] : null, updatedAt: at(-between(5, 90) * MIN),
    }).run();
    for (const j of js) {
      db.insert(s.judgeAssignments).values({ id: newId("ja_"), eventId: ph, roundId: r2, teamId: t, judgeUserId: j }).run();
      if (submitted && i < 5) evaluate(r2, t, j, true, quality);
      else if (submitted && i < 7 && j === js[0]) evaluate(r2, t, j, false, quality);
    }
  });

  // Timers
  db.insert(s.timers).values([
    { id: newId("tmr_"), eventId: ph, label: "Hackathon clock", kind: "event", durationSec: 36 * 3600, status: "running", startedAt: at(-6 * H), elapsedBeforeSec: 0 },
    { id: newId("tmr_"), eventId: ph, roundId: r2, label: "Round 2 · Build Sprint", kind: "round", durationSec: 4 * 3600 + 30 * 60, status: "running", startedAt: at(-(4 * 3600 + 30 * 60 - (1 * 3600 + 42 * 60 + 31)) * 1000), elapsedBeforeSec: 0 },
    { id: newId("tmr_"), eventId: ph, label: "Dinner break", kind: "break", durationSec: 45 * 60, status: "idle", elapsedBeforeSec: 0 },
    { id: newId("tmr_"), eventId: ph, roundId: r3, label: "Final pitch slot", kind: "presentation", durationSec: 8 * 60, status: "idle", elapsedBeforeSec: 0, visibleToParticipants: false },
  ]).run();

  // QR codes
  const qr = (purpose: s.QrPurpose, label: string, scans: number, roomId?: string) =>
    ({ id: newId("qr_"), eventId: ph, token: token(9), purpose, label, scans, roomId: roomId ?? null, createdById: userIds.organizer });
  db.insert(s.qrCodes).values([
    qr("checkin", "Main gate check-in", 37),
    qr("schedule", "Schedule poster", 82),
    qr("submission", "Round 2 submission", 41),
    qr("feedback", "Feedback form", 6),
    qr("room_entry", "Room A-101 entry", 24, roomRows[0]!.id),
    qr("event_info", "Event info desk", 19),
  ]).run();

  // Announcements
  db.insert(s.announcements).values([
    { id: newId("an_"), eventId: ph, title: "Round 2 · Build Sprint has started", body: "Submit your repo, demo link and a 3-minute video before the timer hits zero. Late submissions won't be judged.", priority: "important", audience: "participants", pinned: true, createdById: userIds.organizer, createdAt: at(-3 * H + 15 * MIN) },
    { id: newId("an_"), eventId: ph, title: "Mentor office hours moved to B-204", body: "Rohan, Sana and Arjun are available until 1 hour before the deadline.", priority: "info", audience: "everyone", createdById: userIds.organizer, createdAt: at(-1 * H) },
    { id: newId("an_"), eventId: ph, title: "Judge briefing at 5 PM", body: "Round 2 calibration: everyone scores the sample submission first.", priority: "info", audience: "judges", createdById: userIds.lead, createdAt: at(-30 * MIN) },
  ]).run();

  // Documentation
  const doc = (section: s.DocSection, title: string, content: string, status: "draft" | "published" | "archived", visibility: "internal" | "participants" | "public", order = 0, eventId = ph, by = userIds.docs!) =>
    ({ id: newId("doc_"), eventId, section, title, content, status, visibility, order, createdById: by, updatedById: by, updatedAt: at(-between(1, 48) * H) });
  db.insert(s.documents).values([
    doc("overview", "Event overview", `# Product Hackathon 2026\n\n**First principles to final product.** 36 hours, 12 teams, 4 problem statements from real partner organizations.\n\n| | |\n|---|---|\n| Venue | Academic Block |\n| Teams | 12 (48 participants) |\n| Judges | 4 industry judges |\n| Mentors | 3 on-site mentors |\n\n## What makes this different\nTeams must show **evidence** for every claim: interviews, data or a working demo.`, "published", "public"),
    doc("rules", "Rules & code of conduct", hackRules, "published", "participants"),
    doc("problem_statements", "Problem statement pack", ps.map((p) => `## ${p.code} · ${p.title}\n*Track: ${p.track}*\n\n${p.description}`).join("\n\n"), "published", "participants"),
    doc("judges", "Judge briefing", "## Before you score\n1. Read the rubric — scores are weighted automatically.\n2. Score the **sample submission** first for calibration.\n3. Give one *keep* and one *change* in written feedback.\n\n> Judges cannot edit the rubric. Raise concerns with the organizer.", "published", "internal"),
    doc("resources", "Volunteer playbook", "## Check-in desk\n- Scan the participant's personal QR from their team page.\n- If the QR doesn't scan, search their name in **Participants**.\n\n## Escalation\nCall the organizer for medical or safety issues.", "draft", "internal"),
    doc("final_report", "Final report (in progress)", "_Compiled after results are published._", "draft", "internal"),
  ]).run();

  // Feedback (mid-event pulse)
  for (let i = 0; i < 6; i++)
    db.insert(s.feedback).values({ id: newId("fb_"), eventId: ph, userId: students[i + 2]!, role: "participant", rating: between(4, 5), comment: pick(["Mentors were super helpful.", "Problem statements are excellent.", "Wi-Fi in A-102 is slow.", "Love the live timer on our team page."]) }).run();

  /* ───────── Consulting Case Challenge (completed + archived) ───────── */
  const cr1 = newId("rd_"), cr2 = newId("rd_");
  db.insert(s.eventRounds).values([
    { id: cr1, eventId: consulting, name: "Round 1 · Written recommendation", order: 1, status: "completed", startsAt: at(-62 * D), endsAt: at(-62 * D + 6 * H) },
    { id: cr2, eventId: consulting, name: "Final · Partner presentation", order: 2, status: "completed", isFinal: true, startsAt: at(-61 * D), endsAt: at(-61 * D + 5 * H) },
  ]).run();
  const crub = newId("rb_");
  db.insert(s.rubrics).values({ id: crub, eventId: consulting, roundId: cr2, name: "Case Rubric", createdById: userIds.lead }).run();
  const ccrit = [
    { name: "Structure & logic", weight: 30 },
    { name: "Insight & analysis", weight: 30 },
    { name: "Recommendation quality", weight: 25 },
    { name: "Delivery", weight: 15 },
  ].map((c, i) => ({ id: newId("cr_"), rubricId: crub, minScore: 0, maxScore: 10, order: i, description: null, instructions: null, ...c }));
  db.insert(s.rubricCriteria).values(ccrit).run();
  const cTeams = ["Market Movers", "The Frameworks", "MECE Minds", "Root Cause", "Synergy"];
  const cTeamIds: string[] = [];
  const cMembers = new Map<string, string[]>();
  cTeams.forEach((name, i) => {
    const id = newId("tm_");
    cTeamIds.push(id);
    db.insert(s.teams).values({ id, eventId: consulting, name, code: `CC-${i + 1}` }).run();
    const mem = i === 1 ? [ananya, students[12]!, students[13]!] : [students[14 + i * 3]!, students[15 + i * 3]!, students[16 + i * 3]!];
    cMembers.set(id, mem);
    mem.forEach((u, k) =>
      db.insert(s.participants).values({ id: newId("pt_"), eventId: consulting, userId: u, teamId: id, isTeamLead: k === 0, status: "confirmed", checkinToken: token(12), checkedInAt: at(-62 * D) }).run(),
    );
    db.insert(s.submissions).values({ id: newId("sb_"), eventId: consulting, roundId: cr2, teamId: id, status: "final", title: `${name} — final deck`, deckUrl: "https://docs.google.com/presentation/", submittedAt: at(-61 * D) }).run();
  });
  const quality = [8.6, 8.2, 7.1, 6.5, 6.0];
  const cEvals: { teamId: string; totalScore: number; scores: Record<string, number> }[] = [];
  cTeamIds.forEach((t, i) => {
    for (const j of [judges[2]!, judges[3]!]) {
      const scores: Record<string, number> = {};
      for (const c of ccrit) scores[c.id] = Math.max(3, Math.min(10, Math.round(quality[i]! + (rand() - 0.5) * 2)));
      const total = weightedScore(ccrit, scores);
      cEvals.push({ teamId: t, totalScore: total, scores });
      const evId = newId("evl_");
      db.insert(s.judgeAssignments).values({ id: newId("ja_"), eventId: consulting, roundId: cr2, teamId: t, judgeUserId: j }).run();
      db.insert(s.evaluations).values({ id: evId, eventId: consulting, roundId: cr2, teamId: t, judgeUserId: j, rubricId: crub, status: "submitted", totalScore: total, feedback: "Clear storyline; quantify the downside scenario.", submittedAt: at(-61 * D) }).run();
      db.insert(s.evaluationScores).values(ccrit.map((c) => ({ evaluationId: evId, criterionId: c.id, score: scores[c.id]! }))).run();
    }
  });
  const ranked = rankTeams(cEvals);
  const placeTitle = ["Winner", "1st Runner-up", "2nd Runner-up"];
  for (const r of ranked.filter((x) => x.rank <= 3)) {
    for (const u of cMembers.get(r.teamId)!) {
      db.insert(s.awards).values({ id: newId("aw_"), userId: u, eventId: consulting, teamId: r.teamId, title: `${placeTitle[r.rank - 1]} · Consulting Case Challenge 2026`, rank: r.rank, createdAt: at(-60 * D) }).run();
    }
  }
  db.insert(s.documents).values([
    doc("overview", "Overview", "Live market-entry mandate for a D2C snacks brand entering tier-2 cities. 5 teams, 2 rounds.", "published", "public", 0, consulting, userIds.lead!),
    doc("final_report", "Final report", `# Consulting Case Challenge 2026 — Final report\n\n## Summary\n5 teams · 18 participants · 2 judges · client: D2C snacks brand (anonymised).\n\n## Results\n${ranked.map((r) => `${r.rank}. **${cTeams[cTeamIds.indexOf(r.teamId)]}** — ${r.average.toFixed(1)}`).join("\n")}\n\n## What worked\n- Live client mandate raised the quality bar.\n- Two-round format let teams iterate on feedback.\n\n## Improve next time\n- Release data pack 24h earlier.\n- Calibrate judges on a sample deck before scoring.`, "published", "public", 0, consulting, userIds.lead!),
    doc("problem_statements", "Case brief", "Should the brand enter tier-2 cities through modern trade, quick commerce, or its own D2C channel? Recommend, size, and plan the first 6 months.", "published", "public", 0, consulting, userIds.lead!),
  ]).run();
  for (let i = 0; i < 14; i++)
    db.insert(s.feedback).values({ id: newId("fb_"), eventId: consulting, userId: students[14 + i]!, role: "participant", rating: between(3, 5), comment: pick(["Best case comp on campus.", "More time for the final round please.", "Judges' feedback was really specific.", null as unknown as string]), createdAt: at(-60 * D) }).run();

  /* ───────── CodeSprint (completed, individual) ───────── */
  const csr = newId("rd_");
  db.insert(s.eventRounds).values({ id: csr, eventId: codesprint, name: "Contest", order: 1, status: "completed", isFinal: true }).run();
  students.slice(9, 21).forEach((u, i) => {
    const t = newId("tm_");
    db.insert(s.teams).values({ id: t, eventId: codesprint, name: `Solo · ${i + 1}`, code: `CS-${i + 1}` }).run();
    db.insert(s.participants).values({ id: newId("pt_"), eventId: codesprint, userId: u, teamId: t, isTeamLead: true, status: "confirmed", checkinToken: token(12) }).run();
    if (i < 3) db.insert(s.awards).values({ id: newId("aw_"), userId: u, eventId: codesprint, teamId: t, title: `${placeTitle[i]} · CodeSprint 2026`, rank: i + 1, createdAt: at(-24 * D) }).run();
  });

  /* ───────── Upcoming events: some registrations ───────── */
  for (const u of students.slice(18, 30)) db.insert(s.participants).values({ id: newId("pt_"), eventId: aiHack, userId: u, status: "registered", checkinToken: token(12) }).run();
  for (const u of students.slice(28, 34)) db.insert(s.participants).values({ id: newId("pt_"), eventId: startup, userId: u, status: "registered", checkinToken: token(12) }).run();
  db.insert(s.eventRounds).values([
    { id: newId("rd_"), eventId: aiHack, name: "Build", order: 1 },
    { id: newId("rd_"), eventId: aiHack, name: "Demo & evaluation", order: 2, isFinal: true },
    { id: newId("rd_"), eventId: startup, name: "Pitch", order: 1, isFinal: true },
  ]).run();
  db.insert(s.documents).values([
    doc("overview", "About the AI Hackathon", "Build an LLM-powered tool for a real campus problem. **Evaluation-first**: show your test set and how you measured quality.", "published", "public", 0, aiHack, userIds.admin!),
    doc("overview", "Northfield internal notes", "Internal to Northfield.", "published", "internal", 0, nfEvent, userIds.nfLead!),
  ]).run();

  /* ───────── Opportunities ───────── */
  const opp = (v: Omit<typeof s.opportunities.$inferInsert, "id">) => db.insert(s.opportunities).values({ id: newId("op_"), createdById: userIds.admin, ...v }).run();
  opp({ title: "AI Hackathon: Build with LLMs", organizer: "AI Society · Rishihood", category: "ai_competition", source: "arthakram", eventId: aiHack, description: "24-hour LLM build sprint with evaluation-first judging.", tags: ["ai", "coding", "data"], mode: "hybrid", deadline: at(9 * D), startsAt: at(12 * D), prize: "₹40,000 + credits", featured: true });
  opp({ title: "Founders Day Startup Challenge", organizer: "E-Cell · Rishihood", category: "startup_challenge", source: "arthakram", eventId: startup, description: "Pitch your venture to founders and investors.", tags: ["startups", "product", "entrepreneurship"], mode: "offline", deadline: at(14 * D), startsAt: at(20 * D), prize: "Office hours + ₹25,000" });
  opp({ title: "National Product Teardown Challenge", organizer: "Demo listing", category: "product_competition", source: "unstop", sourceUrl: "https://unstop.com/competitions", description: "Illustrative listing — tear down a consumer app and propose one high-impact feature.", tags: ["product", "strategy", "design"], mode: "online", deadline: at(6 * D), prize: "₹1,00,000 pool", featured: true });
  opp({ title: "Campus Strategy Case Cup", organizer: "Demo listing", category: "case_competition", source: "unstop", sourceUrl: "https://unstop.com/competitions", description: "Illustrative listing — two-round strategy case competition for undergraduates.", tags: ["consulting", "strategy", "finance"], mode: "online", deadline: at(11 * D), prize: "₹75,000 + PPIs" });
  opp({ title: "Fintech Ideathon", organizer: "Demo listing", category: "hackathon", source: "unstop", sourceUrl: "https://unstop.com/hackathons", description: "Illustrative listing — design a product for first-time investors.", tags: ["finance", "product", "coding"], mode: "online", deadline: at(4 * D) });
  opp({ title: "Design for Bharat UX Challenge", organizer: "Demo listing", category: "design_competition", source: "unstop", sourceUrl: "https://unstop.com/competitions", description: "Illustrative listing — redesign a public-service flow for low-bandwidth users.", tags: ["design", "product"], mode: "online", deadline: at(16 * D) });
  opp({ title: "Policy Hack: Urban Mobility", organizer: "Demo listing", category: "debate", source: "external", sourceUrl: "https://example.org/policy-hack", description: "Illustrative listing — draft a policy memo and defend it before a panel.", tags: ["policy", "debate"], mode: "offline", location: "New Delhi", deadline: at(21 * D) });
  opp({ title: "Data Science Sprint", organizer: "Demo listing", category: "ai_competition", source: "unstop", sourceUrl: "https://unstop.com/hackathons", description: "Illustrative listing — forecast demand from a real retail dataset.", tags: ["ai", "data", "python"], mode: "online", deadline: at(8 * D) });
  opp({ title: "Brand Sprint: Campus Edition", organizer: "Demo listing", category: "marketing_competition", source: "external", sourceUrl: "https://example.org/brand-sprint", description: "Illustrative listing — launch campaign for a campus brand in 72 hours.", tags: ["marketing", "design"], mode: "hybrid", deadline: at(13 * D) });
  opp({ title: "Product Management Fellowship (Winter)", organizer: "Demo listing", category: "fellowship", source: "external", sourceUrl: "https://example.org/pm-fellowship", description: "Illustrative listing — 8-week fellowship with weekly product assignments.", tags: ["product", "strategy"], mode: "online", deadline: at(25 * D) });
  opp({ title: "Northfield Hack Night", organizer: "Northfield Tech Collective", category: "hackathon", source: "arthakram", eventId: nfEvent, description: "Partner-org hack night.", tags: ["coding"], mode: "offline", deadline: at(7 * D) });
  opp({ title: "Model UN Delegate Program", organizer: "Demo listing", category: "mun", source: "external", sourceUrl: "https://example.org/mun", description: "Illustrative listing — closed.", tags: ["policy", "mun"], mode: "offline", deadline: at(-5 * D), status: "closed" });

  /* ───────── Learn page ───────── */
  db.insert(s.learningResources).values([
    { id: newId("lr_"), title: "Product Guys", description: "Learn product management, product thinking and related skills — Arthakram's dedicated product learning platform.", url: process.env.PRODUCT_GUYS_URL || null, ctaLabel: "Visit Product Guys", kind: "arthakram_product", tags: ["product"], order: 0 },
    { id: newId("lr_"), title: "Consulting", description: "Explore consulting resources, case frameworks and competition preparation.", url: process.env.CONSULTING_URL || null, ctaLabel: "Visit Consulting", kind: "arthakram_product", tags: ["consulting", "strategy"], order: 1 },
    { id: newId("lr_"), title: "Competition archive", description: "Problem statements, rubrics and final reports from past Arthakram events.", url: "/archive", ctaLabel: "Browse archive", kind: "tool", tags: ["competitions"], order: 2 },
  ]).run();

  /* ───────── Mentorship ───────── */
  const req1 = newId("mr_");
  db.insert(s.mentorRequests).values([
    { id: req1, studentId: ananya, mentorId: mentors[0]!, topic: "Review my Swiggy Instamart teardown", workType: "product_case", workUrl: "https://docs.google.com/", message: "Would love feedback on my prioritisation section.", status: "completed", createdAt: at(-20 * D), respondedAt: at(-19 * D) },
    { id: newId("mr_"), studentId: ananya, mentorId: mentors[1]!, topic: "Case interview practice", workType: "consulting_case", message: "Preparing for the Campus Strategy Case Cup.", status: "pending", createdAt: at(-1 * D) },
    { id: newId("mr_"), studentId: students[3]!, mentorId: mentors[0]!, topic: "Portfolio review for APM roles", workType: "portfolio", status: "pending", createdAt: at(-2 * D) },
    { id: newId("mr_"), studentId: students[19]!, mentorId: mentors[2]!, topic: "RAG project feedback", workType: "project", workUrl: "https://github.com/", status: "accepted", createdAt: at(-4 * D), respondedAt: at(-3 * D) },
  ]).run();
  db.insert(s.mentorReviews).values({
    id: newId("mv_"), requestId: req1, mentorId: mentors[0]!, studentId: ananya, title: "Instamart teardown", workType: "product_case",
    scores: [{ dimension: "Problem solving", score: 8 }, { dimension: "Communication", score: 7 }, { dimension: "Business thinking", score: 9 }, { dimension: "Presentation", score: 6 }],
    strengths: "Excellent user segmentation and a sharp insight about repeat-purchase triggers.", weaknesses: "Prioritisation jumps to solutions before sizing impact.",
    improvements: "Use a simple impact × confidence × effort table before recommending.", nextSteps: "Redo the prioritisation section and enter the National Product Teardown Challenge.", createdAt: at(-19 * D),
  }).run();

  /* ───────── Notifications & audit ───────── */
  const n = (userId: string, kind: string, title: string, link: string, body?: string, ago = 0) =>
    db.insert(s.notifications).values({ id: newId("nt_"), userId, kind, title, body: body ?? null, link, createdAt: at(-ago) }).run();
  n(ananya, "announcement", "Round 2 · Build Sprint has started", `/app/my-events`, "Submit before the timer hits zero.", 3 * H);
  n(ananya, "opportunity", "New match: National Product Teardown Challenge (94%)", "/app/opportunities", undefined, 6 * H);
  n(ananya, "mentor", "Rohan Gupta reviewed your Instamart teardown", "/app/mentorship", undefined, 19 * D);
  for (const j of judges) n(j, "judge", "You've been assigned 6 teams for Round 2", "/app/judge", undefined, 3 * H);
  n(mentors[0]!, "mentor", "New mentorship request from Aditya Sharma", "/app/mentor", undefined, 2 * D);

  const log = (actor: string, action: string, type: string, summary: string, eventId: string | null, ago: number, before?: unknown, after?: unknown) =>
    db.insert(s.auditLogs).values({ id: newId("al_"), actorId: actor, action, resourceType: type, summary, eventId, before: before ?? null, after: after ?? null, createdAt: at(-ago) }).run();
  log(userIds.lead!, "event.create", "event", "Kabir Malhotra created Product Hackathon 2026", ph, 30 * D);
  log(userIds.admin!, "access.grant", "role_assignment", "Ishita Rao granted Documentation Manager on Product Hackathon 2026 to Meera Iyer", ph, 20 * D);
  log(userIds.lead!, "access.grant", "role_assignment", "Kabir Malhotra granted Organizer on Product Hackathon 2026 to Rahul Verma", ph, 20 * D);
  log(userIds.docs!, "document.update", "document", "Meera Iyer edited Rules & code of conduct", ph, 2 * D, { status: "draft" }, { status: "published" });
  log(userIds.organizer!, "timer.start", "timer", "Rahul Verma started Round 2 · Build Sprint", ph, 3 * H);
  log(judges[0]!, "evaluation.submit", "evaluation", "Ankit Sharma submitted evaluation for Pivot Point (Round 2)", ph, 40 * MIN);
  log(userIds.admin!, "access.revoke", "role_assignment", "Ishita Rao revoked Organizer on CodeSprint 2026 from Rahul Verma", null, 26 * D);

  db.insert(s.platformSettings).values([
    { key: "allowSignups", value: true },
    { key: "platformName", value: "Arthakram" },
    { key: "tagline", value: "First principles to final product." },
  ]).run();

  console.log(`✓ Seeded demo ecosystem. Sign in with any demo account, password: ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
