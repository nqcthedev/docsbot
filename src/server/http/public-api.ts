import type { Logger } from 'src/server/logger';

import { env } from 'src/server/env';
import { AppError } from 'src/server/errors';
import { isOriginAllowed } from 'src/server/domains';

export function appOrigin(): string {
  return new URL(env().APP_URL).origin;
}

/** CORS headers for the public API: our own iframe is same-origin; other origins must be on the bot's allow-list. */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

export function preflight(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

/** Rejects cross-origin calls from sites that are not on the bot's allowed-domain list. */
export function assertOriginAllowed(
  req: Request,
  allowedDomains: string[],
  pageOrigin?: string | null
) {
  const origin = req.headers.get('origin');
  const self = new Set([appOrigin(), new URL(req.url).origin]);
  if (origin && !self.has(origin) && !isOriginAllowed(origin, allowedDomains)) {
    throw new AppError('domain_not_allowed', 'This bot is not enabled for this website', 403);
  }
  // Defense in depth for the iframe: the page that embeds it reports its origin.
  if (pageOrigin && allowedDomains.length && !isOriginAllowed(pageOrigin, allowedDomains)) {
    throw new AppError('domain_not_allowed', 'This bot is not enabled for this website', 403);
  }
}

export function jsonError(err: unknown, log: Logger, headers: Record<string, string> = {}) {
  if (err instanceof AppError) {
    return Response.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status, headers }
    );
  }
  log.error('unhandled api error', { err });
  return Response.json(
    { error: { code: 'internal_error', message: 'Something went wrong' } },
    { status: 500, headers }
  );
}

export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > maxBytes)
    throw new AppError('payload_too_large', 'Request body is too large', 413);
  const text = await req.text();
  if (text.length > maxBytes)
    throw new AppError('payload_too_large', 'Request body is too large', 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('invalid_json', 'Request body must be JSON', 400);
  }
}
