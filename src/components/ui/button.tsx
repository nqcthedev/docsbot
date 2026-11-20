import type { VariantProps } from 'class-variance-authority';

import { cva } from 'class-variance-authority';

import { cn } from 'src/utils/cn';

// ----------------------------------------------------------------------

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-zinc-900 text-white shadow-sm hover:bg-zinc-800',
        brand: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
        outline: 'border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50',
        ghost: 'text-zinc-700 hover:bg-zinc-100',
        destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
        link: 'text-brand-600 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-9 px-4',
        lg: 'h-11 px-6 text-base',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

// ----------------------------------------------------------------------

type Props = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...other }: Props) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...other} />;
}
