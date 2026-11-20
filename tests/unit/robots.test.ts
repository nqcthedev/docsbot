import { describe, expect, it } from "vitest";
import { parseRobots } from "@/server/ingest/robots";

describe("parseRobots", () => {
  const txt = `
# comment
User-agent: Googlebot
Disallow: /

User-agent: *
Disallow: /admin/
Disallow: /*.pdf$
Allow: /admin/public
Crawl-delay: 2

Sitemap: https://shop.example/sitemap.xml
`;
  const robots = parseRobots(txt, "DocsBotCrawler/1.0");

  it("applies the * group when no specific group matches", () => {
    expect(robots.isAllowed("/shipping")).toBe(true);
    expect(robots.isAllowed("/admin/staff")).toBe(false);
  });

  it("uses longest match, with Allow winning", () => {
    expect(robots.isAllowed("/admin/public/page")).toBe(true);
  });

  it("supports * and $ wildcards", () => {
    expect(robots.isAllowed("/files/guide.pdf")).toBe(false);
    expect(robots.isAllowed("/files/guide.pdf?x=1")).toBe(true);
  });

  it("reads crawl-delay and sitemaps", () => {
    expect(robots.crawlDelayMs).toBe(2000);
    expect(robots.sitemaps).toEqual(["https://shop.example/sitemap.xml"]);
  });

  it("prefers a group addressed to our user agent", () => {
    const r = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: DocsBotCrawler\nDisallow: /private", "DocsBotCrawler/1.0");
    expect(r.isAllowed("/public")).toBe(true);
    expect(r.isAllowed("/private/x")).toBe(false);
  });

  it("treats an empty Disallow as allow-all", () => {
    expect(parseRobots("User-agent: *\nDisallow:", "x").isAllowed("/anything")).toBe(true);
  });
});
