import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, DUMMY_HASH } from "@/server/auth/password";
import { frameAncestors, isOriginAllowed, normalizeDomainEntry, parseDomainList } from "@/server/domains";
import { assertCrawlableUrl, BlockedUrlError, isPrivateAddress } from "@/server/ingest/url-guard";
import { MemoryRateLimitStore, PostgresRateLimitStore, rateLimit } from "@/server/ratelimit";
import { escapeHtml, renderMarkdown } from "@/shared/markdown";
import { SseParser } from "@/shared/sse";
import { envSchema } from "@/server/env";
import { testDb } from "./helpers";

describe("password hashing", () => {
  it("hashes with scrypt and verifies", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await hashPassword("x")).not.toBe(await hashPassword("x")); // salted
  });
  it("rejects malformed hashes and never matches the dummy hash", async () => {
    expect(await verifyPassword("x", "plain")).toBe(false);
    expect(await verifyPassword("anything", DUMMY_HASH)).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit per fixed window, then blocks with Retry-After", async () => {
    const store = new MemoryRateLimitStore();
    const now = 1_700_000_000_000;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(store, "ip:1", 3, 60_000, now));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3]!.remaining).toBe(0);
    expect(results[3]!.retryAfterSeconds).toBeGreaterThan(0);
    expect((await rateLimit(store, "ip:2", 3, 60_000, now)).allowed).toBe(true); // separate key
    expect((await rateLimit(store, "ip:1", 3, 60_000, now + 60_000)).allowed).toBe(true); // next window
  });

  describe("Postgres store", () => {
    let h: Awaited<ReturnType<typeof testDb>>;
    beforeAll(async () => {
      h = await testDb();
    });
    afterAll(() => h.close());
    it("counts atomically across calls", async () => {
      const store = new PostgresRateLimitStore(h.db);
      const now = Date.now();
      const r = await Promise.all(Array.from({ length: 5 }, () => rateLimit(store, "bot:x", 4, 3_600_000, now)));
      expect(r.filter((x) => x.allowed)).toHaveLength(4);
    });
  });
});

describe("allowed domains", () => {
  it("normalises entries", () => {
    expect(normalizeDomainEntry("https://Shop.Example.com/path")).toBe("shop.example.com");
    expect(normalizeDomainEntry("*.example.com")).toBe("*.example.com");
    expect(normalizeDomainEntry("localhost:3101")).toBe("localhost:3101");
    expect(normalizeDomainEntry("bad domain!")).toBeUndefined();
    expect(parseDomainList("a.com, b.com\n\n*.c.com nope!")).toEqual({ domains: ["a.com", "b.com", "*.c.com"], invalid: ["nope!"] });
  });

  it("matches origins exactly, with www and wildcard support", () => {
    const allowed = ["example.com", "*.shop.io", "localhost:3101"];
    expect(isOriginAllowed("https://example.com", allowed)).toBe(true);
    expect(isOriginAllowed("https://www.example.com", allowed)).toBe(true);
    expect(isOriginAllowed("https://evil-example.com", allowed)).toBe(false);
    expect(isOriginAllowed("https://example.com.evil.io", allowed)).toBe(false);
    expect(isOriginAllowed("https://a.b.shop.io", allowed)).toBe(true);
    expect(isOriginAllowed("http://localhost:3101", allowed)).toBe(true);
    expect(isOriginAllowed("http://localhost:3102", allowed)).toBe(false);
    expect(isOriginAllowed("http://127.0.0.1:3101", allowed)).toBe(false);
    expect(isOriginAllowed(null, allowed)).toBe(false);
    expect(isOriginAllowed(null, [])).toBe(true);
  });

  it("builds a CSP frame-ancestors directive", () => {
    expect(frameAncestors([])).toBe("frame-ancestors *");
    expect(frameAncestors(["example.com"])).toBe("frame-ancestors 'self' https://example.com https://www.example.com http://example.com http://www.example.com");
    expect(frameAncestors(["localhost:3101"])).toBe("frame-ancestors 'self' https://localhost:3101 http://localhost:3101");
  });
});

describe("SSRF guard", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])("treats %s as private", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700::1111"])("treats %s as public", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
  it("blocks local hostnames, IP literals, credentials and non-http schemes", () => {
    for (const u of ["http://localhost:3000", "http://127.0.0.1/", "http://[::1]/", "file:///etc/passwd", "http://user:pw@example.com", "http://metadata.internal/"])
      expect(() => assertCrawlableUrl(u, false)).toThrow(BlockedUrlError);
    expect(assertCrawlableUrl("https://example.com/a", false).hostname).toBe("example.com");
    expect(assertCrawlableUrl("http://localhost:3101", true).port).toBe("3101");
  });
});

describe("markdown renderer", () => {
  it("escapes HTML so model output can never inject markup", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)"> **bold** [1]', [{ n: 1, title: 'A "doc"', url: "javascript:alert(1)", page: null }]);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('<span class="cite" title="A &quot;doc&quot;">1</span>');
  });

  it("renders lists, paragraphs and citation links", () => {
    const html = renderMarkdown("Rates:\n- US $5.95 [1]\n- Canada $16 [1]\n\nThanks", [{ n: 1, title: "Shipping", url: "https://s.example/shipping", page: null }]);
    expect(html).toBe(
      '<p>Rates:</p><ul><li>US $5.95 <a class="cite" href="https://s.example/shipping" target="_blank" rel="noopener noreferrer" title="Shipping">1</a></li><li>Canada $16 <a class="cite" href="https://s.example/shipping" target="_blank" rel="noopener noreferrer" title="Shipping">1</a></li></ul><p>Thanks</p>',
    );
    expect(renderMarkdown("Unknown [9]")).toBe("<p>Unknown </p>");
    expect(escapeHtml(`'"<>&`)).toBe("&#39;&quot;&lt;&gt;&amp;");
  });
});

describe("SSE parser", () => {
  it("handles events split across chunks, CRLF, comments and multi-line data", () => {
    const p = new SseParser();
    expect(p.push("event: token\r\ndata: {\"t\"")).toEqual([]);
    expect(p.push(":1}\r\n\r\n: keep-alive\n\ndata: a\ndata: b\n\n")).toEqual([
      { event: "token", data: '{"t":1}' },
      { event: "message", data: "a\nb" },
    ]);
    p.push("data: tail");
    expect(p.end()).toEqual([{ event: "message", data: "tail" }]);
  });
});

describe("env validation", () => {
  it("applies defaults and rejects invalid values", () => {
    const e = envSchema.parse({});
    expect(e.DATABASE_URL).toBe("pglite://.data/pglite");
    expect(e.CRAWLER_ALLOW_PRIVATE_NETWORKS).toBe(false);
    expect(e.RATE_LIMIT_CHAT_PER_IP_PER_MINUTE).toBe(20);
    expect(envSchema.safeParse({ DATABASE_URL: "mysql://x" }).success).toBe(false);
    expect(envSchema.safeParse({ AI_TIMEOUT_MS: "5" }).success).toBe(false);
    expect(envSchema.parse({ CRAWLER_ALLOW_PRIVATE_NETWORKS: "true" }).CRAWLER_ALLOW_PRIVATE_NETWORKS).toBe(true);
  });
});
