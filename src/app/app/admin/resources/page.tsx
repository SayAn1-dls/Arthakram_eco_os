import { asc } from "drizzle-orm";
import { db } from "@/db";
import { learningResources } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { deleteResource, saveResource } from "@/server/actions/admin";
import { ActionButton, ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Badge, Card, Forbidden, PageHeader } from "@/components/ui";
import { humanize } from "@/lib/format";

export const metadata = { title: "Learning resources" };

function ResourceForm({ r }: { r?: typeof learningResources.$inferSelect }) {
  return (
    <ActionForm action={saveResource} hidden={{ id: r?.id }} resetOnSuccess={!r} className="grid gap-3 sm:grid-cols-2">
      <Field label="Title">
        <Input name="title" required defaultValue={r?.title} />
      </Field>
      <Field label="Kind">
        <Select name="kind" defaultValue={r?.kind ?? "guide"} options={["arthakram_product", "guide", "course", "video", "tool"].map((k) => ({ value: k, label: humanize(k) }))} />
      </Field>
      <Field label="Description" className="sm:col-span-2">
        <Textarea name="description" rows={2} defaultValue={r?.description ?? ""} />
      </Field>
      <Field label="Link" hint="https://… or an internal /path. Leave empty to show “link coming soon”.">
        <Input name="url" defaultValue={r?.url ?? ""} />
      </Field>
      <Field label="Button label">
        <Input name="ctaLabel" required defaultValue={r?.ctaLabel ?? "Visit"} />
      </Field>
      <Field label="Tags">
        <Input name="tags" defaultValue={r?.tags.join(", ")} />
      </Field>
      <Field label="Order">
        <Input type="number" name="order" min={0} defaultValue={r?.order ?? 10} />
      </Field>
      <div className="flex items-center justify-between sm:col-span-2">
        <Checkbox name="active" defaultChecked={r?.active ?? true} label="Visible on Learn page" />
        <SubmitButton size="sm">{r ? "Save" : "Add resource"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function AdminResources() {
  const me = await adminPage("resources.manage");
  if (!me) return <Forbidden />;
  const list = db.select().from(learningResources).orderBy(asc(learningResources.order)).all();
  return (
    <>
      <PageHeader eyebrow="Admin" title="Learn / Resources" description="Product Guys and Consulting stay separate products — Arthakram links to them. Manage the cards here." />
      <div className="grid gap-6 xl:grid-cols-2">
        {list.map((r) => (
          <Card key={r.id} title={r.title} eyebrow={humanize(r.kind)} actions={!r.active ? <Badge>Hidden</Badge> : r.url ? null : <Badge tone="warn">No link yet</Badge>}>
            <ResourceForm r={r} />
            <div className="mt-2">
              <ActionButton action={deleteResource} hidden={{ id: r.id }} variant="ghost" confirm={`Remove ${r.title}?`}>
                Remove card
              </ActionButton>
            </div>
          </Card>
        ))}
        <Card title="Add resource">
          <ResourceForm />
        </Card>
      </div>
    </>
  );
}
