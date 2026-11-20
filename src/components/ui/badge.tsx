import type { VariantProps } from 'class-variance-authority';

import { cva } from 'class-variance-authority';

import { cn } from 'src/utils/cn';

// ----------------------------------------------------------------------

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
  {
    variants: {
      tone: {
        neutral: 'bg-zinc-50 text-zinc-700 ring-zinc-200',
        green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        amber: 'bg-amber-50 text-amber-800 ring-amber-200',
        red: 'bg-red-50 text-red-700 ring-red-200',
        blue: 'bg-brand-50 text-brand-700 ring-brand-100',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

// ----------------------------------------------------------------------

type Props = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...other }: Props) {
  return <span className={cn(badgeVariants({ tone }), className)} {...other} />;
}
