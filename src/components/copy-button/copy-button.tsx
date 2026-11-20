'use client';

import { Copy, Check } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Button } from 'src/components/ui';

// ----------------------------------------------------------------------

/** How long the button shows "Copied" before it resets. */
const COPIED_FEEDBACK_MS = 1500;

type Props = {
  text: string;
  className?: string;
};

export function CopyButton({ text, className }: Props) {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return undefined;
    const timer = setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [isCopied]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
  }, [text]);

  return (
    <Button type="button" size="sm" variant="outline" className={className} onClick={handleCopy}>
      {isCopied ? <Check /> : <Copy />} {isCopied ? 'Copied' : 'Copy'}
    </Button>
  );
}
