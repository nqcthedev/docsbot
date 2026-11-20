import { preflight } from 'src/server/http/public-api';
import { handleChatRequest } from 'src/server/api/chat';

// ----------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const OPTIONS = preflight;
export const POST = handleChatRequest;
