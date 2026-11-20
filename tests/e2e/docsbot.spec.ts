import { writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const email = `e2e-${Date.now()}@example.com`;
const password = "e2e-password-123";
let botId = "";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");
}

test("visitor signs up and creates a bot", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your docs, answering customers");
  await page.getByRole("link", { name: "Get started" }).first().click();
  await page.fill("#name", "E2E Tester");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByText("No bots yet")).toBeVisible();

  await page.getByPlaceholder(/Bot name/).fill("Northwind Support");
  await page.getByRole("button", { name: "New bot" }).click();
  await page.waitForURL(/\/dashboard\/bots\/[0-9a-f-]{36}\/sources/);
  botId = page.url().match(/bots\/([0-9a-f-]{36})/)![1]!;
  await expect(page.getByRole("heading", { name: "Northwind Support" })).toBeVisible();
});

test("ingests the website and a PDF with visible status", async ({ page }) => {
  await login(page);
  await page.goto(`/dashboard/bots/${botId}/sources`);
  await page.fill("#url", "http://localhost:3101");
  await page.fill("#maxPages", "30");
  await page.getByRole("button", { name: "Crawl website" }).click();
  await expect(page.getByText("Website queued for crawling")).toBeVisible();

  await page.getByRole("tab", { name: "PDF" }).click();
  await page.setInputFiles("#file", path.resolve("fixtures/northwind/northwind-wholesale-guide.pdf"));
  await page.getByRole("button", { name: "Upload PDF" }).click();
  await expect(page.getByText("PDF uploaded and queued")).toBeVisible();

  const rows = page.getByTestId("source-row");
  await expect(rows).toHaveCount(2);
  await expect(page.locator('[data-testid="source-row"][data-status="ready"]')).toHaveCount(2, { timeout: 150_000 });
  await expect(page.getByText(/14 pages · \d+ chunks/)).toBeVisible();
  await expect(page.getByText(/3 pages · 3 chunks/)).toBeVisible();
});

test("answers in the playground with citations and captures a lead when it can't answer", async ({ page }) => {
  await login(page);
  await page.goto(`/dashboard/bots/${botId}/playground`);
  const chat = page.frameLocator('[data-testid="playground-frame"]');

  await chat.locator("textarea").fill("How much does shipping to Canada cost?");
  await chat.locator("textarea").press("Enter");
  const answer = chat.locator(".msg.assistant").nth(1);
  await expect(answer.locator(".sources")).toBeVisible({ timeout: 60_000 });
  await expect(answer).toContainText("16");
  await expect(answer.locator('a.source[href$="/shipping"]')).toBeVisible();
  await expect(answer.locator("a.cite").first()).toHaveAttribute("href", /\/shipping$/);

  await chat.locator("textarea").fill("Do you offer a student discount?");
  await chat.locator("textarea").press("Enter");
  const lead = chat.locator("form.lead");
  await expect(lead).toBeVisible({ timeout: 60_000 });
  await expect(chat.locator(".msg.assistant").nth(2)).toContainText("couldn't find");
  await lead.locator('input[name="email"]').fill("student@example.com");
  await lead.getByRole("button", { name: "Send to team" }).click();
  await expect(chat.getByText("Thanks! The team will get back to you by email.")).toBeVisible();

  await page.goto(`/dashboard/bots/${botId}/leads`);
  await expect(page.getByTestId("leads-table")).toContainText("student@example.com");
  await expect(page.getByTestId("leads-table")).toContainText("student discount");

  await page.goto(`/dashboard/bots/${botId}/conversations`);
  await expect(page.getByRole("link", { name: "How much does shipping to Canada cost?" })).toBeVisible();
});

test("embeds the widget on an allowed external site and blocks other origins", async ({ page, browser }) => {
  await login(page);
  await page.goto(`/dashboard/bots/${botId}/settings`);
  await page.fill("#allowedDomains", "localhost:3101");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();

  await page.goto(`/dashboard/bots/${botId}/install`);
  await expect(page.getByTestId("embed-snippet")).toContainText(`data-bot-id="${botId}"`);
  // "Paste" the snippet into the external site (the fixture server injects it from this file).
  writeFileSync(path.resolve(".data/e2e-widget.json"), JSON.stringify({ appUrl: "http://localhost:3100", botId }));

  const visitor = await browser.newContext(); // a fresh visitor without dashboard cookies
  const site = await visitor.newPage();
  await site.goto("http://localhost:3101/faq");
  await site.locator("[data-docsbot] .bubble").click();
  const widget = site.frameLocator("[data-docsbot] iframe");
  await expect(widget.locator(".head")).toContainText("Northwind Support");
  await widget.locator("textarea").fill("Which payment methods do you accept? Is PayPal one of them?");
  await widget.locator("textarea").press("Enter");
  const reply = widget.locator(".msg.assistant").nth(1);
  await expect(reply.locator(".sources")).toBeVisible({ timeout: 60_000 });
  await expect(reply).toContainText(/PayPal/i);
  await expect(reply.locator('a.source[href$="/faq"]')).toBeVisible();

  // Same page served from a different origin is not on the allow-list: no widget.
  const other = await visitor.newPage();
  const warnings: string[] = [];
  other.on("console", (m) => warnings.push(m.text()));
  await other.goto("http://127.0.0.1:3101/faq");
  await expect.poll(() => warnings.some((w) => w.includes("not enabled for http://127.0.0.1:3101"))).toBe(true);
  await expect(other.locator("[data-docsbot]")).toHaveCount(0);
  await visitor.close();

  // The visitor conversation shows up in the dashboard with its page origin.
  await page.goto(`/dashboard/bots/${botId}/conversations`);
  await expect(page.getByText("http://localhost:3101")).toBeVisible();
  await page.goto(`/dashboard/bots/${botId}`);
  await expect(page.getByText("Unanswered questions")).toBeVisible();
  await expect(page.getByRole("link", { name: "Do you offer a student discount?" })).toBeVisible();
});
