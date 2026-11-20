import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { buttonVariants } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  ctaHref: string;
};

export function HomeCta({ ctaHref }: Props) {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl rounded-3xl bg-zinc-950 px-8 py-14 text-center text-white">
        <h2 className="text-3xl font-semibold tracking-tight">
          Give your customers answers they can trust
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-zinc-400">
          Create a bot, add your website, and embed it in minutes.
        </p>
        <Link
          href={ctaHref}
          className={buttonVariants({ variant: 'brand', size: 'lg', className: 'mt-8' })}
        >
          Get started <ArrowRight />
        </Link>
      </div>
    </section>
  );
}
