/**
 * REGION-500A — region pages render per request instead of failing with
 * "Page changed from static to dynamic" (HTTP 500).
 *
 * REGION500A_PROVIDER is the server's PUBLIC_PROJECTION_PROVIDER:
 * - bootstrap: /region/british-columbia 200, unknown regions 404;
 * - api: no region projections, so every region is 404.
 *
 *   REGION500A_BASE_URL=https://staging.huws.org REGION500A_PROVIDER=bootstrap \
 *     PLAYWRIGHT_CHANNEL=chrome pnpm --filter @hu/web exec playwright test \
 *     -c playwright.config.ts src/features/region-500a-dynamic-route
 */
import { expect, test } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });

const baseUrl = process.env.REGION500A_BASE_URL?.trim().replace(/\/$/, "") ?? "";
const provider = process.env.REGION500A_PROVIDER?.trim() ?? "";
const cookieLocale = process.env.REGION500A_COOKIE_LOCALE?.trim() || "uk";

const KNOWN_REGION = "/region/british-columbia";
const UNKNOWN_REGION = "/region/ontario";
const expectedKnownStatus = provider === "bootstrap" ? 200 : 404;

test.describe("REGION-500A — region routes", () => {
  test.skip(
    !baseUrl || !["api", "bootstrap"].includes(provider),
    "set REGION500A_BASE_URL and REGION500A_PROVIDER=api|bootstrap",
  );

  test("known and unknown regions never return 500", async ({ request }) => {
    for (const [path, expected] of [
      [KNOWN_REGION, expectedKnownStatus],
      [UNKNOWN_REGION, 404],
      ["/region/california", 404],
    ] as const) {
      const response = await request.get(`${baseUrl}${path}`, { maxRedirects: 0 });
      expect(response.status(), path).toBe(expected);
      expect(response.headers()["cache-control"] ?? "", `${path} is rendered per request`).toMatch(
        /no-store/,
      );
    }
  });

  test("known region renders one main landmark without hydration errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(`${baseUrl}${KNOWN_REGION}`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(expectedKnownStatus);
    if (expectedKnownStatus === 200) {
      await expect(page.locator("main, [role='main']")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("British Columbia");
    }
    expect(errors.filter((text) => /#418|hydrat/i.test(text))).toEqual([]);
  });

  test("language cookie still sets the document language", async ({ browser }) => {
    const context = await browser.newContext();
    try {
      await context.addCookies([{ name: "hu_lang", value: cookieLocale, url: baseUrl }]);
      const page = await context.newPage();
      const response = await page.goto(`${baseUrl}${KNOWN_REGION}`);
      expect(response?.status()).toBe(expectedKnownStatus);
      await expect(page.locator("html")).toHaveAttribute("lang", cookieLocale);
    } finally {
      await context.close();
    }
  });
});
