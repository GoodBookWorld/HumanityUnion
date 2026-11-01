/**
 * SEO-10 — rendered contrast and Label in Name in a real browser.
 *
 * Fixture layer (always): real repository CSS rendered in Chromium for en / ar / he
 * at desktop and mobile widths; computed colors measured against the effective
 * background, including the navigator hover state.
 *
 * Live layer (`SEO10_BASE_URL`, e.g. https://staging.huws.org): the same contrast
 * checks on real pages plus accessible names of the language selector and the
 * initiative card links.
 *
 *   SEO10_BASE_URL=https://staging.huws.org PLAYWRIGHT_CHANNEL=chrome \
 *     pnpm --filter @hu/web exec playwright test -c playwright.config.ts \
 *     src/features/seo-a11y-contrast-seo10
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

/** Playwright cwd is `apps/web` (see playwright.config.ts). */
const webSrc = path.join(process.cwd(), "src");

test.use({
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  // Local builds that call a remote API are blocked by CORS; opt in to render
  // the client-loaded language selector and initiative cards there.
  launchOptions:
    process.env.SEO10_LOCAL_CORS_BYPASS === "1" ? { args: ["--disable-web-security"] } : {},
});

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const LOCALES = [
  { lang: "en", dir: "ltr", path: "/" },
  { lang: "ar", dir: "rtl", path: "/ar" },
  { lang: "he", dir: "rtl", path: "/he" },
] as const;

const CONTRAST_SELECTORS = [
  ".humanity-header__tagline",
  ".public-experience-footer__tagline",
  ".horizontal-section-shell__eyebrow",
  ".civic-media-section-shell__eyebrow",
  ".civic-media-page__eyebrow",
  ".geographic-navigator__scope--active",
];

type Measurement = {
  selector: string;
  text: string;
  color: string;
  background: string;
  ratio: number;
};

/** Runs in the page: computed color over the composited background stack. */
function measureContrast(selectors: string[]): Measurement[] {
  type Rgba = { r: number; g: number; b: number; a: number };
  const parse = (value: string): Rgba | null => {
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (!match?.[1]) return null;
    const [r = 0, g = 0, b = 0, a = 1] = match[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r, g, b, a };
  };
  const blend = (top: Rgba, bottom: Rgba): Rgba => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const luminance = (c: Rgba) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const css = (c: Rgba) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;

  const results: Measurement[] = [];
  for (const selector of selectors) {
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0 || !element.textContent?.trim()) continue;
      const layers: Rgba[] = [];
      let opacity = 1;
      for (let node: HTMLElement | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        opacity *= Number(style.opacity);
        const layer = parse(style.backgroundColor);
        if (layer && layer.a > 0) {
          layers.push(layer);
          if (layer.a >= 1) break;
        }
      }
      let background: Rgba = { r: 255, g: 255, b: 255, a: 1 };
      for (const layer of layers.reverse()) background = blend(layer, background);
      const raw = parse(getComputedStyle(element).color) ?? { r: 0, g: 0, b: 0, a: 1 };
      const foreground = blend({ ...raw, a: raw.a * opacity }, background);
      const [light, dark] = [luminance(foreground), luminance(background)].sort(
        (x, y) => y - x,
      ) as [number, number];
      results.push({
        selector,
        text: element.textContent.trim().slice(0, 40),
        color: css(foreground),
        background: css(background),
        ratio: (light + 0.05) / (dark + 0.05),
      });
    }
  }
  return results;
}

function expectAaContrast(measurements: Measurement[], context: string) {
  for (const m of measurements) {
    expect(
      m.ratio,
      `${context} ${m.selector} "${m.text}" ${m.color} on ${m.background}`,
    ).toBeGreaterThanOrEqual(4.5);
  }
}

function fixtureHtml(lang: string, dir: string): string {
  const files = [
    "design-system/tokens.css",
    "design-system/layout.css",
    "features/public-experience/public-experience-footer.css",
    "features/public-experience/public-experience.css",
    "features/civic-media-center/media-rail/civic-media-section-shell.css",
    "features/horizontal-experience/hux.css",
    "features/civic-media-center/civic-media-center.css",
  ];
  const styles = files.map((f) => readFileSync(path.join(webSrc, f), "utf8")).join("\n");
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head>
<body style="margin:0;background:#ffffff">
<header class="humanity-header" style="background:#f4f7fa"><span class="humanity-header__brand-text">
  <span class="humanity-header__tagline">WORLD SOLIDARITY</span></span></header>
<main>
  <section class="horizontal-section-shell horizontal-section-shell--default"><p class="horizontal-section-shell__eyebrow">CIVIC ACTIVITY</p></section>
  <section class="horizontal-section-shell horizontal-section-shell--knowledge"><p class="horizontal-section-shell__eyebrow">LEARN AND PARTICIPATE</p></section>
  <section class="horizontal-section-shell hux-section--education"><p class="horizontal-section-shell__eyebrow">EDUCATION</p></section>
  <section class="horizontal-section-shell horizontal-section-shell--verification" style="background:#f4f7fa"><p class="horizontal-section-shell__eyebrow">VERIFICATION</p></section>
  <section class="civic-media-section-shell" style="background:#f4f7fa"><p class="civic-media-section-shell__eyebrow">CIVIC MEDIA</p></section>
  <div class="civic-media-page__hero"><p class="civic-media-page__eyebrow">CIVIC MEDIA CENTER</p></div>
  <nav><span class="geographic-navigator__scope geographic-navigator__scope--active">Canada</span>
    <a class="geographic-navigator__scope geographic-navigator__scope--link" href="#world">World</a></nav>
</main>
<footer class="public-experience-footer"><div class="public-experience-footer__brand-row">
  <p class="public-experience-footer__tagline">WORLD SOLIDARITY</p></div></footer>
</body></html>`;
}

test.describe("SEO-10 — rendered contrast with repository CSS", () => {
  let server: Server;
  let origin = "";

  test.beforeAll(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://fixture");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        fixtureHtml(url.searchParams.get("lang") ?? "en", url.searchParams.get("dir") ?? "ltr"),
      );
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    origin = typeof address === "object" && address ? `http://127.0.0.1:${address.port}` : "";
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      test(`${locale.lang} ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`${origin}/?lang=${locale.lang}&dir=${locale.dir}`);
        const measurements = await page.evaluate(measureContrast, CONTRAST_SELECTORS);
        expect(measurements.length).toBeGreaterThanOrEqual(CONTRAST_SELECTORS.length + 3);
        expectAaContrast(measurements, `${locale.lang} ${viewport.name}`);

        await page.hover(".geographic-navigator__scope--link");
        const hovered = await page.evaluate(measureContrast, [
          ".geographic-navigator__scope--link",
        ]);
        expectAaContrast(hovered, `${locale.lang} ${viewport.name} hover`);
      });
    }
  }
});

const baseUrl = process.env.SEO10_BASE_URL?.trim().replace(/\/$/, "") ?? "";

/** Visible text of an element, excluding aria-hidden and visually hidden subtrees. */
async function visibleText(locator: Locator): Promise<string> {
  return locator.evaluate((root) => {
    const parts: string[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent ?? "");
        return;
      }
      if (!(node instanceof HTMLElement)) return;
      if (node.getAttribute("aria-hidden") === "true") return;
      const box = node.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1 || getComputedStyle(node).visibility === "hidden")
        return;
      node.childNodes.forEach(walk);
    };
    walk(root);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  });
}

/** The accessible name must contain the visible text, in order (WCAG 2.5.3). */
async function expectLabelInName(locator: Locator, context: string) {
  const text = await visibleText(locator);
  expect(text.length, `${context} visible text`).toBeGreaterThan(0);
  const pattern = text
    .split(" ")
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  await expect(locator, `${context} name must contain "${text}"`).toHaveAccessibleName(
    new RegExp(pattern, "i"),
  );
}

async function visible(page: Page, selector: string): Promise<Locator[]> {
  const all = await page.locator(selector).all();
  const shown: Locator[] = [];
  for (const locator of all) if (await locator.isVisible()) shown.push(locator);
  return shown;
}

test.describe("SEO-10 — live pages", () => {
  test.skip(!baseUrl, "set SEO10_BASE_URL");

  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      test(`${locale.path} ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`${baseUrl}${locale.path}`, { waitUntil: "networkidle" });
        await expect(page.locator("html")).toHaveAttribute("dir", locale.dir);

        expectAaContrast(
          await page.evaluate(measureContrast, CONTRAST_SELECTORS),
          `${locale.path} ${viewport.name}`,
        );

        const selectors = await visible(
          page,
          ".hu-language-selector__select, .hu-language-selector__icon-trigger",
        );
        if (viewport.name === "desktop") expect(selectors.length).toBeGreaterThan(0);
        for (const trigger of selectors)
          await expectLabelInName(trigger, `${locale.path} language selector`);

        const cards = await visible(page, ".public-initiative-mini-card__link");
        for (const card of cards.slice(0, 3))
          await expectLabelInName(card, `${locale.path} initiative card`);
      });
    }
  }

  test("/initiatives world initiative card links", async ({ page }) => {
    await page.goto(`${baseUrl}/initiatives`, { waitUntil: "networkidle" });
    const cards = await visible(page, ".world-initiative-card__link");
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards.slice(0, 3)) await expectLabelInName(card, "/initiatives card");
  });
});
