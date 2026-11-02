/**
 * A11Y-01 — rendered checks on real pages (`A11Y01_BASE_URL`, e.g.
 * https://staging.huws.org): one main landmark, active chip contrast and
 * geography select Label in Name, at desktop and mobile widths.
 *
 *   A11Y01_BASE_URL=https://staging.huws.org PLAYWRIGHT_CHANNEL=chrome \
 *     pnpm --filter @hu/web exec playwright test -c playwright.config.ts \
 *     src/features/a11y-01-public-corrections
 */
import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  // Local builds that call a remote API are blocked by CORS; opt in to render
  // client-loaded content there.
  launchOptions:
    process.env.A11Y01_LOCAL_CORS_BYPASS === "1" ? { args: ["--disable-web-security"] } : {},
});

const baseUrl = process.env.A11Y01_BASE_URL?.trim().replace(/\/$/, "") ?? "";

const PAGES = ["/countries/GE", "/countries/CA", "/region/british-columbia", "/media", "/search"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/** Runs in the page: contrast of visible active chips over their composited background. */
function activeChipContrast(): { text: string; ratio: number }[] {
  type Rgba = { r: number; g: number; b: number; a: number };
  const parse = (value: string): Rgba => {
    const [r = 0, g = 0, b = 0, a = 1] = (value.match(/rgba?\(([^)]+)\)/)?.[1] ?? "0,0,0,0")
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
  const results: { text: string; ratio: number }[] = [];
  for (const chip of Array.from(
    document.querySelectorAll<HTMLElement>(
      ".civic-media-chip--active, .horizontal-section-chip--active, .trusted-media-category-tabs__tab[aria-selected='true']",
    ),
  )) {
    const box = chip.getBoundingClientRect();
    if (!box.width || !chip.textContent?.trim()) continue;
    const layers: Rgba[] = [];
    for (let node: HTMLElement | null = chip; node; node = node.parentElement) {
      const layer = parse(getComputedStyle(node).backgroundColor);
      if (layer.a > 0) {
        layers.push(layer);
        if (layer.a >= 1) break;
      }
    }
    let background: Rgba = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers.reverse()) background = blend(layer, background);
    const foreground = blend(parse(getComputedStyle(chip).color), background);
    const [hi, lo] = [luminance(foreground), luminance(background)].sort((x, y) => y - x) as [
      number,
      number,
    ];
    results.push({ text: chip.textContent.trim().slice(0, 30), ratio: (hi + 0.05) / (lo + 0.05) });
  }
  return results;
}

async function expectLabelInName(trigger: Locator, context: string) {
  const text = (await trigger.innerText()).replace(/\s+/g, " ").trim();
  expect(text.length, `${context} visible text`).toBeGreaterThan(0);
  const pattern = text
    .split(" ")
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  await expect(trigger, `${context} name must contain "${text}"`).toHaveAccessibleName(
    new RegExp(pattern, "i"),
  );
}

async function visibleTriggers(page: Page): Promise<Locator[]> {
  const shown: Locator[] = [];
  for (const trigger of await page.locator(".geography-search-select__trigger").all()) {
    if (await trigger.isVisible()) shown.push(trigger);
  }
  return shown;
}

test.describe("A11Y-01 — live pages", () => {
  test.skip(!baseUrl, "set A11Y01_BASE_URL");

  for (const viewport of VIEWPORTS) {
    for (const path of PAGES) {
      test(`${path} ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
        expect(response?.status()).toBe(200);

        const mains = await page.locator("main, [role='main']").count();
        expect(mains, `${path} has exactly one main landmark`).toBe(1);

        for (const chip of await page.evaluate(activeChipContrast)) {
          expect(chip.ratio, `${path} active chip "${chip.text}"`).toBeGreaterThanOrEqual(4.5);
        }

        for (const trigger of await visibleTriggers(page)) {
          await expectLabelInName(trigger, `${path} ${await trigger.getAttribute("id")}`);
        }
      });
    }
  }
});
