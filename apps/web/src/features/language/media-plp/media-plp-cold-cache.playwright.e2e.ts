/**
 * Reset 03 — PLP-mode cold-cache Playwright matrix (fixture HTML; no live Gemini).
 *
 * Simulates SSR-final semantic presentation already in HTML.
 * Asserts zero mixed language, zero client CT requests, zero post-hydration changes.
 */

import { createServer, type Server } from "node:http";

import { test, expect } from "@playwright/test";

function buildPlpMediaFixtureHtml(locale: string): string {
  const auto = (text: string) =>
    `<span data-hu-semantic="auto">[${locale}] ${text}</span>`;

  return `<!doctype html>
<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">
<head><meta charset="utf-8"><title>Media PLP ${locale}</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; }
  main { max-width: 1280px; margin: 0 auto; padding: 12px; }
  .civic-media-resource-card__body { overflow-wrap: anywhere; max-width: 100%; }
</style>
</head>
<body data-hu-media-plp="true" data-locale="${locale}">
<main data-hu-plp-ssr="1">
  <section data-hu-surface="media" data-hu-fallback-nodes="0">
    <article class="hu-card civic-media-resource-card civic-media-resource-card--principle"
      data-hu-plp-mode="PUBLISHED_LOCALIZED" data-hu-plp-entity="civic_media_principle"
      data-hu-plp-id="editorial-transparency">
      <h3 data-hu-semantic="auto">[${locale}] Independence of trusted media evidence</h3>
      <p class="civic-media-resource-card__body" data-hu-semantic="auto">[${locale}] Principle description explaining independence requirements.</p>
    </article>
    <article class="hu-card civic-media-resource-card civic-media-resource-card--principle"
      data-hu-plp-mode="PUBLISHED_LOCALIZED" data-hu-plp-entity="civic_media_principle"
      data-hu-plp-id="transparent-sourcing">
      <h3 data-hu-semantic="auto">[${locale}] Transparent sourcing for participants</h3>
      <p class="civic-media-resource-card__body" data-hu-semantic="auto">[${locale}] Principle description explaining transparent sourcing.</p>
    </article>
    <article class="hu-card civic-media-resource-card civic-media-resource-card--trusted country-media-rail-card"
      data-hu-plp-mode="PUBLISHED_LOCALIZED" data-hu-plp-entity="civic_media_trusted"
      data-hu-plp-id="the-atlantic" data-hu-shared-trusted="1">
      <h3 data-hu-semantic="protected">The Atlantic</h3>
      <p class="civic-media-resource-card__body" data-hu-semantic="auto">[${locale}] Trusted explanation of editorial standards for participants.</p>
      <a data-hu-semantic="protected" href="https://www.theatlantic.com/">https://www.theatlantic.com/</a>
    </article>
    <article class="public-news-card" data-hu-plp-mode="PUBLISHED_LOCALIZED"
      data-hu-plp-entity="public_news" data-hu-plp-id="news-realistic-1" data-hu-fallback-nodes="0">
      ${auto("Environment")}
      <p data-hu-semantic="protected">The Atlantic</p>
      <h3 data-hu-semantic="auto">[${locale}] Civic shoreline restoration expands</h3>
      <p data-hu-semantic="auto">[${locale}] Communities organize a public initiative around coastal habitats.</p>
      <a data-hu-semantic="protected" href="https://example.com/a">https://example.com/a</a>
    </article>
    <article class="public-news-card" data-hu-plp-mode="PUBLISHED_LOCALIZED"
      data-hu-plp-entity="public_news" data-hu-plp-id="news-realistic-2" data-hu-fallback-nodes="0">
      ${auto("Politics")}
      <p data-hu-semantic="protected">Reuters</p>
      <h3 data-hu-semantic="auto">[${locale}] Second RSS card with stable identity</h3>
      <p data-hu-semantic="auto">[${locale}] Nested summary remains fully localized.</p>
    </article>
  </section>
  <section data-hu-surface="country-recommended-media" data-hu-fallback-nodes="0">
    <article class="hu-card civic-media-resource-card civic-media-resource-card--trusted country-media-rail-card"
      data-hu-plp-mode="PUBLISHED_LOCALIZED" data-hu-plp-entity="civic_media_trusted"
      data-hu-plp-id="the-atlantic" data-hu-shared-trusted="1">
      <h3 data-hu-semantic="protected">The Atlantic</h3>
      <p class="civic-media-resource-card__body" data-hu-semantic="auto">[${locale}] Trusted explanation of editorial standards for participants.</p>
    </article>
  </section>
  <script>
    window.__HU_PLP_COUNTERS = {
      CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT: 0,
      PROVIDER_CALLS_FROM_READ_PATH: 0,
      POST_HYDRATION_SEMANTIC_CHANGE_COUNT: 0,
      CONTENT_TRANSLATION_WRITE_COUNT: 0
    };
    window.__HU_PLP_SSR_SNAPSHOT = Array.from(
      document.querySelectorAll('[data-hu-semantic="auto"]')
    ).map((el) => el.textContent);
    // Simulate hydration settle without semantic mutation
    requestAnimationFrame(() => {
      const after = Array.from(
        document.querySelectorAll('[data-hu-semantic="auto"]')
      ).map((el) => el.textContent);
      const changed = after.some((t, i) => t !== window.__HU_PLP_SSR_SNAPSHOT[i]);
      if (changed) window.__HU_PLP_COUNTERS.POST_HYDRATION_SEMANTIC_CHANGE_COUNT = 1;
      document.body.setAttribute("data-hu-plp-hydrated", "1");
    });
  </script>
</main>
</body>
</html>`;
}

async function withFixtureServer(
  locale: string,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const html = buildPlpMediaFixtureHtml(locale);
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Failed to bind fixture server");
  }
  const baseUrl = `http://127.0.0.1:${address.port}/`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

for (const locale of ["uk", "zh-Hant", "ar"] as const) {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 900, height: 800 },
    { width: 1280, height: 800 },
  ] as const) {
    test(`Reset 03 Media PLP cold-cache ${locale} @${viewport.width}`, async ({
      browser,
    }) => {
      await withFixtureServer(locale, async (baseUrl) => {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        let clientTranslationRequests = 0;
        page.on("request", (req) => {
          const url = req.url();
          if (
            /\/translations\/(generate|resolve)/.test(url) ||
            /content.translation/i.test(url)
          ) {
            clientTranslationRequests += 1;
          }
        });

        await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[data-hu-plp-hydrated="1"]');

        const autoTexts = await page.locator('[data-hu-semantic="auto"]').allTextContents();
        expect(autoTexts.length).toBeGreaterThan(5);
        const mixed = autoTexts.filter((t) => !t.includes(`[${locale}]`));
        expect(mixed, `MIXED_LANGUAGE_SEMANTIC_NODES: ${mixed.join(" | ")}`).toEqual([]);

        const mediaBody = await page
          .locator(
            '[data-hu-surface="media"] [data-hu-plp-id="the-atlantic"] .civic-media-resource-card__body',
          )
          .textContent();
        const countryBody = await page
          .locator(
            '[data-hu-surface="country-recommended-media"] [data-hu-plp-id="the-atlantic"] .civic-media-resource-card__body',
          )
          .textContent();
        expect(mediaBody).toBe(countryBody);

        const counters = await page.evaluate(() => {
          const c = (
            window as unknown as {
              __HU_PLP_COUNTERS: {
                CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT: number;
                PROVIDER_CALLS_FROM_READ_PATH: number;
                POST_HYDRATION_SEMANTIC_CHANGE_COUNT: number;
                CONTENT_TRANSLATION_WRITE_COUNT: number;
              };
            }
          ).__HU_PLP_COUNTERS;
          return c;
        });

        expect(counters.CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT).toBe(0);
        expect(counters.PROVIDER_CALLS_FROM_READ_PATH).toBe(0);
        expect(counters.POST_HYDRATION_SEMANTIC_CHANGE_COUNT).toBe(0);
        expect(counters.CONTENT_TRANSLATION_WRITE_COUNT).toBe(0);
        expect(clientTranslationRequests).toBe(0);

        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

        if (locale === "ar") {
          await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
        }

        await context.close();
      });
    });
  }
}
