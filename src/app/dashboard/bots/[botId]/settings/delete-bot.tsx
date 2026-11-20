'use client';

import { deleteBot } from 'src/app/dashboard/actions';

import { Card, Button, CardHeader } from 'src/components/ui';

export function DeleteBot({ botId, name }: { botId: string; name: string }) {
  return (
    <Card className="border-red-200">
      <CardHeader
        title="Danger zone"
        description="Deleting a bot removes its sources, conversations, leads and usage history."
      />
      <form
        action={deleteBot.bind(null, botId)}
        onSubmit={(e) => {
          if (!confirm(`Delete "${name}" and all its data? This cannot be undone.`))
            e.preventDefault();
        }}
        className="p-5"
      >
        <Button type="submit" variant="destructive">
          Delete bot
        </Button>
      </form>
    </Card>
  );
}
