/**
 * HYD-01B — localized Home pages and /ka/initiatives hydrate without React
 * #418; the country selector keeps the server's names and order; no language
 * falls back to English.
 *
 * Run against a server in UTC (Render) with browsers in other timezones:
 *
 *   HYD01B_BASE_URL=https://staging.huws.org PLAYWRIGHT_CHANNEL=chrome \
 *     pnpm --filter @hu/web exec playwright test -c playwright.config.ts \
 *     src/features/hyd-01b-geography-names
 */
import { expect, test, type Page } from "@playwright/test";

import { getCountries } from "@hu/geography";

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });

const baseUrl = process.env.HYD01B_BASE_URL?.trim().replace(/\/$/, "") ?? "";
const ENGLISH_NAMES = new Set(getCountries().map((country) => country.name));

const HOME_PAGES = [
  { path: "/", lang: "en" },
  { path: "/ar", lang: "ar" },
  { path: "/he", lang: "he" },
  { path: "/uk", lang: "uk" },
  { path: "/zh-hant", lang: "zh-Hant" },
  { path: "/ka", lang: "ka" },
  { path: "/es", lang: "es" },
] as const;

function collectHydrationErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    if (/#418|hydrat/i.test(error.message)) errors.push(error.message.slice(0, 160));
  });
  page.on("console", (message) => {
    if (message.type() === "error" && /#418|hydrat/i.test(message.text())) {
      errors.push(message.text().slice(0, 160));
    }
  });
  return errors;
}

type Option = { value: string; text: string };

async function countryOptions(page: Page): Promise<{ server: Option[]; hydrated: Option[] }> {
  return page.evaluate(async () => {
    const html = await (await fetch(location.href)).text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const read = (root: Document) =>
      Array.from(root.querySelectorAll("select option"))
        .map((option) => ({
          value: (option as HTMLOptionElement).value,
          text: option.textContent?.trim() ?? "",
        }))
        .filter((option) => /^[A-Z]{2}$/.test(option.value));
    return { server: read(doc), hydrated: read(document) };
  });
}

for (const timezoneId of ["America/Vancouver", "Asia/Tokyo"]) {
  test.describe(`HYD-01B — hydration in ${timezoneId}`, () => {
    test.skip(!baseUrl, "set HYD01B_BASE_URL");
    test.use({ timezoneId });

    for (const { path, lang } of HOME_PAGES) {
      test(`${path} country selector`, async ({ page }) => {
        const errors = collectHydrationErrors(page);
        const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
        expect(response?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", lang);

        const { server, hydrated } = await countryOptions(page);
        expect(server.length, `${path} renders the country selector`).toBe(250);
        expect(hydrated, `${path} names and order survive hydration`).toEqual(server);

        const english = server.filter((option) => ENGLISH_NAMES.has(option.text)).length;
        if (lang === "en") {
          expect(english).toBe(250);
        } else {
          expect(english, `${path} must not fall back to English names`).toBeLessThan(125);
        }
        if (lang === "ka") {
          const georgian = server.filter((option) => /[\u10A0-\u10FF]/.test(option.text)).length;
          expect(georgian, "Georgian names stay in Georgian script").toBeGreaterThan(240);
        }
        expect(errors, `${path} hydration errors`).toEqual([]);
      });
    }

    test("/ka/initiatives Georgian dates", async ({ page }) => {
      const errors = collectHydrationErrors(page);
      const response = await page.goto(`${baseUrl}/ka/initiatives`, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      const dates = await page.evaluate(async () => {
        const html = await (await fetch(location.href)).text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const read = (root: Document) =>
          Array.from(root.querySelectorAll(".world-initiative-card__meta-value"))
            .map((node) => node.textContent?.trim() ?? "")
            .filter((text) => /\d{4}/.test(text));
        return { server: read(doc), hydrated: read(document) };
      });
      expect(dates.server.length).toBeGreaterThan(0);
      expect(dates.hydrated).toEqual(dates.server);
      for (const text of dates.server) {
        expect(text, "Georgian month names, not an English fallback").toMatch(/[\u10A0-\u10FF]/);
      }
      expect(errors).toEqual([]);
    });
  });
}
