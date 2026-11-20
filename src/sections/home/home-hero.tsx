import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { buttonVariants } from 'src/components/ui';

import { HomeChatPreview } from './home-chat-preview';

// ----------------------------------------------------------------------

type Props = {
  /** Where the primary call to action leads: sign-up, or the dashboard when signed in. */
  ctaHref: string;
};

export function HomeHero({ ctaHref }: Props) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_70%_0%,var(--color-brand-100),transparent_70%)]" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-16 lg:grid-cols-2 lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3 py-1 text-xs font-medium text-brand-700 shadow-xs">
            <span className="size-1.5 rounded-full bg-emerald-500" /> RAG chatbot · open source ·
            self-hostable
          </span>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight text-zinc-950 sm:text-6xl">
            Your docs, answering customers <span className="text-brand-600">with sources.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-600">
            DocsBot turns your website, PDFs and FAQs into a support assistant that cites every
            answer, admits when it doesn&apos;t know, and hands the conversation to your team.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={ctaHref} className={buttonVariants({ variant: 'brand', size: 'lg' })}>
              Train your first bot <ArrowRight />
            </Link>
            <a href="#how" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              How it works
            </a>
          </div>
          <p className="mt-6 text-sm text-zinc-500">
            Embed with one line of HTML. Works on any website.
          </p>
        </div>

        <HomeChatPreview />
      </div>
    </section>
  );
}
