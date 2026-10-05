import { asc } from "drizzle-orm";
import { db } from "@/db";
import { clubAssessments, clubs } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { saveClubTraits } from "@/server/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Forbidden, PageHeader } from "@/components/ui";
import { ASSESSMENT, DIMENSIONS, DIMENSION_KEYS } from "@/lib/recommend";

export const metadata = { title: "Recommendation engine" };

export default async function RecommendationsAdmin() {
  const me = await adminPage("recommendations.manage");
  if (!me) return <Forbidden />;
  const list = db.select().from(clubs).orderBy(asc(clubs.name)).all();
  const n = db.select().from(clubAssessments).all().length;
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Recommendation engine"
        description={`Transparent, rule-based matching. Students answer ${ASSESSMENT.length} questions → 12 dimension scores → matched against each club's trait profile below. ${n} assessments taken so far. Inputs are stored so an ML ranker can be trained later without changing the data model.`}
      />
      <div className="mb-6 rounded-xl border border-line bg-card p-4 text-sm text-ink-2">
        <b>How a match is scored:</b> 50% coverage (how much of the club’s profile the student brings) + 50% cosine similarity (how closely the student’s overall shape matches). Set a trait to 0 to ignore it; 1 means essential.
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {list.map((c) => (
          <Card key={c.id} title={c.name} eyebrow={c.category}>
            <ActionForm action={saveClubTraits} hidden={{ clubId: c.id }} className="space-y-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {DIMENSION_KEYS.map((d) => (
                  <label key={d} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-ink-2">{DIMENSIONS[d]}</span>
                    <input type="number" name={`trait_${d}`} min={0} max={1} step={0.1} defaultValue={c.traits[d] ?? 0} className="h-8 w-16 rounded-md border border-line bg-white px-2 text-right tabular" />
                  </label>
                ))}
              </div>
              <SubmitButton size="sm" variant="outline">
                Save traits
              </SubmitButton>
            </ActionForm>
          </Card>
        ))}
      </div>
    </>
  );
}
