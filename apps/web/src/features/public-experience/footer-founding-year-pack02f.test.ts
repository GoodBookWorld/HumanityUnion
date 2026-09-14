/**
 * Pack 02F / 08I.12 — public footer founding-year copyright (localized).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { FOOTER_COPYRIGHT_YEAR } from "../public-experience/constants";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readMessages(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(webSrc, `features/i18n/messages/${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

describe("Pack 02F / 08I.12 — footer founding year + localization", () => {
  it("footer uses founding year 2024 via ICU catalog (not © 2026)", () => {
    assert.equal(FOOTER_COPYRIGHT_YEAR, 2024);

    const constants = readFileSync(
      path.join(webSrc, "features/public-experience/constants.ts"),
      "utf8",
    );
    assert.match(constants, /FOOTER_COPYRIGHT_YEAR\s*=\s*2024/);
    assert.doesNotMatch(constants, /© 2026 Humanity Union/);

    const footer = readFileSync(
      path.join(webSrc, "features/public-experience/components/PublicExperienceFooter.tsx"),
      "utf8",
    );
    assert.match(footer, /footerCopyright/);
    assert.match(footer, /FOOTER_COPYRIGHT_YEAR/);
    assert.doesNotMatch(footer, /new Date\(\)|getFullYear/);
    assert.doesNotMatch(footer, /All rights reserved\./);
  });

  it("footerCopyright catalogs exist for en/uk/zh-Hant/ar", () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const navigation = (readMessages(locale).navigation ?? {}) as Record<string, string>;
      assert.ok(navigation.footerCopyright?.includes("{year}"));
      assert.ok(navigation.footerCopyright?.includes("{siteName}"));
    }
    const en = (readMessages("en").navigation as Record<string, string>).footerCopyright ?? "";
    assert.match(en, /All rights reserved/);
    const uk = (readMessages("uk").navigation as Record<string, string>).footerCopyright ?? "";
    assert.match(uk, /Усі права захищено/);
  });
});
