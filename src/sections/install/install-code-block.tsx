import { cn } from 'src/utils/cn';

import { CopyButton } from 'src/components/copy-button';

// ----------------------------------------------------------------------

type Props = {
  code: string;
  /** Position of the copy button inside the block's container. */
  copyButtonClassName: string;
  className?: string;
  'data-testid'?: string;
};

/** Dark, horizontally scrollable code block with a copy button over its top-right corner. */
export function InstallCodeBlock({ code, copyButtonClassName, className, ...other }: Props) {
  return (
    <div className={cn('relative', className)}>
      <pre
        className="overflow-x-auto rounded-lg bg-zinc-950 p-4 pr-24 font-mono text-[13px] text-zinc-100"
        {...other}
      >
        {code}
      </pre>
      <CopyButton text={code} className={copyButtonClassName} />
    </div>
  );
}
