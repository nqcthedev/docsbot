import { handleHealthRequest } from 'src/server/api/health';

// ----------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handleHealthRequest;
