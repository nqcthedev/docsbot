// A static picture of the widget, not a live chat, so the landing page needs no AI calls.

const DEMO_BRAND_COLOR_CLASS = 'bg-[#b4532a]';

// ----------------------------------------------------------------------

export function HomeChatPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-brand-100 via-white to-amber-50 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-brand-900/10">
        <div className={`flex items-center gap-3 ${DEMO_BRAND_COLOR_CLASS} px-4 py-3 text-white`}>
          <span className="grid size-8 place-items-center rounded-full bg-white/20 text-sm font-bold">
            N
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Northwind Assistant</p>
            <p className="text-xs opacity-80">AI assistant · answers from our docs</p>
          </div>
        </div>
        <div className="space-y-3 bg-zinc-50 p-4 text-sm">
          <VisitorBubble>Do you ship to Canada? How much is it?</VisitorBubble>
          <BotBubble>
            Yes. Orders to Canada ship for a flat rate of <b>$16.00 USD</b> and arrive in 5–10
            business days.
            <CitationMark number={1} /> Duties and taxes may be collected on delivery.{' '}
            <CitationMark number={1} />
            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-dashed border-zinc-200 pt-2">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                ↗ Shipping Information
              </span>
            </div>
          </BotBubble>
          <VisitorBubble>Do you offer a student discount?</VisitorBubble>
          <BotBubble>
            I couldn&apos;t find that in our documentation. Leave your email and our team will get
            back to you.
            <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 text-xs text-zinc-500">
              you@example.com
            </div>
          </BotBubble>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------

type BubbleProps = {
  children: React.ReactNode;
};

function VisitorBubble({ children }: BubbleProps) {
  return (
    <div
      className={`ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md ${DEMO_BRAND_COLOR_CLASS} px-3.5 py-2 text-white`}
    >
      {children}
    </div>
  );
}

function BotBubble({ children }: BubbleProps) {
  return (
    <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-800 shadow-xs">
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------

type CitationMarkProps = {
  number: number;
};

function CitationMark({ number }: CitationMarkProps) {
  return (
    <span className="mx-0.5 inline-flex h-4 min-w-4 -translate-y-1 items-center justify-center rounded bg-orange-100 px-1 text-[10px] font-bold text-[#b4532a]">
      {number}
    </span>
  );
}
