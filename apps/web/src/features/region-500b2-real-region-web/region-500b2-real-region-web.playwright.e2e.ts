/**
 * REGION-500B.2 — rendered region pages by projection provider.
 *
 * REGION500B2_PROVIDER is the server's PUBLIC_PROJECTION_PROVIDER:
 * - api: real projections — every registry region renders (empty regions too);
 * - bootstrap: only the British Columbia demonstration page renders.
 *
 *   REGION500B2_BASE_URL=http://127.0.0.1:3000 REGION500B2_PROVIDER=api \
 *     PLAYWRIGHT_CHANNEL=chrome pnpm --filter @hu/web exec playwright test \
 *     -c playwright.config.ts src/features/region-500b2-real-region-web
 */
import { expect, test, type Page } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });

const baseUrl = process.env.REGION500B2_BASE_URL?.trim().replace(/\/$/, "") ?? "";
const provider = process.env.REGION500B2_PROVIDER?.trim() ?? "";

const DEMONSTRATION_TEXT = /Bootstrap demonstration data|Demonstration card|initiative-bootstrap/i;

async function openRegion(page: Page, path: string) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  return { response, errors };
}

test.describe("REGION-500B.2 — redirects and not found", () => {
  test.skip(
    !baseUrl || !["api", "bootstrap"].includes(provider),
    "set REGION500B2_BASE_URL and REGION500B2_PROVIDER",
  );

  test("legacy names and other casings redirect once to the ISO code", async ({ request }) => {
    for (const [path, target] of [
      ["/region/british-columbia", "/region/CA-BC"],
      ["/region/ca-bc", "/region/CA-BC"],
      ["/region/california", "/region/US-CA"],
    ] as const) {
      const response = await request.get(`${baseUrl}${path}`, { maxRedirects: 0 });
      expect([307, 308], path).toContain(response.status());
      expect(new URL(response.headers().location ?? "", baseUrl).pathname, path).toBe(target);
    }
  });

  test("unknown and ambiguous regions are not found", async ({ request }) => {
    for (const path of ["/region/ZZ-ZZ", "/region/atlantis", "/region/punjab", "/region/CA-ZZ"]) {
      const response = await request.get(`${baseUrl}${path}`, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
    }
  });
});

test.describe("REGION-500B.2 — API provider", () => {
  test.skip(!baseUrl || provider !== "api", "set REGION500B2_PROVIDER=api");

  test("CA-BC renders the real projection without demonstration content", async ({ page }) => {
    const { response, errors } = await openRegion(page, "/region/CA-BC");
    expect(response?.status()).toBe(200);
    await expect(page.locator("main, [role='main']")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("British Columbia");
    await expect(page.locator("#regional-interactive-map")).toHaveCount(0);
    await expect(page.locator("#regional-statistics")).toBeVisible();
    await expect(page.locator("#regional-participation-pipeline")).toBeVisible();
    await expect(page.locator("#community-discovery")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(DEMONSTRATION_TEXT);
    await expect(page.locator("body")).not.toContainText(/publicGeo\.region\./);
    const cards = page.locator(".latest-initiative-card");
    for (const card of await cards.all()) {
      await expect(card.locator("a[href^='/initiatives/public/']").first()).toBeVisible();
    }
    expect(errors.filter((text) => /#418|hydrat/i.test(text))).toEqual([]);
  });

  test("CA-NU renders a valid empty region", async ({ page }) => {
    const { response } = await openRegion(page, "/region/CA-NU");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nunavut");
    await expect(page.locator(".latest-initiative-card")).toHaveCount(0);
    await expect(page.locator(".latest-global-initiatives__empty")).toBeVisible();
    await expect(page.locator(".community-discovery__empty")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(DEMONSTRATION_TEXT);
  });

  test("US-CA resolves to California", async ({ page }) => {
    const { response } = await openRegion(page, "/region/US-CA");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("California");
  });

  test("statistics and pipeline use catalog labels in Ukrainian", async ({ browser }) => {
    const context = await browser.newContext();
    try {
      await context.addCookies([{ name: "hu_lang", value: "uk", url: baseUrl }]);
      const page = await context.newPage();
      await page.goto(`${baseUrl}/region/CA-BC`);
      await expect(page.locator("html")).toHaveAttribute("lang", "uk");
      await expect(page.locator("#regional-statistics")).toContainText("Ініціативи");
      await expect(page.locator("#regional-participation-pipeline")).toContainText(
        "Спільний аналіз",
      );
      await expect(page.locator(".geographic-navigator")).toContainText("Канада");
    } finally {
      await context.close();
    }
  });

  test("community links lead to existing pages", async ({ page, request }) => {
    await openRegion(page, "/region/CA-BC");
    for (const href of await page
      .locator(".community-discovery__title a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""))) {
      const response = await request.get(`${baseUrl}${href}`);
      expect(response.status(), href).toBe(200);
    }
  });
});

test.describe("REGION-500B.2 — bootstrap provider", () => {
  test.skip(!baseUrl || provider !== "bootstrap", "set REGION500B2_PROVIDER=bootstrap");

  test("British Columbia demonstration page still renders at its ISO code", async ({ page }) => {
    const { response, errors } = await openRegion(page, "/region/CA-BC");
    expect(response?.status()).toBe(200);
    await expect(page.locator("main, [role='main']")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("British Columbia");
    await expect(page.locator("#regional-interactive-map")).toHaveCount(1);
    await expect(page.locator("body")).toContainText("Bootstrap demonstration data");
    expect(errors.filter((text) => /#418|hydrat/i.test(text))).toEqual([]);
  });

  test("regions without bootstrap data are not found", async ({ request }) => {
    const response = await request.get(`${baseUrl}/region/CA-ON`, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  });
});
