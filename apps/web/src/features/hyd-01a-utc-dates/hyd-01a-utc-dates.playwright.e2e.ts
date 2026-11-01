/**
 * HYD-01A/HYD-01B — server (Node, UTC) and browser (any timezone) produce the
 * same initiative date text, Georgian included.
 *
 * Parity layer (always): the shared `formatUtcCalendarDate` runs in Chrome under
 * UTC, America/Vancouver and Asia/Tokyo and must equal the Node output of the
 * public formatters for all 10 interface locales.
 *
 * Live layer (`HYD01A_BASE_URL`): /initiatives pages (no country selector) must
 * hydrate without errors in each browser timezone; server and hydrated card
 * dates must match.
 *
 *   HYD01A_BASE_URL=https://staging.huws.org PLAYWRIGHT_CHANNEL=chrome \
 *     pnpm --filter @hu/web exec playwright test -c playwright.config.ts \
 *     src/features/hyd-01a-utc-dates
 */
import { expect, test } from "@playwright/test";

import { formatUtcCalendarDate } from "../language/format-utc-calendar-date";
import { formatInitiativeExperienceDate } from "../public-initiative-experience/initiative-experience-i18n";
import { formatNewsPublishedDate } from "../public-news/api";

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });

const INTERFACE_LOCALES = ["en", "uk", "ar", "he", "zh-Hant", "ka", "es", "de", "fr", "pt"];
const TIMEZONES = ["UTC", "America/Vancouver", "Asia/Tokyo"];
const SAMPLES = ["2026-08-01T00:00:00.000Z", "2026-08-19T00:26:18.039Z"];

type Row = { locale: string; iso: string; month: "long" | "short"; text: string };

function nodeRows(): Row[] {
  const rows: Row[] = [];
  for (const locale of INTERFACE_LOCALES) {
    for (const iso of SAMPLES) {
      for (const month of ["long", "short"] as const) {
        rows.push({
          locale,
          iso,
          month,
          text: formatInitiativeExperienceDate(locale, iso, { month }),
        });
      }
      rows.push({ locale, iso, month: "long", text: formatNewsPublishedDate(iso, locale) });
    }
  }
  return rows;
}

for (const timezoneId of TIMEZONES) {
  test.describe(`HYD-01A — Node/Chrome parity in ${timezoneId}`, () => {
    test.use({ timezoneId });

    test("initiative and news dates match the server text", async ({ page }) => {
      await page.goto("about:blank");
      const expected = nodeRows();
      const browser = await page.evaluate(
        ({ rows, source }) => {
          const format = new Function(`return (${source})`)() as (
            locale: string,
            date: Date,
            month: "long" | "short",
          ) => string;
          return rows.map((row) => format(row.locale, new Date(row.iso), row.month));
        },
        { rows: expected, source: formatUtcCalendarDate.toString() },
      );
      expected.forEach((row, index) => {
        expect(browser[index], `${row.locale} ${row.month} ${row.iso}`).toBe(row.text);
      });
    });
  });
}

const baseUrl = process.env.HYD01A_BASE_URL?.trim().replace(/\/$/, "") ?? "";
const INITIATIVES_PATHS = [
  "/initiatives",
  "/uk/initiatives",
  "/ar/initiatives",
  "/he/initiatives",
  "/ka/initiatives",
];

for (const timezoneId of ["America/Vancouver", "Asia/Tokyo"]) {
  test.describe(`HYD-01A — live /initiatives hydration in ${timezoneId}`, () => {
    test.skip(!baseUrl, "set HYD01A_BASE_URL");
    test.use({ timezoneId });

    for (const path of INITIATIVES_PATHS) {
      test(path, async ({ page }) => {
        const hydrationErrors: string[] = [];
        page.on("pageerror", (error) => {
          if (/#418|hydrat/i.test(error.message)) hydrationErrors.push(error.message.slice(0, 160));
        });
        page.on("console", (message) => {
          if (message.type() === "error" && /#418|hydrat/i.test(message.text())) {
            hydrationErrors.push(message.text().slice(0, 160));
          }
        });

        const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
        expect(response?.status()).toBe(200);
        const dates = await page.evaluate(async () => {
          const html = await (await fetch(location.href)).text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          const read = (root: Document) =>
            Array.from(root.querySelectorAll(".world-initiative-card__meta-value"))
              .map((node) => node.textContent?.trim() ?? "")
              .filter((text) => /\d/.test(text));
          return { server: read(doc), hydrated: read(document) };
        });

        expect(dates.server.length, `${path} renders dated cards`).toBeGreaterThan(0);
        expect(dates.hydrated, `${path} hydrated dates equal server dates`).toEqual(dates.server);
        expect(hydrationErrors, `${path} hydration errors`).toEqual([]);
      });
    }
  });
}
