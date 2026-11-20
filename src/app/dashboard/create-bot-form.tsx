"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { createBot } from "./actions";

export function CreateBotForm() {
  const [state, action, pending] = useActionState(createBot, undefined);
  return (
    <form action={action} className="flex items-start gap-2">
      <div>
        <Input name="name" placeholder="Bot name, e.g. Support Assistant" aria-label="Bot name" className="w-64" required maxLength={60} />
        {state?.errors?.name ? <p className="mt-1 text-xs text-red-600">{state.errors.name}</p> : null}
      </div>
      <Button type="submit" variant="brand" disabled={pending}>
        <Plus /> {pending ? "Creating…" : "New bot"}
      </Button>
    </form>
  );
}
