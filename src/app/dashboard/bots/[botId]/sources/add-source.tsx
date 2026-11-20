"use client";

import { FileText, Globe, Type } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addPdfSource, addTextSource, addWebsiteSource, type ActionState } from "../../../actions";

type Tab = "website" | "pdf" | "text";

export function AddSource({ botId, maxPagesCap, maxUploadMb }: { botId: string; maxPagesCap: number; maxUploadMb: number }) {
  const [tab, setTab] = useState<Tab>("website");
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "website", label: "Website", icon: <Globe /> },
    { id: "pdf", label: "PDF", icon: <FileText /> },
    { id: "text", label: "Text / FAQ", icon: <Type /> },
  ];
  return (
    <Card>
      <div className="border-b border-zinc-100 px-5 pt-4">
        <h3 className="text-sm font-semibold">Add a source</h3>
        <div className="mt-3 flex gap-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm [&_svg]:size-4",
                tab === t.id ? "border-brand-600 font-medium text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5">
        {tab === "website" ? <WebsiteForm botId={botId} maxPagesCap={maxPagesCap} /> : tab === "pdf" ? <PdfForm botId={botId} maxUploadMb={maxUploadMb} /> : <TextForm botId={botId} />}
      </div>
    </Card>
  );
}

function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

function Status({ state }: { state: ActionState }) {
  if (state?.errors?.form) return <Alert tone="red">{state.errors.form}</Alert>;
  if (state?.ok && state.message) return <Alert tone="green">{state.message}</Alert>;
  return null;
}

function WebsiteForm({ botId, maxPagesCap }: { botId: string; maxPagesCap: number }) {
  const [state, action, pending] = useActionState(addWebsiteSource.bind(null, botId), undefined);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="space-y-4">
      <Field label="Website URL" htmlFor="url" error={state?.errors?.url} hint="We read sitemap.xml when available, follow same-site links, and respect robots.txt.">
        <Input id="url" name="url" type="url" placeholder="https://example.com" required />
      </Field>
      <Field label="Page limit" htmlFor="maxPages" error={state?.errors?.maxPages} hint={`Up to ${maxPagesCap} pages.`}>
        <Input id="maxPages" name="maxPages" type="number" min={1} max={maxPagesCap} defaultValue={Math.min(25, maxPagesCap)} className="w-28" />
      </Field>
      <Status state={state} />
      <Button type="submit" variant="brand" disabled={pending}>
        {pending ? "Adding…" : "Crawl website"}
      </Button>
    </form>
  );
}

function PdfForm({ botId, maxUploadMb }: { botId: string; maxUploadMb: number }) {
  const [state, action, pending] = useActionState(addPdfSource.bind(null, botId), undefined);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="space-y-4">
      <Field label="PDF file" htmlFor="file" error={state?.errors?.file} hint={`Text-based PDFs up to ${maxUploadMb} MB. Answers cite the page number.`}>
        <Input id="file" name="file" type="file" accept="application/pdf,.pdf" required className="h-auto py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm" />
      </Field>
      <Status state={state} />
      <Button type="submit" variant="brand" disabled={pending}>
        {pending ? "Uploading…" : "Upload PDF"}
      </Button>
    </form>
  );
}

function TextForm({ botId }: { botId: string }) {
  const [state, action, pending] = useActionState(addTextSource.bind(null, botId), undefined);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="space-y-4">
      <Field label="Title" htmlFor="name" error={state?.errors?.name}>
        <Input id="name" name="name" placeholder="e.g. Holiday opening hours" required />
      </Field>
      <Field label="Content" htmlFor="text" error={state?.errors?.text} hint="Markdown headings (#, ##) are used as section context.">
        <Textarea id="text" name="text" rows={8} placeholder={"# Holiday hours\n\nWe are closed on December 25 and January 1."} required />
      </Field>
      <Status state={state} />
      <Button type="submit" variant="brand" disabled={pending}>
        {pending ? "Saving…" : "Add text"}
      </Button>
    </form>
  );
}
