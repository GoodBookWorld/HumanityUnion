/**
 * HYD-01B — server-resolved country names (identical SSR and hydration) and
 * deterministic Georgian dates.
 *
 * Browser hydration checks live in `hyd-01b-geography-names.playwright.e2e.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import {
  getCountries,
  getLocalizedCountryDisplayName,
  listLocalizedCountries,
  type LocalizedCountryName,
} from "@hu/geography";

import {
  GeographyDisplayProvider,
  useCountryDisplayName,
  useLocalizedCountries,
} from "../geography-display/GeographyDisplayProvider.js";
import { formatUtcCalendarDate } from "../language/format-utc-calendar-date.js";

void React;

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) => readFileSync(path.join(webSrc, rel), "utf8");

const ENABLED_LOCALES = ["en", "uk", "ar", "he", "zh-Hant", "ka", "es", "de", "fr", "pt"];
const CANONICAL_CODES = getCountries().map((country) => country.code);

describe("HYD-01B — listLocalizedCountries", () => {
  it("covers all 250 canonical ISO codes for every enabled locale", () => {
    assert.equal(CANONICAL_CODES.length, 250);
    for (const locale of ENABLED_LOCALES) {
      const list = listLocalizedCountries(locale);
      assert.deepEqual([...list.map((c) => c.code)].sort(), [...CANONICAL_CODES].sort(), locale);
      assert.ok(
        list.every((c) => /^[A-Z]{2}$/.test(c.code) && c.label.trim().length > 0),
        locale,
      );
    }
  });

  it("is deterministic and sorted with the locale collator", () => {
    for (const locale of ENABLED_LOCALES) {
      const first = listLocalizedCountries(locale);
      assert.deepEqual(listLocalizedCountries(locale), first, `${locale} repeatable`);
      const collator = new Intl.Collator(locale);
      for (let i = 1; i < first.length; i += 1) {
        assert.ok(
          collator.compare(first[i - 1]!.label, first[i]!.label) <= 0,
          `${locale} order at ${i}`,
        );
      }
    }
  });

  it("keeps the names the server already rendered (per-code resolver)", () => {
    for (const locale of ENABLED_LOCALES) {
      for (const country of listLocalizedCountries(locale)) {
        assert.equal(
          country.label,
          getLocalizedCountryDisplayName(country.code, locale),
          `${locale} ${country.code}`,
        );
      }
    }
  });

  it("keeps canonical English names for English", () => {
    const byCode = new Map(getCountries().map((c) => [c.code, c.name]));
    for (const country of listLocalizedCountries("en")) {
      assert.equal(country.label, byCode.get(country.code));
    }
  });

  it("supports Georgian script and Traditional Chinese, Arabic and Hebrew names", () => {
    const label = (locale: string, code: string) =>
      listLocalizedCountries(locale).find((c) => c.code === code)?.label ?? "";
    assert.match(label("ka", "GE"), /[\u10A0-\u10FF]/);
    assert.ok(
      listLocalizedCountries("ka").filter((c) => /[\u10A0-\u10FF]/.test(c.label)).length > 240,
    );
    assert.match(label("zh-Hant", "TW"), /[\u4E00-\u9FFF]/);
    assert.match(label("ar", "EG"), /[\u0600-\u06FF]/);
    assert.match(label("he", "IL"), /[\u0590-\u05FF]/);
  });

  it("works for a valid locale outside the current Registry list, and falls back for an invalid one", () => {
    const italian = listLocalizedCountries("it");
    assert.equal(italian.length, 250);
    assert.equal(italian.find((c) => c.code === "DE")?.label, "Germania");
    const invalid = listLocalizedCountries("@@invalid");
    assert.equal(invalid.length, 250);
    assert.equal(invalid.find((c) => c.code === "DE")?.label, "Germany");
  });
});

function renderWith(options: {
  intlLocale: string;
  provider?: { locale: string; countries: readonly LocalizedCountryName[] };
  probe: () => React.ReactElement;
}): string {
  const probe = createElement(options.probe);
  const tree = options.provider
    ? createElement(
        GeographyDisplayProvider,
        options.provider as React.ComponentProps<typeof GeographyDisplayProvider>,
        probe,
      )
    : probe;
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale: options.intlLocale, messages: {} } as React.ComponentProps<
        typeof NextIntlClientProvider
      >,
      tree,
    ),
  );
}

function ListProbe() {
  const countries = useLocalizedCountries();
  return createElement(
    "ol",
    null,
    countries.slice(0, 3).map((c) => createElement("li", { key: c.code }, `${c.code}:${c.label}`)),
  );
}

function NameProbe() {
  const name = useCountryDisplayName();
  return createElement("p", null, `${name("ps")}|${name("ZZ", "Fallback")}`);
}

describe("HYD-01B — GeographyDisplayProvider", () => {
  const serverList: LocalizedCountryName[] = [
    { code: "PS", label: "SERVER-PS" },
    { code: "AR", label: "SERVER-AR" },
    { code: "JO", label: "SERVER-JO" },
  ];

  it("renders exactly the server list (no client-side recomputation)", () => {
    const html = renderWith({
      intlLocale: "ar",
      provider: { locale: "ar", countries: serverList },
      probe: ListProbe,
    });
    assert.equal(html, "<ol><li>PS:SERVER-PS</li><li>AR:SERVER-AR</li><li>JO:SERVER-JO</li></ol>");
  });

  it("looks up names by code and keeps the fallback for unknown codes", () => {
    const html = renderWith({
      intlLocale: "ar",
      provider: { locale: "ar", countries: serverList },
      probe: NameProbe,
    });
    assert.equal(html, "<p>SERVER-PS|Fallback</p>");
  });

  it("never shows a stale list when the interface locale differs from the provided list", () => {
    const html = renderWith({
      intlLocale: "he",
      provider: { locale: "ar", countries: serverList },
      probe: ListProbe,
    });
    const expected = listLocalizedCountries("he")
      .slice(0, 3)
      .map((c) => `<li>${c.code}:${c.label}</li>`)
      .join("");
    assert.equal(html, `<ol>${expected}</ol>`);
  });
});

describe("HYD-01B — consumers use the server-resolved names", () => {
  const CONSUMERS = [
    "features/world-map/components/InteractiveWorldMap.tsx",
    "features/geography-integrity/CountrySelect.tsx",
    "features/global-experience/components/GeographicNavigator.tsx",
    "features/public-home-v2/components/ApproximateIpGeographicNavigator.tsx",
    "features/civic-media-center/components/TrustedMediaRailCard.tsx",
    "features/country-experience/components/CountryExperienceDynamicPage.tsx",
  ];

  it("no audited client consumer resolves country names itself", () => {
    for (const rel of CONSUMERS) {
      const source = read(rel);
      assert.doesNotMatch(
        source,
        /getLocalizedCountryDisplayName|resolveCountryDisplayName|Intl\.DisplayNames/,
        rel,
      );
      assert.match(source, /geography-display\/GeographyDisplayProvider/, rel);
    }
  });

  it("the root layout resolves the list for the same locale as NextIntlClientProvider", () => {
    const layout = read("app/layout.tsx");
    assert.match(layout, /<NextIntlClientProvider locale=\{documentLocale\.locale\}/);
    assert.match(
      layout,
      /locale=\{documentLocale\.locale\}\s*countries=\{listLocalizedCountries\(documentLocale\.locale\)\}/,
    );
  });

  it("CountrySelect keeps canonical English names searchable", () => {
    assert.match(
      read("features/geography-integrity/CountrySelect.tsx"),
      /searchText: option\.label/,
    );
    assert.match(
      read("design-system/components/GeographySearchSelect.tsx"),
      /option\.searchText\?\.toLowerCase\(\)\.includes\(needle\)/,
    );
  });
});

describe("HYD-01B — deterministic Georgian dates", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  const nodeIcuGeorgian = (date: Date, month: "long" | "short") =>
    date.toLocaleDateString("ka", { year: "numeric", month, day: "numeric", timeZone: "UTC" });

  it("matches Node ICU Georgian output for all 12 months, long and short", () => {
    for (let month = 0; month < 12; month += 1) {
      for (const day of [1, 9, 28]) {
        const date = new Date(Date.UTC(2026, month, day));
        for (const length of ["long", "short"] as const) {
          assert.equal(
            formatUtcCalendarDate("ka", date, length),
            nodeIcuGeorgian(date, length),
            `${month + 1}/${day} ${length}`,
          );
        }
      }
    }
  });

  it("is timezone independent (UTC, America/Vancouver, Asia/Tokyo) and handles ka-GE", () => {
    const date = new Date("2026-08-01T00:00:00.000Z");
    const outputs = ["UTC", "America/Vancouver", "Asia/Tokyo"].map((tz) => {
      process.env.TZ = tz;
      return [
        formatUtcCalendarDate("ka", date, "long"),
        formatUtcCalendarDate("ka-GE", date, "short"),
      ].join("|");
    });
    assert.deepEqual(outputs, Array(3).fill("1 აგვისტო, 2026|1 აგვ. 2026"));
  });

  it("leaves other locales on Intl", () => {
    const date = new Date("2026-08-01T00:00:00.000Z");
    assert.equal(formatUtcCalendarDate("en", date, "long"), "August 1, 2026");
    assert.equal(
      formatUtcCalendarDate("uk", date, "short"),
      date.toLocaleDateString("uk", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    );
  });
});
