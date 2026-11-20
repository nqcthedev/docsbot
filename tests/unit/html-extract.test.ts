import { it, expect, describe } from 'vitest';

import { extractHtml } from 'src/server/ingest/html-extract';

const html = `<!doctype html><html><head>
<title>Shipping | Northwind</title>
<meta name="robots" content="index,follow">
<link rel="canonical" href="/shipping">
<style>.x{color:red}</style>
</head><body>
<header><nav><a href="/coffee">Our Coffee</a><a href="/faq#top">FAQ</a></nav></header>
<div class="cookie-banner">We use cookies</div>
<main>
  <h1>Shipping   Information</h1>
  <p>We roast on <strong>Mondays</strong> and ship<br>the same day.</p>
  <h2>United States</h2>
  <table><tr><th>Method</th><th>Cost</th></tr><tr><td>Standard</td><td>$5.95</td></tr></table>
  <ul><li>Free over $45<ul><li>Before tax</li></ul></li><li>No PO boxes</li></ul>
  <script>alert("x")</script>
  <img src="a.png" alt="Map of delivery zones">
  <a href="mailto:hi@example.com">mail</a>
  <a href="https://other.example/x" rel="nofollow">skip</a>
  <a href="/returns">Returns</a>
</main>
<footer>© 2026 <a href="/about">About</a></footer>
</body></html>`;

describe('extractHtml', () => {
  const page = extractHtml(html, 'https://shop.example/shipping');

  it('extracts title and canonical URL', () => {
    expect(page.title).toBe('Shipping | Northwind');
    expect(page.canonical).toBe('https://shop.example/shipping');
  });

  it('produces markdown with headings, tables and nested lists from the main content only', () => {
    expect(page.markdown).toContain('# Shipping Information');
    expect(page.markdown).toContain('## United States');
    expect(page.markdown).toContain('Method | Cost');
    expect(page.markdown).toContain('Standard | $5.95');
    expect(page.markdown).toContain('- Free over $45');
    expect(page.markdown).toContain('- Before tax');
    expect(page.markdown).toContain('We roast on Mondays and ship the same day.');
    expect(page.markdown).toContain('Map of delivery zones');
  });

  it('drops navigation, footer, scripts, styles and cookie banners', () => {
    expect(page.markdown).not.toContain('Our Coffee');
    expect(page.markdown).not.toContain('alert');
    expect(page.markdown).not.toContain('color:red');
    expect(page.markdown).not.toContain('cookies');
    expect(page.markdown).not.toContain('2026');
  });

  it('collects absolute links (including nav) but skips mailto, fragments-only and rel=nofollow', () => {
    expect(page.links).toContain('https://shop.example/coffee');
    expect(page.links).toContain('https://shop.example/faq');
    expect(page.links).toContain('https://shop.example/returns');
    expect(page.links).toContain('https://shop.example/about');
    expect(page.links.some((l) => l.startsWith('mailto:'))).toBe(false);
    expect(page.links).not.toContain('https://other.example/x');
  });

  it('detects meta robots noindex/nofollow', () => {
    const p = extractHtml(
      '<html><head><meta name="robots" content="noindex, nofollow"></head><body><p>x</p></body></html>',
      'https://a.example/'
    );
    expect(p.noindex).toBe(true);
    expect(p.nofollow).toBe(true);
    expect(page.noindex).toBe(false);
  });

  it('falls back to body when there is no main element', () => {
    const p = extractHtml(
      '<html><body><div><h2>Hours</h2><p>Open 7am</p></div></body></html>',
      'https://a.example/'
    );
    expect(p.markdown).toBe('## Hours\n\nOpen 7am');
    expect(p.title).toBe('/');
  });
});
