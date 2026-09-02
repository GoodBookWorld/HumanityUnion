/**
 * Pack 02I — SEO language indexability eligibility (distinct from search/translation).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isSeoIndexableLanguage } from "@hu/types";

import { isSeoIndexableLanguage as webIsSeoIndexableLanguage } from "../../lib/seo/seo-language-eligibility";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("SEO Pack 02I — language eligibility", () => {
  it("is SEO-indexable only when enabled AND seoIndexingEnabled", () => {
    assert.equal(isSeoIndexableLanguage({ enabled: true, seoIndexingEnabled: true }), true);
    assert.equal(isSeoIndexableLanguage({ enabled: true, seoIndexingEnabled: false }), false);
    assert.equal(isSeoIndexableLanguage({ enabled: false, seoIndexingEnabled: true }), false);
    assert.equal(isSeoIndexableLanguage({ enabled: false, seoIndexingEnabled: false }), false);
  });

  it("web helper re-exports the same pure rule", () => {
    assert.equal(webIsSeoIndexableLanguage({ enabled: true, seoIndexingEnabled: true }), true);
    assert.equal(webIsSeoIndexableLanguage({ enabled: true, seoIndexingEnabled: false }), false);
  });

  it("documents three distinct concepts and does not emit language alternates", () => {
    const eligibility = readWeb("lib/seo/seo-language-eligibility.ts");
    assert.match(eligibility, /searchEnabled/);
    assert.match(eligibility, /seoIndexingEnabled/);
    assert.match(eligibility, /enabled/);
    assert.match(eligibility, /contentTranslationEnabled|translation availability/i);
    assert.match(eligibility, /hreflang-policy|HREFLANG_DEFERRED|language alternates/i);

    const builder = readWeb("lib/seo/build-public-page-metadata.ts");
    assert.doesNotMatch(builder, /isSeoIndexableLanguage|alternates\.languages/);
  });
});
