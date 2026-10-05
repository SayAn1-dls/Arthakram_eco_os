import { db } from "@/db";
import { colleges } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { profileOf } from "@/server/student";
import { updateProfile } from "@/server/actions/student";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const p = profileOf(user.id);
  const cols = db.select({ value: colleges.id, label: colleges.name }).from(colleges).all();
  return (
    <>
      <PageHeader eyebrow="You" title="Profile" description="Your interests, skills and goals drive club, opportunity and mentor recommendations." />
      <Card>
        <ActionForm action={updateProfile} className="grid gap-4 md:grid-cols-2">
          <Field label="Full name">
            <Input name="name" defaultValue={user.name} required />
          </Field>
          <Field label="Headline">
            <Input name="headline" defaultValue={user.headline ?? ""} placeholder="2nd year · Product & strategy" />
          </Field>
          <Field label="College">
            <Select name="collegeId" defaultValue={p?.collegeId ?? ""} options={cols} placeholder="Choose…" />
          </Field>
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <Field label="Program">
              <Input name="program" defaultValue={p?.program ?? ""} />
            </Field>
            <Field label="Year">
              <Input type="number" name="year" min={1} max={6} defaultValue={p?.year ?? ""} />
            </Field>
          </div>
          <Field label="Interests" hint="Comma separated — e.g. product, ai, consulting, design, finance, policy, startups" className="md:col-span-2">
            <Input name="interests" defaultValue={p?.interests.join(", ")} />
          </Field>
          <Field label="Skills" hint="e.g. figma, python, sql, public speaking" className="md:col-span-2">
            <Input name="skills" defaultValue={p?.skills.join(", ")} />
          </Field>
          <Field label="Career goals" hint="e.g. product manager, consultant, founder">
            <Input name="careerGoals" defaultValue={p?.careerGoals.join(", ")} />
          </Field>
          <Field label="Hours per week for clubs">
            <Input type="number" name="weeklyHours" min={0} max={60} defaultValue={p?.weeklyHours ?? ""} />
          </Field>
          <Field label="About you" className="md:col-span-2">
            <Textarea name="bio" rows={3} defaultValue={p?.bio ?? ""} />
          </Field>
          <Field label="LinkedIn">
            <Input type="url" name="linkedinUrl" defaultValue={p?.linkedinUrl ?? ""} />
          </Field>
          <Field label="GitHub">
            <Input type="url" name="githubUrl" defaultValue={p?.githubUrl ?? ""} />
          </Field>
          <Field label="Portfolio">
            <Input type="url" name="portfolioUrl" defaultValue={p?.portfolioUrl ?? ""} />
          </Field>
          <div className="flex items-end justify-end md:col-span-2">
            <SubmitButton size="lg">Save profile</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
