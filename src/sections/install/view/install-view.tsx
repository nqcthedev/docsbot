import { Card, CardHeader } from 'src/components/ui';

import { buildChatApiExample } from '../utils';
import { InstallEmbedCard } from '../install-embed-card';
import { InstallCodeBlock } from '../install-code-block';

// ----------------------------------------------------------------------

type Props = {
  /** Public URL of this deployment, without a trailing slash. */
  appUrl: string;
  botId: string;
  allowedDomains: string[];
};

export function InstallView({ appUrl, botId, allowedDomains }: Props) {
  return (
    <div className="space-y-6">
      <InstallEmbedCard appUrl={appUrl} botId={botId} allowedDomains={allowedDomains} />
      <Card>
        <CardHeader
          title="HTTP API"
          description="Server-Sent Events stream: start → token… → done (with citations and lead-capture hint)."
        />
        <InstallCodeBlock
          code={buildChatApiExample(appUrl, botId)}
          className="p-5"
          copyButtonClassName="absolute right-8 top-8"
        />
      </Card>
    </div>
  );
}
