import { cn } from 'src/utils/cn';

// ----------------------------------------------------------------------

type LabelProps = React.ComponentProps<'label'>;

export function Label({ className, ...other }: LabelProps) {
  return <label className={cn('text-sm font-medium text-zinc-800', className)} {...other} />;
}

// ----------------------------------------------------------------------

type FieldProps = {
  label: string;
  htmlFor?: string;
  /** Shown under the control unless there is an error. */
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
};

/** A labelled form control with its validation error or hint. */
export function Field({ label, hint, error, children, htmlFor }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}
