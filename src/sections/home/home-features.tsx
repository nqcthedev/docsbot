import { Mail, Globe, Shuffle, BarChart3, BookOpenCheck, ShieldQuestion } from 'lucide-react';

// ----------------------------------------------------------------------

const FEATURES = [
  {
    icon: Globe,
    title: 'Learns your website',
    description:
      'Crawls your sitemap and pages (respecting robots.txt), plus PDFs and pasted FAQs. Re-sync any time.',
  },
  {
    icon: BookOpenCheck,
    title: 'Answers with sources',
    description:
      'Every answer is grounded in your content and cites the exact page, so customers can verify it.',
  },
  {
    icon: ShieldQuestion,
    title: "Knows when it doesn't know",
    description:
      'A tunable confidence threshold makes the bot decline instead of inventing prices or policies.',
  },
  {
    icon: Mail,
    title: 'Captures leads',
    description:
      "When a question isn't covered, or a visitor asks for a person, the bot collects their email for your team.",
  },
  {
    icon: BarChart3,
    title: 'Analytics & cost tracking',
    description:
      'Conversations, top and unanswered questions, token usage and estimated AI spend per bot.',
  },
  {
    icon: Shuffle,
    title: 'Multi-provider AI',
    description:
      'Gemini, OpenAI and Claude with automatic retries and fallback when a provider is rate-limited or down.',
  },
];

// ----------------------------------------------------------------------

export function HomeFeatures() {
  return (
    <section id="features" className="border-t border-zinc-100 bg-zinc-50/60 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-3xl font-semibold tracking-tight">
          Everything a support bot needs, nothing it shouldn&apos;t do
        </h2>
        <p className="mt-3 max-w-2xl text-zinc-600">
          Built around one rule: only say what your content says.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <feature.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
