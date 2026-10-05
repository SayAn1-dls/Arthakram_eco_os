import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubMembers, clubs, colleges, events, organizations } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { deleteClub, saveClub, saveCollege, saveOrganization } from "@/server/actions/admin";
import { ActionButton, ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Badge, Card, Forbidden, PageHeader } from "@/components/ui";
import { humanize } from "@/lib/format";

export const metadata = { title: "Organizations, colleges & clubs" };

export default async function OrgsPage() {
  const me = await adminPage("organizations.edit");
  if (!me) return <Forbidden />;
  const orgs = db.select().from(organizations).orderBy(asc(organizations.name)).all();
  const cols = db.select().from(colleges).all();
  const cls = db.select().from(clubs).orderBy(asc(clubs.name)).all();
  const evCount = (clubId: string) => db.select({ id: events.id }).from(events).where(eq(events.clubId, clubId)).all().length;
  const memCount = (clubId: string) => db.select({ u: clubMembers.userId }).from(clubMembers).where(eq(clubMembers.clubId, clubId)).all().length;
  const orgOpts = orgs.map((o) => ({ value: o.id, label: o.name }));
  const colOpts = cols.map((c) => ({ value: c.id, label: c.name }));
  return (
    <>
      <PageHeader eyebrow="Admin" title="Organizations, colleges & clubs" description="Arthakram → Organization → College → Club → Event. Event data stays isolated inside this structure unless explicitly shared." />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {orgs.map((o) => (
            <Card
              key={o.id}
              title={o.name}
              eyebrow={humanize(o.kind)}
              actions={
                <Link href={`/app/admin/access/organization/${o.id}`} className="text-sm font-semibold text-brand-deep hover:underline">
                  Access
                </Link>
              }
            >
              {o.description && <p className="mb-4 text-sm text-muted">{o.description}</p>}
              {cols
                .filter((c) => c.organizationId === o.id)
                .map((c) => (
                  <div key={c.id} className="mb-4 rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-ink">
                        {c.name} <span className="text-xs font-normal text-muted">{c.city}</span>
                      </div>
                      <Link href={`/app/admin/access/college/${c.id}`} className="text-xs font-semibold text-brand-deep hover:underline">
                        Access
                      </Link>
                    </div>
                  </div>
                ))}
              <ul className="divide-y divide-line/70">
                {cls
                  .filter((c) => c.organizationId === o.id)
                  .map((c) => (
                    <li key={c.id} className="py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                          <Link href={`/clubs/${c.slug}`} className="font-semibold text-ink hover:text-brand-deep">
                            {c.name}
                          </Link>
                          <Badge>{c.category}</Badge>
                          <span className="text-xs text-muted">
                            {memCount(c.id)} members · {evCount(c.id)} events
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <Link href={`/app/admin/access/club/${c.id}`} className="font-semibold text-brand-deep hover:underline">
                            Access
                          </Link>
                          <details className="relative">
                            <summary className="cursor-pointer font-semibold text-ink-2">Edit</summary>
                            <div className="absolute right-0 z-10 mt-2 w-[min(520px,85vw)] rounded-xl border border-line bg-card p-4 shadow-lg">
                              <ClubForm club={c} orgOpts={orgOpts} colOpts={colOpts} />
                              <div className="mt-3">
                                <ActionButton action={deleteClub} hidden={{ id: c.id }} variant="danger" confirm={`Delete ${c.name}?`}>
                                  Delete club
                                </ActionButton>
                              </div>
                            </div>
                          </details>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
        <div className="space-y-6">
          <Card title="New club">
            <ClubForm orgOpts={orgOpts} colOpts={colOpts} />
          </Card>
          <Card title="New college">
            <ActionForm action={saveCollege} resetOnSuccess className="space-y-3">
              <Field label="Organization">
                <Select name="organizationId" required options={orgOpts} />
              </Field>
              <Field label="Name">
                <Input name="name" required />
              </Field>
              <Field label="City">
                <Input name="city" />
              </Field>
              <SubmitButton>Add college</SubmitButton>
            </ActionForm>
          </Card>
          <Card title="New organization">
            <ActionForm action={saveOrganization} resetOnSuccess className="space-y-3">
              <Field label="Name">
                <Input name="name" required />
              </Field>
              <Field label="Kind">
                <Select name="kind" options={["university", "community", "company", "network"].map((k) => ({ value: k, label: humanize(k) }))} />
              </Field>
              <Field label="Description">
                <Textarea name="description" rows={2} />
              </Field>
              <Field label="Website">
                <Input type="url" name="website" />
              </Field>
              <SubmitButton>Add organization</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}

function ClubForm({
  club,
  orgOpts,
  colOpts,
}: {
  club?: typeof clubs.$inferSelect;
  orgOpts: { value: string; label: string }[];
  colOpts: { value: string; label: string }[];
}) {
  return (
    <ActionForm action={saveClub} hidden={{ id: club?.id }} resetOnSuccess={!club} className="grid gap-2 sm:grid-cols-2">
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" required defaultValue={club?.name} />
      </Field>
      <Field label="Organization">
        <Select name="organizationId" required defaultValue={club?.organizationId} options={orgOpts} />
      </Field>
      <Field label="College">
        <Select name="collegeId" defaultValue={club?.collegeId ?? ""} options={colOpts} placeholder="—" />
      </Field>
      <Field label="Category">
        <Input name="category" required defaultValue={club?.category} placeholder="product, coding, design…" />
      </Field>
      <Field label="Colour">
        <Input type="color" name="color" defaultValue={club?.color ?? "#F26A1B"} className="!p-1" />
      </Field>
      <Field label="Tagline" className="sm:col-span-2">
        <Input name="tagline" defaultValue={club?.tagline ?? ""} />
      </Field>
      <Field label="Description" className="sm:col-span-2">
        <Textarea name="description" rows={2} defaultValue={club?.description ?? ""} />
      </Field>
      <Field label="Who fits" className="sm:col-span-2">
        <Input name="fitProfile" defaultValue={club?.fitProfile ?? ""} />
      </Field>
      <Field label="What you'll learn (one per line)">
        <Textarea name="learnings" rows={2} defaultValue={club?.learnings.join("\n")} />
      </Field>
      <Field label="Activities (one per line)">
        <Textarea name="activities" rows={2} defaultValue={club?.activities.join("\n")} />
      </Field>
      <Field label="Career paths">
        <Textarea name="careerPaths" rows={2} defaultValue={club?.careerPaths.join("\n")} />
      </Field>
      <Field label="First steps">
        <Textarea name="firstSteps" rows={2} defaultValue={club?.firstSteps.join("\n")} />
      </Field>
      <Field label="Contact email">
        <Input name="contactEmail" defaultValue={club?.contactEmail ?? ""} />
      </Field>
      <div className="flex items-end">
        <Checkbox name="isRecruiting" defaultChecked={club?.isRecruiting ?? true} label="Recruiting" />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton size="sm">{club ? "Save club" : "Create club"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
