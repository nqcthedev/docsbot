import { cn } from 'src/utils/cn';

// ----------------------------------------------------------------------

type CardProps = React.ComponentProps<'div'>;

export function Card({ className, ...other }: CardProps) {
  return (
    <div
      className={cn('rounded-xl border border-zinc-200 bg-white shadow-xs', className)}
      {...other}
    />
  );
}

// ----------------------------------------------------------------------

type CardHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Rendered on the right, e.g. a button or a status indicator. */
  action?: React.ReactNode;
  className?: string;
};

export function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4',
        className
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-zinc-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
