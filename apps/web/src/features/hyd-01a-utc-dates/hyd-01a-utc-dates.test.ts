/**
 * HYD-01A — initiative and initiative-news dates are formatted in UTC so the
 * server render and every browser timezone produce the same text.
 *
 * Browser-side parity (Chrome vs Node) lives in `hyd-01a-utc-dates.playwright.e2e.ts`.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { formatInitiativeExperienceDate } from "../public-initiative-experience/initiative-experience-i18n";
import { formatNewsPublishedDate } from "../public-news/api";

const INTERFACE_LOCALES = ["en", "uk", "ar", "he", "zh-Hant", "ka", "es", "de", "fr", "pt"];
const TIMEZONES = ["UTC", "America/Vancouver", "Asia/Tokyo"];
/** startDate/completionDate are calendar dates stored as UTC midnight. */
const CALENDAR_DATE = "2026-08-01T00:00:00.000Z";
/** A timestamp whose local day differs between UTC and Vancouver. */
const NEAR_MIDNIGHT_TIMESTAMP = "2026-08-19T00:26:18.039Z";

const originalTz = process.env.TZ;

function inTimezone<T>(timeZone: string, run: () => T): T {
  process.env.TZ = timeZone;
  return run();
}

afterEach(() => {
  process.env.TZ = originalTz;
});

describe("HYD-01A — formatInitiativeExperienceDate", () => {
  it("the process timezone really changes local dates (guards the test itself)", () => {
    const vancouver = inTimezone("America/Vancouver", () => new Date(CALENDAR_DATE).getDate());
    const tokyo = inTimezone("Asia/Tokyo", () => new Date(CALENDAR_DATE).getDate());
    assert.equal(vancouver, 31);
    assert.equal(tokyo, 1);
  });

  it("keeps UTC midnight on the same calendar date in every timezone (en)", () => {
    for (const timeZone of TIMEZONES) {
      inTimezone(timeZone, () => {
        assert.equal(formatInitiativeExperienceDate("en", CALENDAR_DATE), "August 1, 2026");
        assert.equal(
          formatInitiativeExperienceDate("en", CALENDAR_DATE, { month: "short" }),
          "Aug 1, 2026",
        );
        assert.equal(
          formatInitiativeExperienceDate("en", NEAR_MIDNIGHT_TIMESTAMP, { month: "short" }),
          "Aug 19, 2026",
        );
      });
    }
  });

  it("produces identical localized text across timezones for all 10 interface locales", () => {
    for (const locale of INTERFACE_LOCALES) {
      for (const month of ["long", "short"] as const) {
        for (const iso of [CALENDAR_DATE, NEAR_MIDNIGHT_TIMESTAMP]) {
          const outputs = TIMEZONES.map((timeZone) =>
            inTimezone(timeZone, () => formatInitiativeExperienceDate(locale, iso, { month })),
          );
          assert.equal(
            new Set(outputs).size,
            1,
            `${locale} ${month} ${iso}: ${outputs.join(" | ")}`,
          );
          assert.notEqual(outputs[0], iso, `${locale} must format, not echo the input`);
        }
      }
    }
  });

  it("keeps locale-specific formatting (no English substitution)", () => {
    inTimezone("America/Vancouver", () => {
      assert.match(formatInitiativeExperienceDate("uk", CALENDAR_DATE), /серпня/);
      assert.match(formatInitiativeExperienceDate("ar", CALENDAR_DATE), /أغسطس/);
      assert.match(formatInitiativeExperienceDate("he", CALENDAR_DATE), /באוגוסט/);
      assert.match(formatInitiativeExperienceDate("zh-Hant", CALENDAR_DATE), /8月1日/);
      assert.match(formatInitiativeExperienceDate("es", CALENDAR_DATE), /agosto/);
    });
  });

  it("Georgian is formatted in Georgian on the server (Node ICU), on day 1", () => {
    inTimezone("America/Vancouver", () => {
      const ka = formatInitiativeExperienceDate("ka", CALENDAR_DATE);
      assert.match(ka, /აგვისტო/);
      assert.match(ka, /\b1\b/);
    });
  });

  it("keeps empty and invalid input behavior", () => {
    assert.equal(formatInitiativeExperienceDate("en", null), "");
    assert.equal(formatInitiativeExperienceDate("en", undefined), "");
    assert.equal(formatInitiativeExperienceDate("en", ""), "");
    assert.equal(formatInitiativeExperienceDate("en", "not-a-date"), "not-a-date");
  });
});

describe("HYD-01A — formatNewsPublishedDate", () => {
  it("uses the supplied interface locale", () => {
    assert.equal(formatNewsPublishedDate(CALENDAR_DATE, "en"), "August 1, 2026");
    assert.match(formatNewsPublishedDate(CALENDAR_DATE, "uk"), /серпня/);
    assert.match(formatNewsPublishedDate(CALENDAR_DATE, "ar"), /أغسطس/);
    assert.match(formatNewsPublishedDate(CALENDAR_DATE, "he"), /באוגוסט/);
  });

  it("is timezone independent", () => {
    for (const locale of INTERFACE_LOCALES) {
      const outputs = TIMEZONES.map((timeZone) =>
        inTimezone(timeZone, () => formatNewsPublishedDate(NEAR_MIDNIGHT_TIMESTAMP, locale)),
      );
      assert.equal(new Set(outputs).size, 1, `${locale}: ${outputs.join(" | ")}`);
    }
  });

  it("keeps the invalid-input fallback", () => {
    assert.equal(formatNewsPublishedDate("not-a-date", "en"), "not-a-date");
  });
});
