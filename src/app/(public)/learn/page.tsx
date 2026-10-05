import { asc, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db } from "@/db";
import { learningResources } from "@/db/schema";
import { Badge, PageHeader } from "@/components/ui";
import { humanize } from "@/lib/format";

export const metadata = { title: "Learn" };

export default async function LearnPage() {
  const list = db.select().from(learningResources).where(eq(learningResources.active, true)).orderBy(asc(learningResources.order)).all();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Learn / Resources" title="Learn" description="Product Guys and Consulting are Arthakram’s own learning sites. Start there, then look at past competitions to see what judges look for." />
      <div className="grid gap-6 md:grid-cols-2">
        {list.map((r) => {
          const external = r.url?.startsWith("http");
          return (
            <div key={r.id} className={`flex flex-col rounded-[var(--radius-card)] border p-7 ${r.kind === "arthakram_product" ? "border-brand bg-card" : "border-line bg-card"}`}>
              <Badge tone={r.kind === "arthakram_product" ? "solid" : "neutral"}>{r.kind === "arthakram_product" ? "Arthakram product" : humanize(r.kind)}</Badge>
              <h2 className="mt-4 text-3xl font-bold">{r.title}</h2>
              <p className="mt-2 flex-1 text-ink-2">{r.description}</p>
              <div className="mt-6">
                {r.url ? (
                  <a href={r.url} target={external ? "_blank" : undefined} rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 font-semibold text-white hover:bg-ink-2">
                    {r.ctaLabel} {external && <ExternalLink className="h-4 w-4" />}
                  </a>
                ) : (
                  <span className="inline-flex h-11 items-center rounded-lg border border-dashed border-line px-5 text-sm font-semibold text-muted">Link coming soon</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
