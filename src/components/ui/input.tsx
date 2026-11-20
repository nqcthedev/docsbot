import { cn } from 'src/utils/cn';

// ----------------------------------------------------------------------

const FIELD_FOCUS =
  'focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20';

// ----------------------------------------------------------------------

type InputProps = React.ComponentProps<'input'>;

export function Input({ className, ...other }: InputProps) {
  return (
    <input
      className={cn(
        `flex h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-xs placeholder:text-zinc-400 ${FIELD_FOCUS} disabled:opacity-50`,
        className
      )}
      {...other}
    />
  );
}

// ----------------------------------------------------------------------

type TextareaProps = React.ComponentProps<'textarea'>;

export function Textarea({ className, ...other }: TextareaProps) {
  return (
    <textarea
      className={cn(
        `flex min-h-20 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-xs placeholder:text-zinc-400 ${FIELD_FOCUS}`,
        className
      )}
      {...other}
    />
  );
}

// ----------------------------------------------------------------------

type SelectProps = React.ComponentProps<'select'>;

export function Select({ className, ...other }: SelectProps) {
  return (
    <select
      className={cn(
        `flex h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-xs ${FIELD_FOCUS}`,
        className
      )}
      {...other}
    />
  );
}
