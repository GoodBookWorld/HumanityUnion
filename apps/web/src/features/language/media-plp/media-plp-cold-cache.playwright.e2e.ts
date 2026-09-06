/**
 * Reset 03C.1 — realistic Media structural fixture (all major sections).
 * Localized + canonical-fallback entities coexist; missing PLP ≠ missing content.
 */

import { createServer, type Server } from "node:http";

import { test, expect } from "@playwright/test";

import { MEDIA_PAGE_MAJOR_SECTION_IDS } from "./media-page-structure";

function buildRealisticMediaFixtureHtml(locale: string): string {
  const localized = (text: string) => `[${locale}] ${text}`;
  const dir = locale === "ar" ? "rtl" : "ltr";

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><title>Media structural ${locale}</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; }
  .humanity-layout { display: flex; min-height: 100vh; flex-direction: column; }
  .humanity-layout__main { flex: 1; width: 100%; }
  .civic-media-page__container { max-width: 1280px; margin: 0 auto; padding: 12px; }
  section { margin: 1.5rem 0; }
  .civic-media-resource-card__body { overflow-wrap: anywhere; max-width: 100%; }
  footer { padding: 1rem; border-top: 1px solid #ccc; }
</style>
</head>
<body>
<div class="humanity-layout">
  <header>Header</header>
  <main class="humanity-layout__main civic-media-page" data-hu-media-plp="true" data-hu-media-renderer="shared" data-hu-plp-ssr="1" data-hu-semantic-unowned="0">
    <div class="civic-media-page__container">
      <section id="overview" class="civic-media-page__hero">
        <p class="civic-media-page__eyebrow">Civic Media</p>
        <h1>Media page title</h1>
        <h2>Overview title</h2>
        <p>Overview summary remains present without PLP.</p>
        <div class="civic-media-page__hero-grid">
          <article class="hu-card civic-media-resource-card--hero"><h2>Point 1</h2><p>Body 1</p></article>
          <article class="hu-card civic-media-resource-card--hero"><h2>Point 2</h2><p>Body 2</p></article>
        </div>
      </section>

      <section id="initiative-flow" data-section="initiative-flow">
        <h2>Initiative flow</h2>
        <p>Pipeline stages remain present.</p>
      </section>

      <section id="news-widgets" data-section="news-widgets">
        <h2>News</h2>
        <article class="public-news-card"><p data-hu-semantic="auto">${localized("News title")}</p></article>
      </section>

      <section id="selection-principles" data-section="selection-principles">
        <h2>Selection principles</h2>
        <article class="hu-card civic-media-resource-card--principle"
          data-hu-plp-mode="CANONICAL_FALLBACK" data-hu-plp-entity="civic_media_principle"
          data-hu-plp-id="editorial-transparency" data-hu-fallback-nodes="all">
          <h3 data-hu-semantic="auto">Independence of trusted media evidence</h3>
          <p class="civic-media-resource-card__body" data-hu-semantic="auto">Principle description explaining independence requirements.</p>
        </article>
        <article class="hu-card civic-media-resource-card--principle"
          data-hu-plp-mode="CANONICAL_FALLBACK" data-hu-plp-entity="civic_media_principle"
          data-hu-plp-id="transparent-sourcing" data-hu-fallback-nodes="all">
          <h3 data-hu-semantic="auto">Transparent sourcing for participants</h3>
          <p class="civic-media-resource-card__body" data-hu-semantic="auto">Principle description explaining transparent sourcing.</p>
        </article>
      </section>

      <section id="trusted-media" data-section="trusted-media">
        <h2>Trusted media</h2>
        <div data-hu-control="trusted-media-tabs">Category tabs</div>
        <article class="hu-card civic-media-resource-card--trusted country-media-rail-card"
          data-hu-plp-mode="PUBLISHED_LOCALIZED" data-hu-plp-entity="civic_media_trusted"
          data-hu-plp-id="reuters" data-hu-shared-trusted="1" data-hu-fallback-nodes="0">
          <h3 data-hu-semantic="protected">Reuters</h3>
          <p class="civic-media-resource-card__body" data-hu-semantic="auto">${localized("Independent international news agency with global editorial standards.")}</p>
        </article>
        <article class="hu-card civic-media-resource-card--trusted country-media-rail-card"
          data-hu-plp-mode="CANONICAL_FALLBACK" data-hu-plp-entity="civic_media_trusted"
          data-hu-plp-id="the-atlantic" data-hu-shared-trusted="1" data-hu-fallback-nodes="all">
          <h3 data-hu-semantic="protected">The Atlantic</h3>
          <p class="civic-media-resource-card__body" data-hu-semantic="auto">Trusted explanation of editorial standards for participants.</p>
        </article>
      </section>

      <section id="fact-checking" data-section="fact-checking">
        <h2>Fact checking</h2>
        <article class="hu-card civic-media-resource-card--verification"><h3>Fact A</h3><p>Mission</p></article>
      </section>

      <section id="propaganda-analysis" data-section="propaganda-analysis">
        <h2>Propaganda analysis</h2>
        <article class="hu-card civic-media-resource-card--analysis"><h3>Prop A</h3><p>Explain</p></article>
      </section>

      <section id="faq" class="civic-media-page__faq">
        <h2>FAQ</h2>
        <article class="hu-card"><h3>Q1?</h3><p>A1</p></article>
        <article class="hu-card"><h3>Q2?</h3><p>A2</p></article>
      </section>

      <p class="civic-media-page__knowledge-link">Visit knowledge.</p>
    </div>
  </main>
  <footer data-hu-footer="1">Footer follows content</footer>
</div>
<section data-hu-surface="country-recommended-media" hidden>
  <article class="hu-card civic-media-resource-card--trusted"
    data-hu-plp-mode="PUBLISHED_LOCALIZED" data-hu-plp-entity="civic_media_trusted"
    data-hu-plp-id="reuters" data-hu-shared-trusted="1">
    <p class="civic-media-resource-card__body" data-hu-semantic="auto">${localized("Independent international news agency with global editorial standards.")}</p>
  </article>
</section>
<script>
  window.__HU_PLP_COUNTERS = {
    CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT: 0,
    PROVIDER_CALLS_FROM_READ_PATH: 0,
    POST_HYDRATION_SEMANTIC_CHANGE_COUNT: 0,
    CONTENT_TRANSLATION_WRITE_COUNT: 0
  };
  window.__HU_PLP_SSR_SNAPSHOT = {
    sections: Array.from(document.querySelectorAll('[id]')).map((el) => el.id).filter(Boolean),
    cards: document.querySelectorAll('.civic-media-resource-card--trusted, .civic-media-resource-card--principle, .civic-media-resource-card--verification, .civic-media-resource-card--analysis, .civic-media-resource-card--hero, .public-news-card, #faq .hu-card').length,
    autos: Array.from(document.querySelectorAll('[data-hu-semantic="auto"]')).map((el) => el.textContent)
  };
  requestAnimationFrame(() => {
    const afterAutos = Array.from(document.querySelectorAll('[data-hu-semantic="auto"]')).map((el) => el.textContent);
    const changed = afterAutos.some((t, i) => t !== window.__HU_PLP_SSR_SNAPSHOT.autos[i]);
    if (changed) window.__HU_PLP_COUNTERS.POST_HYDRATION_SEMANTIC_CHANGE_COUNT = 1;
    const afterCards = document.querySelectorAll('.civic-media-resource-card--trusted, .civic-media-resource-card--principle, .civic-media-resource-card--verification, .civic-media-resource-card--analysis, .civic-media-resource-card--hero, .public-news-card, #faq .hu-card').length;
    if (afterCards !== window.__HU_PLP_SSR_SNAPSHOT.cards) {
      window.__HU_PLP_COUNTERS.POST_HYDRATION_SEMANTIC_CHANGE_COUNT = 1;
    }
    document.body.setAttribute("data-hu-plp-hydrated", "1");
  });
</script>
</body>
</html>`;
}

async function withFixtureServer(
  locale: string,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const html = buildRealisticMediaFixtureHtml(locale);
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

/** Large unexplained blank: main flex region with tiny content vs viewport. */
async function assertNoLargeBlankRegion(page: import("@playwright/test").Page) {
  const metrics = await page.evaluate(() => {
    const main = document.querySelector(".humanity-layout__main") as HTMLElement | null;
    const container = document.querySelector(".civic-media-page__container") as HTMLElement | null;
    const footer = document.querySelector("[data-hu-footer]") as HTMLElement | null;
    if (!main || !container || !footer) {
      return { ok: false, reason: "missing-shell" };
    }
    const mainHeight = main.getBoundingClientRect().height;
    const contentHeight = container.getBoundingClientRect().height;
    const footerTop = footer.getBoundingClientRect().top;
    const contentBottom = container.getBoundingClientRect().bottom;
    const gap = footerTop - contentBottom;
    return {
      ok: true,
      mainHeight,
      contentHeight,
      gap,
      // Content should occupy most of main; leftover empty flex gap must be modest.
      emptyRatio: mainHeight > 0 ? Math.max(0, mainHeight - contentHeight) / mainHeight : 1,
    };
  });
  expect(metrics.ok).toBe(true);
  if (metrics.ok) {
    expect(metrics.contentHeight, "content collapsed").toBeGreaterThan(600);
    expect(metrics.gap, "footer detached by large blank").toBeLessThan(120);
    expect(metrics.emptyRatio, "large blank flex region").toBeLessThan(0.35);
  }
}

for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 900, height: 800 },
    { width: 1280, height: 800 },
  ] as const) {
    test(`Reset 03C.1 Media structural ${locale} @${viewport.width}`, async ({
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
        await expect(page.locator('[data-hu-semantic-unowned="0"]')).toHaveCount(1);
        await expect(page.locator('[data-hu-semantic-owner="BUG_UNOWNED"]')).toHaveCount(0);

        for (const id of MEDIA_PAGE_MAJOR_SECTION_IDS) {
          await expect(page.locator(`#${id}`)).toHaveCount(1);
        }

        await expect(page.locator('[data-hu-plp-id="reuters"]')).toHaveCount(2); // media + country
        await expect(
          page.locator('#trusted-media [data-hu-plp-id="the-atlantic"]'),
        ).toHaveCount(1);
        await expect(
          page.locator('#trusted-media [data-hu-plp-mode="PUBLISHED_LOCALIZED"]'),
        ).toHaveCount(1);
        await expect(
          page.locator('#trusted-media [data-hu-plp-mode="CANONICAL_FALLBACK"]'),
        ).toHaveCount(1);

        const reutersBody = await page
          .locator('#trusted-media [data-hu-plp-id="reuters"] .civic-media-resource-card__body')
          .textContent();
        const atlanticBody = await page
          .locator('#trusted-media [data-hu-plp-id="the-atlantic"] .civic-media-resource-card__body')
          .textContent();
        expect(reutersBody ?? "").toContain(`[${locale}]`);
        expect(atlanticBody ?? "").not.toContain(`[${locale}]`);

        const countryBody = await page
          .locator(
            '[data-hu-surface="country-recommended-media"] [data-hu-plp-id="reuters"] .civic-media-resource-card__body',
          )
          .textContent();
        expect(countryBody).toBe(reutersBody);

        const counters = await page.evaluate(() => {
          return (
            window as unknown as {
              __HU_PLP_COUNTERS: {
                CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT: number;
                PROVIDER_CALLS_FROM_READ_PATH: number;
                POST_HYDRATION_SEMANTIC_CHANGE_COUNT: number;
                CONTENT_TRANSLATION_WRITE_COUNT: number;
              };
              __HU_PLP_SSR_SNAPSHOT: { cards: number };
            }
          ).__HU_PLP_COUNTERS;
        });
        expect(counters.CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT).toBe(0);
        expect(counters.PROVIDER_CALLS_FROM_READ_PATH).toBe(0);
        expect(counters.POST_HYDRATION_SEMANTIC_CHANGE_COUNT).toBe(0);
        expect(counters.CONTENT_TRANSLATION_WRITE_COUNT).toBe(0);
        expect(clientTranslationRequests).toBe(0);

        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

        await assertNoLargeBlankRegion(page);

        if (locale === "ar") {
          await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
        }

        await context.close();
      });
    });
  }
}
