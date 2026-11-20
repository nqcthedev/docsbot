import { cn } from 'src/utils/cn';

// ----------------------------------------------------------------------

const TONE_CLASSES = {
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  red: 'border-red-200 bg-red-50 text-red-800',
  blue: 'border-brand-100 bg-brand-50 text-brand-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

type AlertTone = keyof typeof TONE_CLASSES;

// ----------------------------------------------------------------------

type Props = {
  tone?: AlertTone;
  children: React.ReactNode;
  className?: string;
};

export function Alert({ tone = 'amber', children, className }: Props) {
  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', TONE_CLASSES[tone], className)}>
      {children}
    </div>
  );
}
