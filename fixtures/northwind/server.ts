/**
 * Serves the fictional "Northwind Coffee Roasters" website used for demos and tests.
 * Pages live in ./pages (with a tiny front-matter header) and share ./layout.html.
 * robots.txt disallows /admin/ and /cart; the sitemap deliberately also lists the disallowed
 * and noindex pages so tests can prove the crawler respects robots.txt and meta robots.
 *
 * If a widget config file exists ({ appUrl, botId }), the DocsBot embed snippet is injected
 * into every page — exactly what a customer would paste into their own site.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PAGES = path.join(ROOT, "pages");

type Page = { title: string; description: string; meta: string; html: string };

function listPages(dir = PAGES, prefix = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listPages(full, `${prefix}/${name}`);
    if (!name.endsWith(".html")) return [];
    const slug = name === "index.html" ? prefix || "/" : `${prefix}/${name.replace(/\.html$/, "")}`;
    return [slug];
  });
}

function loadPage(slug: string): Page | undefined {
  const file = slug === "/" ? path.join(PAGES, "index.html") : path.join(PAGES, `${slug}.html`);
  if (!file.startsWith(PAGES) || !existsSync(file)) return undefined;
  const raw = readFileSync(file, "utf8");
  const [header, ...rest] = raw.split(/^---$/m);
  const fields = Object.fromEntries(
    (header ?? "")
      .split("\n")
      .map((l) => l.match(/^(\w+):\s*(.*)$/))
      .filter((m): m is RegExpMatchArray => Boolean(m))
      .map((m) => [m[1]!, m[2]!]),
  );
  return { title: fields.title ?? "Northwind", description: fields.description ?? "", meta: fields.meta ?? "", html: rest.join("---") };
}

export type FixtureServerOptions = { port: number; host?: string; widgetConfigFile?: string };

function widgetSnippet(file?: string): string {
  if (!file || !existsSync(file)) return "";
  try {
    const cfg = JSON.parse(readFileSync(file, "utf8")) as { appUrl?: string; botId?: string };
    if (!cfg.appUrl || !cfg.botId) return "";
    const esc = (s: string) => s.replace(/[^a-zA-Z0-9:/._-]/g, "");
    return `<script src="${esc(cfg.appUrl)}/widget.js" data-bot-id="${esc(cfg.botId)}" async></script>`;
  } catch {
    return "";
  }
}

export function startFixtureServer(opts: FixtureServerOptions): Promise<http.Server & { url: string }> {
  const host = opts.host ?? "127.0.0.1";
  const layout = readFileSync(path.join(ROOT, "layout.html"), "utf8");
  const slugs = listPages();

  const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url ?? "/", "http://fixture.local");
    const origin = `http://${req.headers.host ?? `${host}:${opts.port}`}`;
    const p = reqUrl.pathname.replace(/\/+$/, "") || "/";

    if (p === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end(`User-agent: *\nDisallow: /admin/\nDisallow: /cart\n\nSitemap: ${origin}/sitemap.xml\n`);
    }
    if (p === "/sitemap.xml") {
      res.writeHead(200, { "content-type": "application/xml" });
      const urls = slugs.map((s) => `  <url><loc>${origin}${s === "/" ? "/" : s}</loc></url>`).join("\n");
      return res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
    }
    if (p === "/static/site.css") {
      res.writeHead(200, { "content-type": "text/css" });
      return res.end(readFileSync(path.join(ROOT, "public", "site.css")));
    }
    if (p === "/old-shipping") {
      res.writeHead(301, { location: "/shipping" });
      return res.end();
    }
    const page = loadPage(p);
    if (!page) {
      res.writeHead(404, { "content-type": "text/html" });
      return res.end("<!doctype html><title>Not found</title><h1>Page not found</h1>");
    }
    const html = layout
      .replaceAll("{{title}}", page.title)
      .replaceAll("{{description}}", page.description)
      .replace("{{meta}}", page.meta)
      .replace("{{canonical}}", `${origin}${p}`)
      .replace("{{content}}", page.html)
      .replace("{{widget}}", widgetSnippet(opts.widgetConfigFile));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(html);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, host, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : opts.port;
      resolve(Object.assign(server, { url: `http://${host === "0.0.0.0" ? "localhost" : host}:${port}` }));
    });
  });
}
