import dns from "node:dns";
import net from "node:net";
import { Agent } from "undici";

/**
 * SSRF protection for the crawler. Users submit arbitrary URLs, so the server must never be
 * tricked into fetching loopback, link-local (cloud metadata 169.254.169.254), or private
 * network addresses. Checks run (1) on the literal host before connecting and (2) on every
 * DNS answer at connect time via a custom undici lookup, which also defeats DNS rebinding.
 */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number) as [number, number, number, number];
    const [a, b] = p;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && p[2] === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped?.[1]) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
  }
  return true;
}

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

export function assertCrawlableUrl(raw: string, allowPrivate: boolean): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrlError("Only http(s) URLs can be crawled");
  if (url.username || url.password) throw new BlockedUrlError("URLs with credentials are not allowed");
  if (!allowPrivate) {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local"))
      throw new BlockedUrlError("Local hostnames are not allowed");
    if (net.isIP(host) && isPrivateAddress(host)) throw new BlockedUrlError("Private or loopback IP addresses are not allowed");
  }
  return url;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

function guardedLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isPrivateAddress(a.address));
    if (bad) return callback(Object.assign(new BlockedUrlError(`${hostname} resolves to a private address`), { code: "EBLOCKED" }), "", 0);
    if (options.all) return callback(null, list);
    const first = list[0];
    if (!first) return callback(Object.assign(new Error(`No address for ${hostname}`), { code: "ENOTFOUND" }), "", 0);
    callback(null, first.address, first.family);
  });
}

let publicAgent: Agent | undefined;
/** undici dispatcher whose DNS lookups refuse private addresses. */
export function publicOnlyDispatcher(): Agent {
  return (publicAgent ??= new Agent({ connect: { lookup: guardedLookup as never }, connections: 16 }));
}
