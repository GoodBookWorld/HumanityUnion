/**
 * REGION-500B.3 — rendered region SEO, sitemap and accessibility checks.
 *
 * - REGION500B3_PROVIDER: the server's PUBLIC_PROJECTION_PROVIDER (api | bootstrap)
 * - REGION500B3_INDEXING: "allowed" (production mode) or "disallowed" (staging)
 * - REGION500B3_EXPECTED_ORIGIN: NEXT_PUBLIC_SITE_URL of the server
 *
 *   REGION500B3_BASE_URL=http://127.0.0.1:3000 REGION500B3_PROVIDER=api \
 *     REGION500B3_INDEXING=allowed REGION500B3_EXPECTED_ORIGIN=https://huws.org \
 *     PLAYWRIGHT_CHANNEL=chrome pnpm --filter @hu/web exec playwright test \
 *     -c playwright.config.ts src/features/region-500b3-seo-a11y
 */
import { expect, test, type APIRequestContext } from "@playwright/test";

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });

const baseUrl = process.env.REGION500B3_BASE_URL?.trim().replace(/\/$/, "") ?? "";
const provider = process.env.REGION500B3_PROVIDER?.trim() ?? "";
const indexing = process.env.REGION500B3_INDEXING?.trim() ?? "";
const origin = process.env.REGION500B3_EXPECTED_ORIGIN?.trim().replace(/\/$/, "") ?? "";
const configured =
  Boolean(baseUrl && origin) &&
  ["api", "bootstrap"].includes(provider) &&
  ["allowed", "disallowed"].includes(indexing);

const STAGING_ROBOTS = "noindex, nofollow, nocache";

async function head(request: APIRequestContext, path: string) {
  const response = await request.get(`${baseUrl}${path}`, { maxRedirects: 0 });
  const html = await response.text();
  const attr = (pattern: RegExp) => pattern.exec(html)?.[1];
  return {
    status: response.status(),
    title: attr(/<title>([^<]*)<\/title>/),
    robots: attr(/<meta name="robots" content="([^"]*)"/),
    canonical: attr(/<link rel="canonical" href="([^"]*)"/),
  };
}

test.describe("REGION-500B.3 — metadata and indexing", () => {
  test.skip(!configured, "set REGION500B3_BASE_URL, _PROVIDER, _INDEXING and _EXPECTED_ORIGIN");

  test("populated region has a title, canonical ISO URL and the right robots", async ({
    request,
  }) => {
    const meta = await head(request, "/region/CA-BC");
    expect(meta.status).toBe(200);
    expect(meta.title).toMatch(/^British Columbia, /);
    expect(meta.canonical).toBe(`${origin}/region/CA-BC`);
    const expected =
      indexing === "disallowed" || provider === "bootstrap" ? STAGING_ROBOTS : "index, follow";
    expect(meta.robots).toBe(expected);
  });

  test("legacy names redirect permanently; ambiguous and unknown names are 404", async ({
    request,
  }) => {
    for (const path of ["/region/british-columbia", "/region/ca-bc"]) {
      const response = await request.get(`${baseUrl}${path}`, { maxRedirects: 0 });
      expect(response.status(), path).toBe(308);
      expect(new URL(response.headers().location ?? "", baseUrl).pathname).toBe("/region/CA-BC");
    }
    for (const path of ["/region/punjab", "/region/unknown-region", "/region/ZZ-ZZ"]) {
      expect((await head(request, path)).status, path).toBe(404);
    }
  });
});

test.describe("REGION-500B.3 — API provider indexing", () => {
  test.skip(!configured || provider !== "api", "set REGION500B3_PROVIDER=api");

  test("empty region is canonical and noindex", async ({ request }) => {
    const meta = await head(request, "/region/CA-NU");
    expect(meta.status).toBe(200);
    expect(meta.title).toMatch(/^Nunavut, /);
    expect(meta.canonical).toBe(`${origin}/region/CA-NU`);
    expect(meta.robots).toBe(indexing === "disallowed" ? STAGING_ROBOTS : "noindex, follow");
  });

  test("sitemap lists populated canonical regions only", async ({ request }) => {
    const xml = await (await request.get(`${baseUrl}/sitemap.xml`)).text();
    const regions = [...xml.matchAll(/<loc>[^<]*\/region\/([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (indexing === "disallowed") {
      expect(regions).toEqual([]);
      return;
    }
    expect(regions).toContain("CA-BC");
    expect(regions).not.toContain("CA-NU");
    for (const code of regions) {
      expect(code).toMatch(/^[A-Z]{2}-[A-Z0-9]+$/);
      const meta = await head(request, `/region/${code}`);
      expect(meta.robots, code).toBe("index, follow");
    }
  });
});

test.describe("REGION-500B.3 — accessibility and messages", () => {
  test.skip(!configured, "set REGION500B3_BASE_URL, _PROVIDER, _INDEXING and _EXPECTED_ORIGIN");

  test("region page has one main, readable navigator label and no missing messages", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`${baseUrl}/region/CA-BC`, { waitUntil: "networkidle" });
    await expect(page.locator("main, [role='main']")).toHaveCount(1);
    expect(await page.title()).toMatch(/^British Columbia, /);
    await expect(page.locator("body")).not.toContainText(/publicGeo\.region\./);
    expect(errors.filter((text) => /MISSING_MESSAGE|#418|hydrat/i.test(text))).toEqual([]);
    const labelColor = await page
      .locator(".geographic-navigator__label")
      .evaluate((node) => getComputedStyle(node).color);
    expect(labelColor).toBe("rgb(95, 107, 122)");
  });

  test("bootstrap map sub-area buttons are named by their visible text", async ({ page }) => {
    test.skip(provider !== "bootstrap", "map exists only for bootstrap data");
    await page.goto(`${baseUrl}/region/CA-BC`);
    const buttons = page.locator(".regional-interactive-map__subregion-button");
    expect(await buttons.count()).toBeGreaterThan(0);
    for (const button of await buttons.all()) {
      const text = (await button.innerText()).trim();
      await expect(button).toHaveAccessibleName(text);
    }
  });
});
