import { env } from "../env";

/** Client IP for rate limiting. X-Forwarded-For is only trusted when TRUST_PROXY is enabled. */
export function clientIp(headers: Headers): string {
  if (env().TRUST_PROXY) {
    const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd.slice(0, 64);
    const real = headers.get("x-real-ip")?.trim();
    if (real) return real.slice(0, 64);
  }
  return "unknown";
}

export function requestId(headers: Headers): string {
  return headers.get("x-request-id")?.slice(0, 64) ?? crypto.randomUUID();
}
