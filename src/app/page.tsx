import { ArrowRight, BarChart3, BookOpenCheck, Code2, FileText, Globe, Mail, ShieldCheck, ShieldQuestion, Shuffle } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const features = [
  { icon: Globe, title: "Learns your website", body: "Crawls your sitemap and pages (respecting robots.txt), plus PDFs and pasted FAQs. Re-sync any time." },
  { icon: BookOpenCheck, title: "Answers with sources", body: "Every answer is grounded in your content and cites the exact page, so customers can verify it." },
  { icon: ShieldQuestion, title: "Knows when it doesn't know", body: "A tunable confidence threshold makes the bot decline instead of inventing prices or policies." },
  { icon: Mail, title: "Captures leads", body: "When a question isn't covered, or a visitor asks for a person, the bot collects their email for your team." },
  { icon: BarChart3, title: "Analytics & cost tracking", body: "Conversations, top and unanswered questions, token usage and estimated AI spend per bot." },
  { icon: Shuffle, title: "Multi-provider AI", body: "Gemini, OpenAI and Claude with automatic retries and fallback when a provider is rate-limited or down." },
];

export default async function Landing() {
  const user = await getCurrentUser();
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-20 border-b border-zinc-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-zinc-600 md:flex">
            <a href="#features" className="hover:text-zinc-900">
              Features
            </a>
            <a href="#how" className="hover:text-zinc-900">
              How it works
            </a>
            <a href="#security" className="hover:text-zinc-900">
              Security
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/dashboard" className={buttonVariants({ variant: "default" })}>
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
                  Log in
                </Link>
                <Link href="/signup" className={buttonVariants({ variant: "brand" })}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_70%_0%,var(--color-brand-100),transparent_70%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-16 lg:grid-cols-2 lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3 py-1 text-xs font-medium text-brand-700 shadow-xs">
              <span className="size-1.5 rounded-full bg-emerald-500" /> RAG chatbot · open source · self-hostable
            </span>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight text-zinc-950 sm:text-6xl">
              Your docs, answering customers <span className="text-brand-600">with sources.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-600">
              DocsBot turns your website, PDFs and FAQs into a support assistant that cites every answer, admits when it doesn&apos;t know, and hands the conversation to your team.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={user ? "/dashboard" : "/signup"} className={buttonVariants({ variant: "brand", size: "lg" })}>
                Train your first bot <ArrowRight />
              </Link>
              <a href="#how" className={buttonVariants({ variant: "outline", size: "lg" })}>
                How it works
              </a>
            </div>
            <p className="mt-6 text-sm text-zinc-500">Embed with one line of HTML. Works on any website.</p>
          </div>

          {/* Static product illustration (not a live chat). */}
          <div className="relative mx-auto w-full max-w-md" aria-hidden>
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-brand-100 via-white to-amber-50 blur-2xl" />
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-brand-900/10">
              <div className="flex items-center gap-3 bg-[#b4532a] px-4 py-3 text-white">
                <span className="grid size-8 place-items-center rounded-full bg-white/20 text-sm font-bold">N</span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">Northwind Assistant</p>
                  <p className="text-xs opacity-80">AI assistant · answers from our docs</p>
                </div>
              </div>
              <div className="space-y-3 bg-zinc-50 p-4 text-sm">
                <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-[#b4532a] px-3.5 py-2 text-white">Do you ship to Canada? How much is it?</div>
                <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-800 shadow-xs">
                  Yes. Orders to Canada ship for a flat rate of <b>$16.00 USD</b> and arrive in 5–10 business days.
                  <Cite n={1} /> Duties and taxes may be collected on delivery. <Cite n={1} />
                  <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-dashed border-zinc-200 pt-2">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">↗ Shipping Information</span>
                  </div>
                </div>
                <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-[#b4532a] px-3.5 py-2 text-white">Do you offer a student discount?</div>
                <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-800 shadow-xs">
                  I couldn&apos;t find that in our documentation. Leave your email and our team will get back to you.
                  <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 text-xs text-zinc-500">you@example.com</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-zinc-100 bg-zinc-50/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Everything a support bot needs, nothing it shouldn&apos;t do</h2>
          <p className="mt-3 max-w-2xl text-zinc-600">Built around one rule: only say what your content says.</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Live in three steps</h2>
            <ol className="mt-8 space-y-6">
              {[
                { icon: Globe, t: "Add your content", d: "Paste your site URL, upload PDFs, or add FAQ text. DocsBot crawls, cleans and chunks it with heading context." },
                { icon: FileText, t: "Tune and test", d: "Set the tone, brand color, model and confidence threshold. Try it in the playground and read the citations." },
                { icon: Code2, t: "Embed anywhere", d: "Paste one script tag. Restrict it to your domains, then watch conversations, leads and gaps in the dashboard." },
              ].map((s, i) => (
                <li key={s.t} className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-900 text-sm font-semibold text-white">{i + 1}</span>
                  <div>
                    <p className="font-medium">{s.t}</p>
                    <p className="mt-1 text-sm text-zinc-600">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="self-center rounded-2xl bg-zinc-950 p-6 font-mono text-sm text-zinc-300 shadow-xl">
            <p className="text-zinc-500">&lt;!-- paste before &lt;/body&gt; --&gt;</p>
            <p className="mt-2 break-all">
              <span className="text-pink-400">&lt;script</span> <span className="text-sky-300">src</span>=<span className="text-amber-300">&quot;https://your-app/widget.js&quot;</span>
              <br />
              &nbsp;&nbsp;<span className="text-sky-300">data-bot-id</span>=<span className="text-amber-300">&quot;YOUR_BOT_ID&quot;</span> <span className="text-sky-300">async</span>
              <span className="text-pink-400">&gt;&lt;/script&gt;</span>
            </p>
          </div>
        </div>
      </section>

      <section id="security" className="border-t border-zinc-100 bg-zinc-50/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-6 text-brand-600" />
            <h2 className="text-3xl font-semibold tracking-tight">Production-minded by default</h2>
          </div>
          <ul className="mt-8 grid gap-4 text-sm text-zinc-700 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Postgres + pgvector with hybrid (vector + full-text) search",
              "Per-IP and per-bot rate limits on the public chat API",
              "Widget locked to your domains with CSP frame-ancestors",
              "SSRF-safe crawler that refuses private network addresses",
              "scrypt-hashed passwords and httpOnly session cookies",
              "Prompt-injection hardening: documents are data, not instructions",
            ].map((t) => (
              <li key={t} className="flex gap-2 rounded-xl border border-zinc-200 bg-white p-4">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand-500" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl rounded-3xl bg-zinc-950 px-8 py-14 text-center text-white">
          <h2 className="text-3xl font-semibold tracking-tight">Give your customers answers they can trust</h2>
          <p className="mx-auto mt-3 max-w-xl text-zinc-400">Create a bot, add your website, and embed it in minutes.</p>
          <Link href={user ? "/dashboard" : "/signup"} className={buttonVariants({ variant: "brand", size: "lg", className: "mt-8" })}>
            Get started <ArrowRight />
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-100 py-8 text-center text-sm text-zinc-500">
        Built by Cuong Nguyen — full stack &amp; AI developer.{" "}
        <a href="https://www.fiverr.com/cuongnqxx" className="font-medium text-brand-600 hover:underline" target="_blank" rel="noreferrer">
          Available for hire on Fiverr
        </a>
      </footer>
    </div>
  );
}

function Cite({ n }: { n: number }) {
  return <span className="mx-0.5 inline-flex h-4 min-w-4 -translate-y-1 items-center justify-center rounded bg-orange-100 px-1 text-[10px] font-bold text-[#b4532a]">{n}</span>;
}
