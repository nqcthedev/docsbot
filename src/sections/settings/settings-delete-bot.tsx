'use client';

import { useCallback } from 'react';

import { deleteBot } from 'src/actions/bot';

import { Card, Button, CardHeader } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  botName: string;
};

export function SettingsDeleteBot({ botId, botName }: Props) {
  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      if (!window.confirm(`Delete "${botName}" and all its data? This cannot be undone.`)) {
        event.preventDefault();
      }
    },
    [botName]
  );

  return (
    <Card className="border-red-200">
      <CardHeader
        title="Danger zone"
        description="Deleting a bot removes its sources, conversations, leads and usage history."
      />
      <form action={deleteBot.bind(null, botId)} onSubmit={handleSubmit} className="p-5">
        <Button type="submit" variant="destructive">
          Delete bot
        </Button>
      </form>
    </Card>
  );
}
