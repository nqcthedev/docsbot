import { handleEmbedRequest } from 'src/server/api/embed';

// ----------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handleEmbedRequest;
