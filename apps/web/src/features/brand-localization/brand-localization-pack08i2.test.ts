/**
 * Pack 08I.2 — Brand Localization web wiring checks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADMIN_PANEL_SECTIONS,
  resolveAdminPanelSectionId,
} from "../administration/admin-panel-sections";
import { HREFLANG_DEFERRED_REASON, HREFLANG_STATUS } from "../../lib/seo/hreflang-policy";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 08I.2 — Brand Localization web", () => {
  it("Admin brand-localization tab exists between languages and terminology-glossary", () => {
    assert.ok(ADMIN_PANEL_SECTIONS.some((section) => section.id === "brand-localization"));
    assert.equal(
      resolveAdminPanelSectionId("/admin/brand-localization"),
      "brand-localization",
    );

    const languageIndex = ADMIN_PANEL_SECTIONS.findIndex((s) => s.id === "languages");
    const brandIndex = ADMIN_PANEL_SECTIONS.findIndex((s) => s.id === "brand-localization");
    const glossaryIndex = ADMIN_PANEL_SECTIONS.findIndex(
      (s) => s.id === "terminology-glossary",
    );
    assert.ok(languageIndex >= 0 && brandIndex > languageIndex && glossaryIndex > brandIndex);

    assert.match(readWeb("app/admin/brand-localization/page.tsx"), /AdminAccessGate/);
    assert.match(
      readWeb("app/admin/brand-localization/page.tsx"),
      /AdminBrandLocalizationSection/,
    );
    assert.match(
      readWeb("features/administration/admin-brand-localization-api.ts"),
      /\/api\/v1\/admin\/brand-localization/,
    );
  });

  it("header uses useLocalizedBrand and does not import glossary", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    assert.match(header, /useLocalizedBrand/);
    assert.match(header, /brand\.siteName/);
    assert.match(header, /brand\.slogan/);
    assert.doesNotMatch(header, /terminology-glossary|terminologyGlossary|TerminologyGlossary/);
    assert.doesNotMatch(header, /BRAND_TAGLINE/);
    assert.doesNotMatch(header, /useTranslations\(["']brand["']\)/);
  });

  it("PWA manifest stays static English canonical brand", () => {
    const manifest = readWeb("app/manifest.ts");
    assert.match(manifest, /PWA_BRAND/);
    assert.match(manifest, /CANONICAL_ENGLISH_BRAND_FALLBACK/);
    assert.match(manifest, /cannot vary by runtime/i);
    assert.doesNotMatch(manifest, /resolveBrandForMetadata|useLocalizedBrand/);
  });

  it("hreflang remains deferred", () => {
    assert.equal(HREFLANG_STATUS, "DEFERRED");
    assert.match(HREFLANG_DEFERRED_REASON, /locale-addressable|misleading|cookie/i);
  });

  it("brand strings do not require UI message catalog", () => {
    const hook = readWeb("features/brand-localization/useLocalizedBrand.ts");
    const resolve = readWeb("features/brand-localization/resolve-localized-brand.ts");
    assert.doesNotMatch(hook, /useTranslations|loadUiMessages/);
    assert.doesNotMatch(resolve, /useTranslations|loadUiMessages|messages\/en\.json/);
    assert.match(resolve, /CANONICAL_ENGLISH_BRAND_FALLBACK|builtin/);
  });

  it("footer and SEO metadata wire resolveBrandForMetadata", () => {
    assert.match(
      readWeb("features/public-experience/components/PublicExperienceFooter.tsx"),
      /resolveBrandForMetadata/,
    );
    assert.match(readWeb("app/page.tsx"), /resolveBrandForMetadata/);
    assert.match(readWeb("app/search/page.tsx"), /titleBrandSuffix:\s*brand\.seoTitleSuffix/);
    assert.match(
      readWeb("app/initiatives/public/[initiativeId]/page.tsx"),
      /titleBrandSuffix:\s*brand\.seoTitleSuffix/,
    );
  });

  it("home SEO uses Brand Localization directly (not seo.home catalog override)", () => {
    const page = readWeb("app/page.tsx");
    assert.match(page, /brand\.seoSiteName/);
    assert.match(page, /brand\.defaultMetaDescription/);
    assert.match(page, /brand\.openGraphBrandName/);
    assert.match(page, /openGraphSiteName:\s*brand\.openGraphBrandName/);
    assert.doesNotMatch(page, /getTranslations\(["']seo\.home["']\)/);
    assert.doesNotMatch(page, /resolveLocalizedPublicMetadataCopy/);
    assert.match(page, /canonicalPath:\s*["']\/["']/);
  });

  it("search/initiative SEO pass openGraphSiteName; canonical paths unchanged", () => {
    const search = readWeb("app/search/page.tsx");
    const initiative = readWeb("app/initiatives/public/[initiativeId]/page.tsx");
    assert.match(search, /openGraphSiteName/);
    assert.match(search, /canonicalPath:\s*["']\/search["']/);
    assert.match(search, /siteName:\s*brand\.seoSiteName/);
    assert.match(initiative, /openGraphSiteName/);
    assert.match(initiative, /canonicalPath/);
    assert.match(initiative, /on \$\{brand\.seoSiteName\}/);
    assert.doesNotMatch(initiative, /on Humanity Union/);
  });

  it("buildPublicPageMetadata supports openGraphSiteName", () => {
    const builder = readWeb("lib/seo/build-public-page-metadata.ts");
    assert.match(builder, /openGraphSiteName\?:/);
    assert.match(builder, /siteName:\s*openGraphSiteName/);
  });

  it("footer headings use navigation catalog WEB_UI keys", () => {
    const footer = readWeb("features/public-experience/components/PublicExperienceFooter.tsx");
    assert.match(footer, /footerPlatformHeading/);
    assert.match(footer, /footerLegalHeading/);
    assert.doesNotMatch(footer, /FOOTER_CONTENT\.platformHeading|FOOTER_CONTENT\.legalHeading/);
  });

  it("Admin form includes heroUnityQuote for Pack 08I.3", () => {
    const admin = readWeb(
      "features/administration/components/AdminBrandLocalizationSection.tsx",
    );
    assert.match(admin, /heroUnityQuote/);
    assert.match(admin, /Hero unity quote/);
  });
});
