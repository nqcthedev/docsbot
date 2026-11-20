import type http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crawlSite, normalizeUrl } from "@/server/ingest/crawler";
import { BlockedUrlError } from "@/server/ingest/url-guard";
import { startFixtureServer } from "../../fixtures/northwind/server";

let server: http.Server & { url: string };

beforeAll(async () => {
  server = await startFixtureServer({ port: 0 });
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("normalizeUrl", () => {
  it("strips fragments, tracking params and trailing slashes", () => {
    expect(normalizeUrl("https://a.example/shipping/?utm_source=x&b=2&a=1#top")).toBe("https://a.example/shipping?a=1&b=2");
    expect(normalizeUrl("https://a.example/")).toBe("https://a.example/");
    expect(normalizeUrl("not a url")).toBeUndefined();
  });
});

describe("crawlSite (local fixture site)", () => {
  it("crawls via sitemap + links, respects robots.txt and noindex, and extracts clean text", async () => {
    const res = await crawlSite(server.url, { maxPages: 50, allowPrivateNetworks: true });
    const paths = res.pages.map((p) => new URL(p.url).pathname).sort();
    expect(res.usedSitemap).toBe(true);
    expect(paths).toContain("/shipping");
    expect(paths).toContain("/brewing/espresso");
    expect(paths).toContain("/faq");
    // robots.txt disallows /admin/ and the sitemap lists it anyway: it must be skipped.
    expect(paths).not.toContain("/admin/staff-notes");
    expect(res.skipped).toContainEqual(expect.objectContaining({ reason: "robots.txt" }));
    // <meta name="robots" content="noindex">
    expect(paths).not.toContain("/thank-you");
    expect(res.skipped.some((s) => s.url.endsWith("/thank-you") && s.reason === "noindex")).toBe(true);
    const all = res.pages.map((p) => p.markdown).join("\n");
    expect(all).not.toContain("NW-STAFF-ONLY");
    const shipping = res.pages.find((p) => p.url.endsWith("/shipping"))!;
    expect(shipping.title).toBe("Shipping Information | Northwind Coffee Roasters");
    expect(shipping.markdown).toContain("## Canada");
    expect(shipping.markdown).not.toContain("Free US shipping on orders over $45 ·"); // announcement bar is outside <main>
  });

  it("honours the page limit", async () => {
    const res = await crawlSite(server.url, { maxPages: 3, allowPrivateNetworks: true });
    expect(res.pages).toHaveLength(3);
    expect(res.skipped.some((s) => s.reason === "page limit reached")).toBe(true);
  });

  it("follows same-origin redirects", async () => {
    const res = await crawlSite(`${server.url}/old-shipping`, { maxPages: 1, allowPrivateNetworks: true });
    expect(res.pages[0]?.url).toBe(`${server.url}/shipping`);
  });

  it("refuses private network targets unless explicitly allowed (SSRF protection)", async () => {
    await expect(crawlSite(server.url, { maxPages: 1, allowPrivateNetworks: false })).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(crawlSite("http://169.254.169.254/latest/meta-data", { maxPages: 1, allowPrivateNetworks: false })).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("works with an injected fetch (no network) and ignores off-site links", async () => {
    const pages: Record<string, string> = {
      "https://docs.example/robots.txt": "User-agent: *\nAllow: /",
      "https://docs.example/": '<main><h1>Home</h1><p>Welcome to the docs home page.</p><a href="/a">A</a><a href="https://evil.example/">x</a></main>',
      "https://docs.example/a": "<main><h1>Page A</h1><p>Details about page A live here.</p></main>",
    };
    const fakeFetch = (async (input: string | URL | Request) => {
      const url = String(input);
      const body = pages[url];
      if (!body) return new Response("nope", { status: 404 });
      return new Response(body, { status: 200, headers: { "content-type": url.endsWith(".txt") ? "text/plain" : "text/html" } });
    }) as typeof fetch;
    const res = await crawlSite("https://docs.example/", { maxPages: 10, allowPrivateNetworks: false, fetch: fakeFetch });
    expect(res.pages.map((p) => p.url).sort()).toEqual(["https://docs.example/", "https://docs.example/a"]);
  });
});
