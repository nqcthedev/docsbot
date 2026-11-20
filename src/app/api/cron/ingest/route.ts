import { handleCronIngestRequest } from 'src/server/api/cron-ingest';

// ----------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = handleCronIngestRequest;
export const POST = handleCronIngestRequest;
