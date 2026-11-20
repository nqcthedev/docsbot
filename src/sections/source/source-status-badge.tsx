import type { ISourceStatus } from 'src/types/source';

import { Loader2 } from 'lucide-react';

import { Badge } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  status: ISourceStatus;
};

export function SourceStatusBadge({ status }: Props) {
  switch (status) {
    case 'ready':
      return <Badge tone="green">Ready</Badge>;
    case 'error':
      return <Badge tone="red">Failed</Badge>;
    case 'processing':
      return (
        <Badge tone="blue">
          <Loader2 className="size-3 animate-spin" /> Processing
        </Badge>
      );
    case 'pending':
      return <Badge tone="amber">Queued</Badge>;
    default: {
      const unhandled: never = status;
      return unhandled;
    }
  }
}
