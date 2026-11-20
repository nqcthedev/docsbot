import { preflight } from 'src/server/http/public-api';
import { handleWidgetConfigRequest } from 'src/server/api/widget-config';

// ----------------------------------------------------------------------

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const OPTIONS = preflight;
export const GET = handleWidgetConfigRequest;
