/**
 * A11Y-01 — active chip contrast (WCAG 1.4.3), country page main landmark,
 * geography select Label in Name (WCAG 2.5.3).
 *
 * Rendered checks on real pages live in `a11y-01-public-corrections.playwright.e2e.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { GeographySearchSelect as GeographySearchSelectFn } from "../../design-system/components/GeographySearchSelect.js";

type GeographySearchSelectComponent = typeof GeographySearchSelectFn;
let GeographySearchSelect: GeographySearchSelectComponent;

before(async () => {
  // The test runner compiles JSX with the classic runtime.
  (globalThis as { React?: typeof React }).React = React;
  ({ GeographySearchSelect } =
    await import("../../design-system/components/GeographySearchSelect.js"));
});

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) => readFileSync(path.join(webSrc, rel), "utf8");

type Rgb = [number, number, number];
const hex = (value: string): Rgb =>
  [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) as Rgb;
const luminance = ([r, g, b]: Rgb) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe("A11Y-01 — active chip contrast", () => {
  const css = read("features/civic-media-center/media-rail/civic-media-section-shell.css");
  const rule =
    css.match(
      /\.horizontal-section-chip--active,\s*\.civic-media-chip--active\s*\{([^}]*)\}/,
    )?.[1] ?? "";
  const tokens = read("design-system/tokens.css");

  it("uses --hu-color-primary-hover for active chip text", () => {
    assert.match(rule, /color:\s*var\(--hu-color-primary-hover,\s*#015f92\)/);
    assert.match(tokens, /--hu-color-primary-hover:\s*#015f92/);
  });

  const tabRule =
    css.match(/\.trusted-media-category-tabs__tab\[aria-selected="true"\]\s*\{([^}]*)\}/)?.[1] ??
    "";

  it("uses --hu-color-primary-hover for the selected /media category tab", () => {
    assert.match(tabRule, /color:\s*var\(--hu-color-primary-hover,\s*#015f92\)/);
  });

  for (const [label, body] of [
    ["active chips", rule],
    ["selected category tab", tabRule],
  ] as const) {
    it(`${label} meet 4.5:1 over their primary tint on white, country and /media panels`, () => {
      const tintAlpha = Number(body.match(/background:\s*rgb\(1 116 176 \/ ([\d.]+)\)/)?.[1]);
      assert.ok(tintAlpha > 0 && tintAlpha < 0.2, `${label} tint alpha`);
      const primary: Rgb = [1, 116, 176];
      for (const panel of ["#ffffff", "#f4f7fa", "#eef3f7"]) {
        const base = hex(panel);
        const surface = base.map((c, i) => c * (1 - tintAlpha) + primary[i]! * tintAlpha) as Rgb;
        const ratio = contrast(hex("#015f92"), surface);
        assert.ok(ratio >= 4.5, `${label} on ${panel}: ${ratio.toFixed(2)}`);
      }
    });
  }
});

describe("A11Y-01 — main landmark", () => {
  it("country page renders exactly one <main> (root of CountryExperienceDynamicPage)", () => {
    const page = read("features/country-experience/components/CountryExperienceDynamicPage.tsx");
    assert.match(page, /<main className="country-experience-dynamic">/);
    assert.equal((page.match(/<main\b/g) ?? []).length, 1);
    assert.doesNotMatch(read("app/countries/[countryCode]/page.tsx"), /<main\b/);
  });

  it("region page keeps its existing single <main> (no nesting added)", () => {
    const region = read("features/region-experience/components/RegionExperiencePage.tsx");
    assert.equal((region.match(/<main\b/g) ?? []).length, 1);
    assert.match(region, /<div className="region-experience-page">/);
    assert.doesNotMatch(read("app/region/[regionSlug]/page.tsx"), /<main\b/);
  });
});

describe("A11Y-01 — GeographySearchSelect Label in Name", () => {
  const render = (value: string) =>
    renderToStaticMarkup(
      createElement(
        GeographySearchSelect as ComponentType<Parameters<GeographySearchSelectComponent>[0]>,
        {
          id: "country-page-region",
          label: "Region",
          value,
          options: [
            { slug: "CA-BC", label: "British Columbia" },
            { slug: "CA-ON", label: "Ontario" },
          ],
          onChange: () => undefined,
          emptyOptionLabel: "Select…",
        },
      ),
    );

  function nameParts(html: string): string[] {
    const labelledby = html.match(/<button[^>]*aria-labelledby="([^"]+)"/)?.[1] ?? "";
    return labelledby.split(" ").map((id) => {
      const text = html.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`))?.[1];
      assert.ok(text !== undefined, `element #${id} must exist`);
      return text;
    });
  }

  it("names the trigger by its label followed by the visible placeholder", () => {
    assert.deepEqual(nameParts(render("")), ["Region", "Select…"]);
  });

  it("names the trigger by its label followed by the visible selected value", () => {
    assert.deepEqual(nameParts(render("CA-BC")), ["Region", "British Columbia"]);
  });
});
