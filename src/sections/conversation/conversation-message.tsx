import type { IMessageItem } from 'src/types/conversation';

import { cn } from 'src/utils/cn';

import { citationLabel, renderMarkdown } from 'src/shared/markdown';

// ----------------------------------------------------------------------

/** Why an assistant reply was not a grounded answer. Unknown values are shown verbatim. */
const OUTCOME_LABELS: Record<string, string> = {
  low_confidence: 'Declined: low retrieval confidence',
  no_answer: 'Declined: not in sources',
  handoff: 'Human handoff requested',
  error: 'Provider error',
  not_indexed: 'Bot not trained',
};

const MS_PER_SECOND = 1000;

// ----------------------------------------------------------------------

type Props = {
  message: IMessageItem;
};

export function ConversationMessage({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
          isUser ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-800'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {/* renderMarkdown escapes all HTML in the model output before adding formatting. */}
            <div
              className="answer"
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(message.content, message.citations),
              }}
            />
            {message.citations.length ? <MessageCitations citations={message.citations} /> : null}
            <MessageMeta message={message} />
          </>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------

type MessageCitationsProps = {
  citations: IMessageItem['citations'];
};

function MessageCitations({ citations }: MessageCitationsProps) {
  return (
    <ol className="mt-2 space-y-0.5 border-t border-zinc-200 pt-2 text-xs text-zinc-500">
      {citations.map((citation) => (
        <li key={citation.n}>
          [{citation.n}]{' '}
          {citation.url ? (
            <a
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-zinc-800"
            >
              {citationLabel(citation)}
            </a>
          ) : (
            citationLabel(citation)
          )}
        </li>
      ))}
    </ol>
  );
}

// ----------------------------------------------------------------------

type MessageMetaProps = {
  message: IMessageItem;
};

/** Diagnostics for the bot owner: outcome, retrieval score, model, tokens and latency. */
function MessageMeta({ message }: MessageMetaProps) {
  const { outcome, confidence, model, inputTokens, outputTokens, latencyMs } = message;

  return (
    <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-zinc-400">
      {outcome && outcome !== 'answered' ? (
        <span className="text-amber-700">{OUTCOME_LABELS[outcome] ?? outcome}</span>
      ) : null}
      {confidence !== null ? <span>similarity {confidence.toFixed(2)}</span> : null}
      {model ? <span>{model}</span> : null}
      {inputTokens ? <span>{inputTokens + (outputTokens ?? 0)} tokens</span> : null}
      {latencyMs ? <span>{(latencyMs / MS_PER_SECOND).toFixed(1)}s</span> : null}
    </p>
  );
}
