const STEPS = [
  {
    title: 'Add your content',
    description:
      'Paste your site URL, upload PDFs, or add FAQ text. DocsBot crawls, cleans and chunks it with heading context.',
  },
  {
    title: 'Tune and test',
    description:
      'Set the tone, brand color, model and confidence threshold. Try it in the playground and read the citations.',
  },
  {
    title: 'Embed anywhere',
    description:
      'Paste one script tag. Restrict it to your domains, then watch conversations, leads and gaps in the dashboard.',
  },
];

// ----------------------------------------------------------------------

export function HomeHowItWorks() {
  return (
    <section id="how" className="py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Live in three steps</h2>
          <ol className="mt-8 space-y-6">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="mt-1 text-sm text-zinc-600">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <EmbedSnippetIllustration />
      </div>
    </section>
  );
}

// ----------------------------------------------------------------------

/** The embed snippet with syntax colouring; placeholder values, not this deployment's. */
function EmbedSnippetIllustration() {
  return (
    <div className="self-center rounded-2xl bg-zinc-950 p-6 font-mono text-sm text-zinc-300 shadow-xl">
      <p className="text-zinc-500">&lt;!-- paste before &lt;/body&gt; --&gt;</p>
      <p className="mt-2 break-all">
        <span className="text-pink-400">&lt;script</span> <span className="text-sky-300">src</span>=
        <span className="text-amber-300">&quot;https://your-app/widget.js&quot;</span>
        <br />
        &nbsp;&nbsp;<span className="text-sky-300">data-bot-id</span>=
        <span className="text-amber-300">&quot;YOUR_BOT_ID&quot;</span>{' '}
        <span className="text-sky-300">async</span>
        <span className="text-pink-400">&gt;&lt;/script&gt;</span>
      </p>
    </div>
  );
}
