// Renders fixtures/northwind/wholesale-guide.html to a PDF with headless Chromium.
// The generated PDF is committed so tests do not need a browser. Usage: pnpm fixture:pdf
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const src = path.resolve('fixtures/northwind/wholesale-guide.html');
const out = path.resolve('fixtures/northwind/northwind-wholesale-guide.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(src).toString());
await page.pdf({ path: out, format: 'Letter', printBackground: true });
await browser.close();
console.log(`Wrote ${out}`);
