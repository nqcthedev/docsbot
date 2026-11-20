import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------

/** The one line a customer pastes into their site. `appUrl` has no trailing slash. */
export function buildEmbedSnippet(appUrl: string, botId: string) {
  return `<script src="${appUrl}${paths.widgetScript}" data-bot-id="${botId}" async></script>`;
}

// ----------------------------------------------------------------------

/** A copy-pasteable request against the public streaming chat API. */
export function buildChatApiExample(appUrl: string, botId: string) {
  const body = JSON.stringify({
    botId,
    visitorId: 'visitor-123456',
    message: 'Do you ship to Canada?',
  });
  return `curl -N ${appUrl}${paths.api.chat} \\
  -H 'content-type: application/json' \\
  -d '${body}'`;
}
