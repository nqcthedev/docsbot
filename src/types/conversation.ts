import type { Lead, Message, Conversation } from 'src/server/db/schema';

// ----------------------------------------------------------------------

export type IMessageItem = Message;

/** A row of the conversation log. */
export type IConversationItem = Pick<
  Conversation,
  'id' | 'channel' | 'pageOrigin' | 'messageCount' | 'createdAt' | 'lastMessageAt'
> & {
  firstQuestion: string | null;
  unansweredCount: number;
  hasLead: boolean;
};

export type IConversationDetails = {
  conversation: Conversation;
  messages: Message[];
  leads: Lead[];
};
