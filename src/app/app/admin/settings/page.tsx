import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { adminPage } from "@/server/admin";
import { saveSettings } from "@/server/actions/admin";
import { ActionForm, Checkbox, Field, Input, SubmitButton } from "@/components/forms";
import { Card, Forbidden, PageHeader } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await adminPage("settings.manage");
  if (!me) return <Forbidden />;
  const s = Object.fromEntries(db.select().from(platformSettings).all().map((r) => [r.key, r.value]));
  return (
    <>
      <PageHeader eyebrow="Admin" title="Platform settings" />
      <Card className="max-w-xl">
        <ActionForm action={saveSettings} className="space-y-4">
          <Field label="Platform name">
            <Input name="platformName" defaultValue={String(s.platformName ?? "Arthakram")} required />
          </Field>
          <Field label="Tagline">
            <Input name="tagline" defaultValue={String(s.tagline ?? "")} />
          </Field>
          <Checkbox name="allowSignups" defaultChecked={s.allowSignups !== false} label="Allow new sign-ups" />
          <div>
            <SubmitButton>Save settings</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
