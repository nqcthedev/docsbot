import Link from 'next/link';

import { paths } from 'src/routes/paths';

import { Card, Alert, CardHeader } from 'src/components/ui';

import { buildEmbedSnippet } from './utils';
import { InstallCodeBlock } from './install-code-block';

// ----------------------------------------------------------------------

type Props = {
  appUrl: string;
  botId: string;
  allowedDomains: string[];
};

export function InstallEmbedCard({ appUrl, botId, allowedDomains }: Props) {
  const standaloneChatPath = paths.embed.standalone(botId);

  return (
    <Card>
      <CardHeader
        title="Embed the chat widget"
        description="Paste this before </body> on every page where the chat bubble should appear."
      />
      <div className="space-y-4 p-5">
        <InstallCodeBlock
          code={buildEmbedSnippet(appUrl, botId)}
          copyButtonClassName="absolute right-3 top-3"
          data-testid="embed-snippet"
        />
        {allowedDomains.length === 0 ? (
          <Alert>
            No allowed domains are set, so any website can embed this bot (and use your AI credits).{' '}
            <Link href={paths.dashboard.bot.settings(botId)} className="font-medium underline">
              Restrict it in Settings
            </Link>
            .
          </Alert>
        ) : (
          <Alert tone="green">
            The widget only loads on: <b>{allowedDomains.join(', ')}</b>. Browsers enforce this with
            a <code>frame-ancestors</code> Content-Security-Policy on the chat iframe.
          </Alert>
        )}
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
          <li>
            The loader is about 2 KB gzipped, loads asynchronously and renders inside a Shadow DOM +
            iframe, so it can&apos;t clash with your site&apos;s CSS.
          </li>
          <li>Works with any stack: plain HTML, WordPress, Shopify, Webflow, Next.js, etc.</li>
          <li>
            Shareable full-page chat:{' '}
            <a
              className="text-brand-600 underline"
              href={standaloneChatPath}
              target="_blank"
              rel="noreferrer"
            >
              {appUrl}
              {standaloneChatPath}
            </a>
          </li>
        </ul>
      </div>
    </Card>
  );
}
