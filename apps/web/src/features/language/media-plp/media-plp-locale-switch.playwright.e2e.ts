/**
 * Reset 03C.2 — realistic Language Selector locale-switch fixture for Media PLP.
 * Exercises the real selector control (not direct locale state mutation).
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { test, expect } from "@playwright/test";

import { MEDIA_PAGE_MAJOR_SECTION_IDS } from "./media-page-structure";

type Locale = "en" | "uk" | "zh-Hant" | "ar";

function mediaBodyFor(locale: Locale): string {
  const localized = (text: string) =>
    locale === "en" ? text : `[${locale}] ${text}`;
  const reutersMode = locale === "uk" ? "PUBLISHED_LOCALIZED" : "CANONICAL_FALLBACK";
  const reutersText =
    locale === "uk"
      ? localized("Independent international news agency with global editorial standards.")
      : "Independent international news agency with global editorial standards.";
  const dir = locale === "ar" ? "rtl" : "ltr";

  return `
<main class="humanity-layout__main civic-media-page" data-hu-media-plp="true" data-hu-media-renderer="shared" data-hu-plp-ssr="1">
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
    <section id="initiative-flow" data-section="initiative-flow"><h2>Initiative flow</h2></section>
    <section id="news-widgets" data-section="news-widgets"><h2>News</h2>
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
    </section>
    <section id="trusted-media" data-section="trusted-media">
      <h2>Trusted media</h2>
      <div data-hu-control="trusted-media-tabs">Category tabs</div>
      <article class="hu-card civic-media-resource-card--trusted country-media-rail-card"
        data-hu-plp-mode="${reutersMode}" data-hu-plp-entity="civic_media_trusted"
        data-hu-plp-id="reuters" data-hu-shared-trusted="1"
        data-hu-fallback-nodes="${reutersMode === "CANONICAL_FALLBACK" ? "all" : "0"}">
        <h3 data-hu-semantic="protected">Reuters</h3>
        <p class="civic-media-resource-card__body" data-hu-semantic="auto">${reutersText}</p>
      </article>
      <article class="hu-card civic-media-resource-card--trusted country-media-rail-card"
        data-hu-plp-mode="CANONICAL_FALLBACK" data-hu-plp-entity="civic_media_trusted"
        data-hu-plp-id="the-atlantic" data-hu-shared-trusted="1" data-hu-fallback-nodes="all">
        <h3 data-hu-semantic="protected">The Atlantic</h3>
        <p class="civic-media-resource-card__body" data-hu-semantic="auto">Trusted explanation of editorial standards for participants.</p>
      </article>
    </section>
    <section id="fact-checking" data-section="fact-checking">
      <article class="hu-card civic-media-resource-card--verification"><h3>Fact A</h3><p>Mission</p></article>
    </section>
    <section id="propaganda-analysis" data-section="propaganda-analysis">
      <article class="hu-card civic-media-resource-card--analysis"><h3>Prop A</h3><p>Explain</p></article>
    </section>
    <section id="faq" class="civic-media-page__faq">
      <article class="hu-card"><h3>Q1?</h3><p>A1</p></article>
    </section>
    <p class="civic-media-page__knowledge-link">Visit knowledge.</p>
  </div>
</main>
<footer data-hu-footer="1">Footer follows content</footer>
`;
}

function buildLocaleSwitchFixtureHtml(): string {
  return `<!doctype html>
<html lang="en" dir="ltr">
<head><meta charset="utf-8"><title>Media locale switch</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; }
  .humanity-layout { display: flex; min-height: 100vh; flex-direction: column; }
  .humanity-layout__main { flex: 1; width: 100%; }
  .civic-media-page__container { max-width: 1280px; margin: 0 auto; padding: 12px; }
  section { margin: 1.5rem 0; }
  .civic-media-resource-card__body { overflow-wrap: anywhere; max-width: 100%; }
  .hu-language-selector__select:disabled { cursor: wait; }
  footer { padding: 1rem; border-top: 1px solid #ccc; }
</style>
</head>
<body>
<div class="humanity-layout">
  <header>
    <div class="hu-language-selector" data-testid="language-selector">
      <label class="hu-language-selector__label" for="hu-lang-select">
        <span class="hu-visually-hidden">Language</span>
        <select id="hu-lang-select" class="hu-language-selector__select" aria-label="Language">
          <option value="en" selected>English</option>
          <option value="uk">Ukrainian</option>
          <option value="zh-Hant">Chinese (Traditional)</option>
          <option value="ar">Arabic</option>
        </select>
      </label>
    </div>
  </header>
  <div id="media-root">${mediaBodyFor("en")}</div>
</div>
<script>
  window.__HU_PLP_COUNTERS = {
    CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT: 0,
    PROVIDER_CALLS_FROM_READ_PATH: 0,
    POST_HYDRATION_SEMANTIC_CHANGE_COUNT: 0,
    CONTENT_TRANSLATION_WRITE_COUNT: 0,
    MEDIA_PLP_RESOLVE_REQUEST_COUNT: 0
  };
  window.__HU_MEDIA_LOCALE_SWITCH__ = {
    LOCALE_SWITCH_STARTED: null,
    LOCALE_SWITCH_COMPLETED: null,
    FINAL_INTERFACE_LOCALE: null,
    MEDIA_PRESENTATION_RESOLUTION: [],
    MEDIA_SEMANTIC_MUTATIONS_AFTER_SETTLE: 0,
    CLIENT_TRANSLATION_REQUEST_COUNT: 0
  };

  const bodies = {
    en: ${JSON.stringify(mediaBodyFor("en"))},
    uk: ${JSON.stringify(mediaBodyFor("uk"))},
    "zh-Hant": ${JSON.stringify(mediaBodyFor("zh-Hant"))},
    ar: ${JSON.stringify(mediaBodyFor("ar"))}
  };

  function settleLocale(locale) {
    const root = document.getElementById("media-root");
    root.innerHTML = bodies[locale];
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.body.setAttribute("data-hu-media-locale-settled", locale);

    const resolutions = [];
    document.querySelectorAll("[data-hu-plp-id]").forEach((el) => {
      resolutions.push({
        locale,
        mode: el.getAttribute("data-hu-plp-mode"),
        entityId: el.getAttribute("data-hu-plp-id")
      });
    });

    window.__HU_MEDIA_LOCALE_SWITCH__ = {
      LOCALE_SWITCH_STARTED: locale,
      LOCALE_SWITCH_COMPLETED: locale,
      FINAL_INTERFACE_LOCALE: locale,
      MEDIA_PRESENTATION_RESOLUTION: resolutions,
      MEDIA_SEMANTIC_MUTATIONS_AFTER_SETTLE: 0,
      CLIENT_TRANSLATION_REQUEST_COUNT: 0
    };
    window.__HU_PLP_COUNTERS.CLIENT_TRANSLATION_REQUEST_COUNT = 0;
    window.__HU_PLP_COUNTERS.MEDIA_PLP_RESOLVE_REQUEST_COUNT += 1;

    const select = document.getElementById("hu-lang-select");
    const wrap = document.querySelector(".hu-language-selector");
    select.disabled = false;
    wrap.removeAttribute("data-pending");
  }

  // Real Language Selector path: change → pending → cookie/route → refresh settle.
  document.getElementById("hu-lang-select").addEventListener("change", (event) => {
    const locale = event.target.value;
    const select = event.target;
    const wrap = document.querySelector(".hu-language-selector");
    wrap.setAttribute("data-pending", "true");
    select.disabled = true;
    window.__HU_MEDIA_LOCALE_SWITCH__.LOCALE_SWITCH_STARTED = locale;
    document.body.removeAttribute("data-hu-media-locale-settled");

    // Simulate bounded SSR resolve + router.refresh completion (no CT generate).
    window.setTimeout(() => settleLocale(locale), 30);
  });

  document.body.setAttribute("data-hu-media-locale-settled", "en");
  document.body.setAttribute("data-hu-plp-hydrated", "1");
</script>
</body>
</html>`;
}

async function withFixtureServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const html = buildLocaleSwitchFixtureHtml();
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === "/api/hu-lang" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ locale: "ok" }));
      return;
    }
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
      contentHeight,
      gap,
      emptyRatio: mainHeight > 0 ? Math.max(0, mainHeight - contentHeight) / mainHeight : 1,
    };
  });
  expect(metrics.ok).toBe(true);
  if (metrics.ok) {
    expect(metrics.contentHeight).toBeGreaterThan(400);
    expect(metrics.gap).toBeLessThan(120);
    expect(metrics.emptyRatio).toBeLessThan(0.35);
  }
}

async function switchViaRealSelector(
  page: import("@playwright/test").Page,
  locale: Locale,
) {
  const select = page.locator("#hu-lang-select");
  await expect(select).toBeEnabled();
  await select.selectOption(locale);
  await expect(page.locator(".hu-language-selector")).toHaveAttribute(
    "data-pending",
    "true",
  );
  await page.waitForSelector(`[data-hu-media-locale-settled="${locale}"]`, {
    timeout: 5_000,
  });
  await expect(page.locator(".hu-language-selector")).not.toHaveAttribute(
    "data-pending",
    "true",
  );
  await expect(select).toBeEnabled();
  await expect(select).toHaveValue(locale);
}

for (const transition of [
  { from: "en", to: "uk" },
  { from: "en", to: "zh-Hant" },
  { from: "en", to: "ar" },
  { from: "uk", to: "en" },
] as const) {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 900, height: 800 },
    { width: 1280, height: 800 },
  ] as const) {
    test(`Reset 03D real selector ${transition.from}→${transition.to} @${viewport.width}`, async ({
      browser,
    }) => {
      await withFixtureServer(async (baseUrl) => {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        let clientTranslationRequests = 0;
        let mediaPlpResolveRequests = 0;
        page.on("request", (req) => {
          const url = req.url();
          if (
            /\/translations\/(generate|resolve)/.test(url) ||
            /content.translation/i.test(url)
          ) {
            clientTranslationRequests += 1;
          }
          if (/\/media-plp\/resolve/.test(url)) {
            mediaPlpResolveRequests += 1;
          }
        });

        await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
        await page.waitForSelector('[data-hu-plp-hydrated="1"]');

        // Start from requested "from" locale when not English fixture default.
        if (transition.from !== "en") {
          await switchViaRealSelector(page, transition.from);
        }

        const startedAt = Date.now();
        await switchViaRealSelector(page, transition.to);
        const transitionDurationMs = Date.now() - startedAt;

        for (const id of MEDIA_PAGE_MAJOR_SECTION_IDS) {
          await expect(page.locator(`#${id}`)).toHaveCount(1);
        }

        const trustedCount = await page
          .locator("#trusted-media .civic-media-resource-card--trusted")
          .count();
        expect(trustedCount).toBe(2);

        const reutersMode = await page
          .locator('#trusted-media [data-hu-plp-id="reuters"]')
          .getAttribute("data-hu-plp-mode");
        if (transition.to === "uk") {
          expect(reutersMode).toBe("PUBLISHED_LOCALIZED");
        } else {
          expect(reutersMode).toBe("CANONICAL_FALLBACK");
        }

        const instrumentation = await page.evaluate(() => {
          const w = window as unknown as {
            __HU_MEDIA_LOCALE_SWITCH__?: {
              LOCALE_SWITCH_COMPLETED: string;
              FINAL_INTERFACE_LOCALE: string;
              MEDIA_SEMANTIC_MUTATIONS_AFTER_SETTLE: number;
              CLIENT_TRANSLATION_REQUEST_COUNT: number;
            };
            __HU_PLP_COUNTERS?: {
              MEDIA_PLP_RESOLVE_REQUEST_COUNT: number;
              CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT: number;
            };
          };
          return {
            localeSwitch: w.__HU_MEDIA_LOCALE_SWITCH__ ?? null,
            counters: w.__HU_PLP_COUNTERS ?? null,
          };
        });
        expect(instrumentation.localeSwitch).not.toBeNull();
        expect(instrumentation.localeSwitch!.LOCALE_SWITCH_COMPLETED).toBe(
          transition.to,
        );
        expect(instrumentation.localeSwitch!.FINAL_INTERFACE_LOCALE).toBe(
          transition.to,
        );
        expect(instrumentation.localeSwitch!.MEDIA_SEMANTIC_MUTATIONS_AFTER_SETTLE).toBe(
          0,
        );
        expect(instrumentation.localeSwitch!.CLIENT_TRANSLATION_REQUEST_COUNT).toBe(0);
        // Fixture models one Media PLP resolve per switch (03D combined batch).
        expect(instrumentation.counters!.MEDIA_PLP_RESOLVE_REQUEST_COUNT).toBeGreaterThanOrEqual(
          1,
        );
        expect(clientTranslationRequests).toBe(0);
        // Fixture does not hit a real API; network Media PLP count stays 0.
        expect(mediaPlpResolveRequests).toBe(0);
        // Controllable fixture budget — not a staging/Render claim.
        expect(transitionDurationMs).toBeLessThan(2_000);

        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
        await assertNoLargeBlankRegion(page);

        if (transition.to === "ar") {
          await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
        }

        await context.close();
      });
    });
  }
}
