import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, OPPORTUNITY_CATEGORIES, opportunities } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { deleteOpportunity, saveOpportunity } from "@/server/actions/admin";
import { ActionButton, ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Badge, Card, Forbidden, LinkButton, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { toLocalInput } from "@/lib/datetime";
import { fmtDate, humanize } from "@/lib/format";

export const metadata = { title: "Manage opportunities" };

export default async function AdminOpportunities({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const me = await adminPage("opportunities.manage");
  if (!me) return <Forbidden />;
  const list = db.select().from(opportunities).orderBy(desc(opportunities.featured), asc(opportunities.deadline)).all();
  const o = edit ? list.find((x) => x.id === edit) : undefined;
  const evOpts = db.select({ value: events.id, label: events.title }).from(events).all();
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Opportunities"
        description="Curate what students discover. External listings (e.g. from Unstop) always link to the original registration page — add them manually or via an official/permitted feed. No scraping."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Table>
          <thead>
            <tr>
              <Th>Opportunity</Th>
              <Th>Category</Th>
              <Th>Source</Th>
              <Th>Deadline</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id}>
                <Td>
                  <div className="font-semibold text-ink">
                    {x.title} {x.featured && <Badge tone="ink">Featured</Badge>}
                  </div>
                  <div className="text-xs text-muted">{x.organizer}</div>
                </Td>
                <Td>{humanize(x.category)}</Td>
                <Td>
                  {x.sourceUrl ? (
                    <a href={x.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-deep hover:underline">
                      {humanize(x.source)} ↗
                    </a>
                  ) : (
                    humanize(x.source)
                  )}
                </Td>
                <Td className="whitespace-nowrap text-xs">{fmtDate(x.deadline)}</Td>
                <Td>
                  <StatusBadge status={x.status} />
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <LinkButton href={`?edit=${x.id}`} variant="ghost" size="sm">
                    Edit
                  </LinkButton>
                  <ActionButton action={deleteOpportunity} hidden={{ id: x.id }} variant="ghost" confirm={`Remove ${x.title}?`}>
                    ×
                  </ActionButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Card title={o ? `Edit: ${o.title}` : "Add opportunity"} actions={o ? <LinkButton href="?" variant="ghost" size="sm">New</LinkButton> : null}>
          <ActionForm key={o?.id ?? "new"} action={saveOpportunity} hidden={{ id: o?.id }} resetOnSuccess={!o} className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <Input name="title" required defaultValue={o?.title} />
            </Field>
            <Field label="Organizer">
              <Input name="organizer" required defaultValue={o?.organizer} />
            </Field>
            <Field label="Category">
              <Select name="category" defaultValue={o?.category} options={OPPORTUNITY_CATEGORIES.map((c) => ({ value: c, label: humanize(c) }))} />
            </Field>
            <Field label="Source">
              <Select name="source" defaultValue={o?.source ?? "external"} options={[{ value: "external", label: "External site" }, { value: "unstop", label: "Unstop" }, { value: "arthakram", label: "Arthakram event" }]} />
            </Field>
            <Field label="Arthakram event (if internal)">
              <Select name="eventId" defaultValue={o?.eventId ?? ""} options={evOpts} placeholder="—" />
            </Field>
            <Field label="Original registration URL" className="sm:col-span-2">
              <Input type="url" name="sourceUrl" defaultValue={o?.sourceUrl ?? ""} placeholder="https://unstop.com/…" />
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea name="description" rows={2} defaultValue={o?.description ?? ""} />
            </Field>
            <Field label="Tags" hint="Used for matching" className="sm:col-span-2">
              <Input name="tags" defaultValue={o?.tags.join(", ")} placeholder="product, strategy, design" />
            </Field>
            <Field label="Mode">
              <Select name="mode" defaultValue={o?.mode ?? "online"} options={["online", "offline", "hybrid"]} />
            </Field>
            <Field label="Location">
              <Input name="location" defaultValue={o?.location ?? ""} />
            </Field>
            <Field label="Registration deadline">
              <Input type="datetime-local" name="deadline" defaultValue={toLocalInput(o?.deadline)} />
            </Field>
            <Field label="Prize">
              <Input name="prize" defaultValue={o?.prize ?? ""} />
            </Field>
            <Field label="Eligibility">
              <Input name="eligibility" defaultValue={o?.eligibility ?? ""} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={o?.status ?? "active"} options={["active", "draft", "closed"]} />
            </Field>
            <div className="flex items-center justify-between sm:col-span-2">
              <Checkbox name="featured" defaultChecked={o?.featured} label="Featured" />
              <SubmitButton>{o ? "Save" : "Add"}</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
