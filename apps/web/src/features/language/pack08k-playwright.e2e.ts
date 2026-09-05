/**
 * Pack 08K — Playwright browser E2E against a fixture HTML page.
 *
 * Serves deterministic PublicLocalizedPresentation markup (no live Gemini)
 * and asserts AUTO_TRANSLATABLE nodes are localized for uk / zh-Hant / ar.
 */

import { createServer, type Server } from "node:http";

import { test, expect } from "@playwright/test";

function buildFixtureHtml(locale: string): string {
  const posts = [
    { id: "b1", title: `[${locale}] Short title`, body: `[${locale}] Short body` },
    { id: "b2", title: `[${locale}] Multi title`, body: `[${locale}] P1` },
    { id: "b3", title: `[${locale}] Nested title`, body: `[${locale}] Nested heading` },
    { id: "b4", title: `[${locale}] Author post`, body: `[${locale}] Body with author` },
    { id: "b5", title: `[${locale}] URL post`, body: `[${locale}] Prose with link` },
  ];
  const petitionParagraphs = [1, 2, 3, 4, 5].map(
    (n) => `<p data-hu-semantic="auto">[${locale}] Petition paragraph ${n}</p>`,
  );
  const media = `
    <section data-hu-route="media" data-hu-fallback-nodes="0">
      <article data-hu-surface="civic-media-resource-card--principle" class="hu-card civic-media-resource-card civic-media-resource-card--principle">
        <h3 data-hu-semantic="auto">[${locale}] Independence of trusted media evidence</h3>
        <p data-hu-semantic="auto">[${locale}] Principle description explaining independence requirements.</p>
      </article>
      <article data-hu-surface="civic-media-resource-card--principle" class="hu-card civic-media-resource-card civic-media-resource-card--principle">
        <h3 data-hu-semantic="auto">[${locale}] Transparent sourcing for participants</h3>
        <p data-hu-semantic="auto">[${locale}] Principle description explaining transparent sourcing.</p>
      </article>
      <article data-hu-surface="civic-media-resource-card--trusted" class="hu-card civic-media-resource-card civic-media-resource-card--trusted country-media-rail-card">
        <h3 data-hu-semantic="protected">The Atlantic</h3>
        <p data-hu-semantic="ui">Coverage: [${locale}] United States</p>
        <p data-hu-semantic="auto">[${locale}] Trusted explanation of editorial standards for participants.</p>
        <a data-hu-semantic="protected" href="https://www.theatlantic.com/">https://www.theatlantic.com/</a>
      </article>
      <article data-hu-surface="country-media-rail-card" class="hu-card civic-media-resource-card civic-media-resource-card--trusted country-media-rail-card">
        <h3 data-hu-semantic="protected">Reuters</h3>
        <p data-hu-semantic="auto">[${locale}] Country-rail trusted explanation for local participants.</p>
      </article>
      <article data-hu-surface="public-news-card" class="public-news-card" data-hu-fallback-nodes="0"
        data-news-payload='{"id":"news-realistic-1","sourceName":"The Atlantic","title":"Civic shoreline","summary":"Communities organize","category":"Environment","language":"en"}'>
        <span data-hu-semantic="auto">[${locale}] Environment</span>
        <p data-hu-semantic="protected">The Atlantic</p>
        <h3 data-hu-semantic="auto">[${locale}] Civic shoreline restoration expands</h3>
        <p data-hu-semantic="auto">[${locale}] Communities organize a public initiative around coastal habitats.</p>
        <a data-hu-semantic="protected" href="https://example.com/a">https://example.com/a</a>
      </article>
    </section>`;

  const blog = posts
    .map(
      (p) => `
      <article data-hu-surface="blog" data-post-id="${p.id}">
        <h2 data-hu-semantic="auto">${p.title}</h2>
        <p data-hu-semantic="auto">${p.body}</p>
        <span data-hu-semantic="protected">Ada Lovelace</span>
      </article>`,
    )
    .join("\n");

  const countryHero = `
    <section data-hu-surface="country-hero" class="country-experience-dynamic__hero-copy">
      <h1 data-hu-semantic="auto">[${locale}] Canada</h1>
      <p data-hu-semantic="auto">[${locale}] Americas · [${locale}] Northern America</p>
      <span data-hu-semantic="protected">CA</span>
    </section>
    <section data-hu-surface="region-display">
      <p data-hu-semantic="auto">[${locale}] British Columbia</p>
      <span data-hu-semantic="protected">CA-BC</span>
    </section>`;

  const newsCards = ["media-route", "country-route"]
    .map(
      (route) => `
      <article data-hu-surface="public-news-card" data-news-route="${route}" class="public-news-card"
        data-hu-fallback-nodes="0">
        <span data-hu-semantic="auto">[${locale}] Environment</span>
        <p data-hu-semantic="protected">The Atlantic</p>
        <h3 data-hu-semantic="auto">[${locale}] News headline for ${route}</h3>
        <p data-hu-semantic="auto">[${locale}] News summary for ${route}</p>
        <a data-hu-semantic="protected" href="https://example.com/a">https://example.com/a</a>
      </article>`,
    )
    .join("\n");

  const actuc = `
    <div data-hu-surface="actuc-modal" class="actuc-modal__dialog" data-open="true">
      <button data-hu-semantic="ui">${locale === "en" ? "Close" : `[${locale}] Close`}</button>
      <h2 data-hu-semantic="ui">[${locale}] ACTUC title</h2>
      <p data-hu-semantic="ui">[${locale}] ACTUC subtitle</p>
      <a data-hu-semantic="protected" href="https://actuc.com/">https://actuc.com/</a>
    </div>`;

  // Pack 08K.3.3 — Home interactive map shell + tooltip (modal/popover stand-in).
  const homeMap = `
    <section data-hu-surface="home-interactive-map" data-hu-fallback-nodes="0">
      <div role="toolbar" data-hu-semantic="ui" aria-label="[${locale}] Map view">
        <button type="button" data-hu-semantic="ui">[${locale}] Zoom in</button>
        <button type="button" data-hu-semantic="ui">[${locale}] Zoom out</button>
        <button type="button" data-hu-semantic="ui">[${locale}] Reset</button>
      </div>
      <p data-hu-semantic="ui">[${locale}] Use Zoom in to explore regions.</p>
      <label data-hu-semantic="ui">[${locale}] Explore civic activity by country</label>
      <select data-hu-semantic="ui">
        <option value="">[${locale}] Select a country</option>
        <option value="CA" data-hu-semantic="auto" data-hu-geo="country">[${locale}] Canada</option>
        <option value="UA" data-hu-semantic="auto" data-hu-geo="country">[${locale}] Ukraine</option>
      </select>
      <div data-hu-surface="home-map-tooltip" role="tooltip" data-open="true" data-hu-fallback-nodes="0">
        <b data-hu-semantic="auto" data-hu-geo="country">[${locale}] Canada</b>
        <span data-hu-semantic="protected">CA</span>
      </div>
    </section>
    <section data-hu-surface="country-recommended-media" data-hu-fallback-nodes="0">
      <article class="hu-card civic-media-resource-card civic-media-resource-card--trusted country-media-rail-card">
        <h3 data-hu-semantic="protected">The Atlantic</h3>
        <p class="civic-media-resource-card__body" data-hu-semantic="auto">[${locale}] Trusted explanation of editorial standards for participants.</p>
      </article>
    </section>`;

  return `<!doctype html>
<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">
<head><meta charset="utf-8"><title>Pack 08K Fixture ${locale}</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; }
  main { max-width: 1280px; margin: 0 auto; padding: 12px; }
  .public-news-card, .actuc-modal__dialog, .country-experience-dynamic__hero-copy,
  .civic-media-resource-card__body, [data-hu-surface="home-map-tooltip"] {
    overflow-wrap: anywhere; min-width: 0; max-width: 100%;
  }
</style>
</head>
<body data-viewport="1280" data-locale="${locale}">
  <main>
    ${countryHero}
    ${homeMap}
    <section data-hu-surface="blog-list">${blog}</section>
    <section data-hu-surface="petition">
      <h2 data-hu-semantic="auto">[${locale}] Petition title</h2>
      ${petitionParagraphs.join("\n")}
    </section>
    <section data-hu-surface="discussion">
      <p data-hu-semantic="auto">[${locale}] Comment body one</p>
      <p data-hu-semantic="auto">[${locale}] Comment body two</p>
      <span data-hu-semantic="protected">Bob Author</span>
    </section>
    <section data-hu-surface="ca">
      <h2 data-hu-semantic="auto">[${locale}] CA title</h2>
      <p data-hu-semantic="auto">[${locale}] CA section paragraph</p>
    </section>
    <section data-hu-surface="media">${media}</section>
    <section data-hu-surface="public-news">${newsCards}</section>
    ${actuc}
    <section data-hu-surface="knowledge">
      <h1 data-hu-semantic="auto">[${locale}] Knowledge title</h1>
      <p data-hu-semantic="auto">[${locale}] Knowledge overview</p>
    </section>
    <section data-hu-surface="search">
      <a data-hu-semantic="auto">[${locale}] Search result title</a>
      <p data-hu-semantic="auto">[${locale}] Search snippet</p>
    </section>
    <section data-hu-surface="related-rail">
      <a data-hu-semantic="auto">[${locale}] Related initiative</a>
    </section>
  </main>
</body>
</html>`;
}

async function withFixtureServer(
  locale: string,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const html = buildFixtureHtml(locale);
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
    test(`Pack 08K browser ${locale} @${viewport.width}: zero canonical AUTO leaks`, async ({
      browser,
    }) => {
      await withFixtureServer(locale, async (baseUrl) => {
        const page = await browser.newPage({ viewport });
        await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

        const autoTexts = await page.locator('[data-hu-semantic="auto"]').allTextContents();
        expect(autoTexts.length).toBeGreaterThan(10);

        const canonicalFallback = autoTexts.filter((t) => !t.includes(`[${locale}]`));
        expect(canonicalFallback, `unexpected English AUTO nodes: ${canonicalFallback.join(" | ")}`).toEqual(
          [],
        );

        const protectedTexts = await page
          .locator('[data-hu-semantic="protected"]')
          .allTextContents();
        expect(protectedTexts.join(" ")).toMatch(
          /Ada Lovelace|The Atlantic|Bob Author|theatlantic|CA|actuc\.com/,
        );

        const newsCards = page.locator('[data-hu-surface="public-news-card"]');
        expect(await newsCards.count()).toBeGreaterThanOrEqual(2);
        expect(await page.locator('[data-hu-surface="country-hero"]').count()).toBe(1);
        expect(await page.locator('[data-hu-surface="actuc-modal"]').count()).toBe(1);
        expect(await page.locator('[data-hu-surface="region-display"]').count()).toBe(1);
        expect(
          await page.locator('[data-hu-surface="civic-media-resource-card--principle"]').count(),
        ).toBeGreaterThanOrEqual(2);
        expect(
          await page.locator('[data-hu-surface="civic-media-resource-card--trusted"]').count(),
        ).toBeGreaterThanOrEqual(1);
        expect(
          await page.locator('[data-hu-surface="country-media-rail-card"]').count(),
        ).toBeGreaterThanOrEqual(1);

        // Pack 08K.3.3 — Home map + country Recommended Media
        expect(await page.locator('[data-hu-surface="home-interactive-map"]').count()).toBe(1);
        expect(await page.locator('[data-hu-surface="home-map-tooltip"]').count()).toBe(1);
        expect(
          await page.locator('[data-hu-surface="country-recommended-media"]').count(),
        ).toBe(1);
        const mapGeo = await page
          .locator('[data-hu-surface="home-interactive-map"] [data-hu-geo="country"]')
          .allTextContents();
        expect(mapGeo.every((t) => t.includes(`[${locale}]`))).toBe(true);
        const countryMediaBody = await page
          .locator(
            '[data-hu-surface="country-recommended-media"] .civic-media-resource-card__body',
          )
          .textContent();
        expect(countryMediaBody ?? "").toContain(`[${locale}]`);

        const fallbackAttrs = await page.locator("[data-hu-fallback-nodes]").evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-hu-fallback-nodes")),
        );
        expect(fallbackAttrs.every((v) => v === "0")).toBe(true);

        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

        if (locale === "ar") {
          await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
          const tooltipBox = await page
            .locator('[data-hu-surface="home-map-tooltip"]')
            .boundingBox();
          expect(tooltipBox).not.toBeNull();
        }

        await page.close();
      });
    });
  }
}
