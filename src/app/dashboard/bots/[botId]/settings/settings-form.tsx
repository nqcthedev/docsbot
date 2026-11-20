"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { updateBotSettings } from "../../../actions";

type Initial = {
  name: string;
  welcomeMessage: string;
  fallbackMessage: string;
  brandColor: string;
  instructions: string;
  chatModel: string;
  temperature: number;
  minSimilarity: number;
  topK: number;
  allowedDomains: string;
  leadCaptureEnabled: boolean;
};

type ModelOption = { id: string; label: string; provider: string; available: boolean };

export function SettingsForm({ botId, initial, models }: { botId: string; initial: Initial; models: ModelOption[] }) {
  const [state, action, pending] = useActionState(updateBotSettings.bind(null, botId), undefined);
  const [color, setColor] = useState(initial.brandColor);
  const [threshold, setThreshold] = useState(initial.minSimilarity);
  const e = state?.errors ?? {};

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader title="Appearance" description="How the widget looks and greets visitors." />
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <Field label="Bot name" htmlFor="name" error={e.name}>
            <Input id="name" name="name" defaultValue={initial.name} required maxLength={60} />
          </Field>
          <Field label="Brand color" htmlFor="brandColor" error={e.brandColor}>
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Pick brand color" value={color} onChange={(ev) => setColor(ev.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-zinc-200 bg-white p-1" />
              <Input id="brandColor" name="brandColor" value={color} onChange={(ev) => setColor(ev.target.value)} className="w-32 font-mono" />
            </div>
          </Field>
          <Field label="Welcome message" htmlFor="welcomeMessage" error={e.welcomeMessage}>
            <Textarea id="welcomeMessage" name="welcomeMessage" defaultValue={initial.welcomeMessage} rows={2} maxLength={300} />
          </Field>
          <Field label="Fallback message" htmlFor="fallbackMessage" error={e.fallbackMessage} hint="Shown when the answer isn't in your sources.">
            <Textarea id="fallbackMessage" name="fallbackMessage" defaultValue={initial.fallbackMessage} rows={2} maxLength={300} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Answering" description="Model, tone and how strict the bot is about staying grounded." />
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <Field label="Chat model" htmlFor="chatModel" error={e.chatModel} hint="If it fails (rate limit, outage) DocsBot falls back to the next configured provider.">
            <Select id="chatModel" name="chatModel" defaultValue={initial.chatModel}>
              {models.map((m) => (
                <option key={m.id} value={m.id} disabled={!m.available}>
                  {m.label} ({m.provider}){m.available ? "" : " — no API key"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Creativity (temperature)" htmlFor="temperature" error={e.temperature} hint="Keep low (0–0.3) for factual support answers. Ignored by Claude models.">
            <Input id="temperature" name="temperature" type="number" step="0.05" min={0} max={1} defaultValue={initial.temperature} className="w-28" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Instructions & tone" htmlFor="instructions" error={e.instructions} hint="E.g. “Friendly and concise. Recommend a subscription when relevant.” These can't override the grounding rules.">
              <Textarea id="instructions" name="instructions" defaultValue={initial.instructions} rows={3} maxLength={2000} />
            </Field>
          </div>
          <Field
            label={`Confidence threshold: ${threshold.toFixed(2)}`}
            htmlFor="minSimilarity"
            error={e.minSimilarity}
            hint="Minimum cosine similarity of the best matching passage. Below it the bot says it doesn't know. Higher = stricter."
          >
            <input id="minSimilarity" name="minSimilarity" type="range" min={0.3} max={0.9} step={0.01} value={threshold} onChange={(ev) => setThreshold(Number(ev.target.value))} className="w-full accent-brand-600" />
          </Field>
          <Field label="Passages per answer" htmlFor="topK" error={e.topK} hint="How many retrieved chunks are given to the model (1–12).">
            <Input id="topK" name="topK" type="number" min={1} max={12} defaultValue={initial.topK} className="w-28" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Widget security & leads" />
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <Field label="Allowed domains" htmlFor="allowedDomains" error={e.allowedDomains} hint="One per line, e.g. example.com, *.example.com or localhost:3000. Empty = any site (not recommended).">
            <Textarea id="allowedDomains" name="allowedDomains" defaultValue={initial.allowedDomains} rows={4} className="font-mono" placeholder="example.com" />
          </Field>
          <div className="space-y-1.5">
            <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3">
              <input type="checkbox" name="leadCaptureEnabled" defaultChecked={initial.leadCaptureEnabled} className="mt-0.5 size-4 accent-brand-600" />
              <span>
                <span className="block text-sm font-medium">Lead capture</span>
                <span className="block text-xs text-zinc-500">Offer an email form when the bot can&apos;t answer or the visitor asks for a human.</span>
              </span>
            </label>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {state?.ok ? <Alert tone="green" className="py-1.5">{state.message}</Alert> : null}
        {state?.errors && Object.keys(state.errors).length ? <Alert tone="red" className="py-1.5">Please fix the highlighted fields.</Alert> : null}
      </div>
    </form>
  );
}
