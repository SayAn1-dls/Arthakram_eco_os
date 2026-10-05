"use client";

import { useActionState, useRef, useState } from "react";
import { Bold, Heading2, Link2, List, Quote, Table2 } from "lucide-react";
import { Markdown } from "./markdown";
import { Field, FormMessage, Input, Select, SubmitButton, type FormAction } from "./forms";
import { humanize } from "@/lib/format";

const SNIPPETS: Record<string, [string, string]> = {
  h2: ["\n## ", "Heading"],
  bold: ["**", "bold text**"],
  list: ["\n- ", "Item"],
  quote: ["\n> ", "Note"],
  link: ["[", "link text](https://)"],
  table: ["\n| Column | Column |\n|---|---|\n| ", "Value | Value |\n"],
};

export function DocEditor({
  action,
  hidden,
  doc,
  sections,
  attachments,
}: {
  action: FormAction;
  hidden: Record<string, string>;
  doc: { title: string; section: string; visibility: string; content: string };
  sections: readonly string[];
  attachments: { id: string; name: string; image: boolean }[];
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [content, setContent] = useState(doc.content);
  const [tab, setTab] = useState<"write" | "preview" | "split">("split");
  const ref = useRef<HTMLTextAreaElement>(null);

  const insert = (before: string, after = "") => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = content.slice(s, e);
    const next = content.slice(0, s) + before + (selected || after) + content.slice(e);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = s + before.length + (selected || after).length;
    });
  };

  return (
    <form action={formAction} className="space-y-4">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
        <Field label="Title">
          <Input name="title" defaultValue={doc.title} required />
        </Field>
        <Field label="Section">
          <Select name="section" defaultValue={doc.section} options={sections.map((s) => ({ value: s, label: humanize(s) }))} />
        </Field>
        <Field label="Who can read it">
          <Select
            name="visibility"
            defaultValue={doc.visibility}
            options={[
              { value: "internal", label: "Internal — staff only" },
              { value: "participants", label: "Participants, judges, mentors" },
              { value: "public", label: "Public" },
            ]}
          />
        </Field>
      </div>
      <div className="rounded-xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
          {(
            [
              ["h2", Heading2],
              ["bold", Bold],
              ["list", List],
              ["quote", Quote],
              ["link", Link2],
              ["table", Table2],
            ] as const
          ).map(([k, Icon]) => (
            <button key={k} type="button" title={humanize(k)} onClick={() => insert(...SNIPPETS[k]!)} className="rounded p-1.5 text-ink-2 hover:bg-paper-2">
              <Icon className="h-4 w-4" />
            </button>
          ))}
          {attachments.length > 0 && (
            <select
              className="ml-1 h-8 rounded border border-line bg-white px-2 text-xs"
              value=""
              onChange={(e) => {
                const a = attachments.find((x) => x.id === e.target.value);
                if (a) insert(a.image ? `![${a.name}](/api/files/${a.id})` : `[${a.name}](/api/files/${a.id})`);
              }}
              aria-label="Insert attachment"
            >
              <option value="">Insert attachment…</option>
              {attachments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.image ? "🖼 " : "📎 "}
                  {a.name}
                </option>
              ))}
            </select>
          )}
          <div className="ml-auto flex rounded-lg bg-paper-2 p-0.5 text-xs font-semibold">
            {(["write", "split", "preview"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-md px-2.5 py-1 ${tab === t ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
                {humanize(t)}
              </button>
            ))}
          </div>
        </div>
        <div className={tab === "split" ? "grid md:grid-cols-2" : ""}>
          <textarea
            ref={ref}
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`min-h-[480px] w-full resize-y border-0 bg-transparent p-4 font-mono text-[13px] leading-relaxed focus:outline-none ${tab === "preview" ? "hidden" : ""} ${tab === "split" ? "md:border-r md:border-line" : ""}`}
            placeholder="Write in Markdown…"
          />
          {tab !== "write" && (
            <div className="max-h-[640px] min-h-[480px] overflow-auto p-5">
              <Markdown>{content}</Markdown>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">Every save keeps the previous version in history.</span>
        <SubmitButton pendingText="Saving…">Save document</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
