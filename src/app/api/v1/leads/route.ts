import { preflight } from 'src/server/http/public-api';
import { handleLeadRequest } from 'src/server/api/leads';

// ----------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = preflight;
export const POST = handleLeadRequest;
