/**
 * Localization Simplification Step 02 —
 * Protect authoritative Brand / Terminology from browser translation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

describe("Localization Simplification Step 02 — Brand/Terminology translate=no", () => {
  it("shared ProtectedAuthoritativeText wrapper uses translate=\"no\"", () => {
    const src = readWeb("features/language/components/ProtectedAuthoritativeText.tsx");
    assert.match(src, /translate:\s*"no"/);
    assert.match(src, /ProtectedAuthoritativeText/);
  });

  it("localized Brand chrome is marked translate=\"no\" (header/footer/quote)", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    assert.match(header, /brand\.siteName/);
    assert.match(header, /brand\.slogan/);
    assert.match(header, /translate="no"/);
    assert.match(header, /ProtectedAuthoritativeText/);

    const footer = readWeb(
      "features/public-experience/components/PublicExperienceFooter.tsx",
    );
    assert.match(footer, /ProtectedAuthoritativeText/);
    assert.match(footer, /brand\.siteName/);
    assert.match(footer, /brand\.slogan/);

    const quote = readWeb(
      "features/public-home-v2/components/HumanityTypewriterQuote.tsx",
    );
    assert.match(quote, /translate="no"/);
    assert.match(quote, /ProtectedAuthoritativeText/);
    assert.match(quote, /heroUnityQuote|useLocalizedBrand/);
  });

  it("English Brand fallback path remains protected (same markup for any source)", () => {
    // Protection is on the render node, not branched by published_locale vs english.
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    assert.doesNotMatch(header, /source\s*===\s*["']published_locale["']/);
    assert.match(header, /translate="no"/);

    const resolve = readWeb("features/brand-localization/resolve-localized-brand.ts");
    assert.match(resolve, /CANONICAL_ENGLISH_BRAND_FALLBACK|builtin_english|published_english/);
  });

  it("MediaSemanticNode protects BRAND and TERMINOLOGY owners with translate=\"no\"", () => {
    const contract = readWeb("features/language/media-plp/media-semantic-contract.tsx");
    assert.match(contract, /owner === "BRAND"/);
    assert.match(contract, /owner === "TERMINOLOGY"/);
    assert.match(contract, /translate:\s*"no"/);

    const brandToken = readWeb(
      "features/civic-media-center/components/BrandTokenizedSemanticText.tsx",
    );
    assert.match(brandToken, /owner="BRAND"/);
    // Surrounding PLP prose remains unprotected at the owner level.
    assert.match(brandToken, /owner="PLP_ENTITY"/);
  });

  it("controlled Terminology lifecycle labels are marked translate=\"no\"", () => {
    const banner = readWeb(
      "features/public-initiative-experience/components/CurrentLifecycleStageBanner.tsx",
    );
    assert.match(banner, /ProtectedAuthoritativeText/);
    assert.match(banner, /resolveLifecycleStageDisplayLabel/);

    const nav = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeLifecycleNav.tsx",
    );
    assert.match(nav, /ProtectedAuthoritativeText/);
    assert.match(nav, /resolveLifecycleStageDisplayLabel/);

    const hero = readWeb(
      "features/public-initiative-experience/components/PublicExperienceHero.tsx",
    );
    assert.match(hero, /ProtectedAuthoritativeText/);
    assert.match(hero, /resolveLifecycleStageDisplayLabel/);

    const result = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecyclePublicResultPanel.tsx",
    );
    assert.match(result, /ProtectedAuthoritativeText/);
  });

  it("English controlled-term fallback uses the same protected render path", () => {
    const i18n = readWeb(
      "features/public-initiative-experience/initiative-experience-i18n.ts",
    );
    // Resolver still falls through to registry English when preferredTerm/WEB_UI missing.
    assert.match(i18n, /resolveControlledLifecycleLabel|resolvePublicPresentationField/);
    assert.match(i18n, /terminologyPreferredTerm:\s*null/);
    // Protection is applied at DOM wrappers, not only when preferredTerm is present.
    const banner = readWeb(
      "features/public-initiative-experience/components/CurrentLifecycleStageBanner.tsx",
    );
    assert.doesNotMatch(banner, /preferredTerm[\s\S]{0,80}ProtectedAuthoritativeText/);
  });

  it("ordinary long-form content is not globally marked translate=\"no\"", () => {
    const layout = readWeb("design-system/components/HumanityLayout.tsx");
    assert.doesNotMatch(layout, /translate=["']no["']/);

    const translatable = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/LifecycleTranslatableText.tsx",
    );
    assert.match(translatable, /translate="yes"/);

    const translatedView = readWeb(
      "features/language/components/TranslatedContentView.tsx",
    );
    assert.match(translatedView, /translate="yes"/);

    // PLP_ENTITY nodes must not auto-protect.
    const contract = readWeb("features/language/media-plp/media-semantic-contract.tsx");
    assert.doesNotMatch(
      contract,
      /owner === "PLP_ENTITY"[\s\S]{0,80}translate:\s*"no"/,
    );
  });

  it("uk/ar/zh-Hant Brand chrome still resolve through Brand Localization (unchanged path)", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    assert.match(header, /useLocalizedBrand/);
    assert.doesNotMatch(header, /hardcode|["']Humanity Union["']/);

    const footer = readWeb(
      "features/public-experience/components/PublicExperienceFooter.tsx",
    );
    assert.match(footer, /resolveBrandForMetadata/);
  });

  it("Arabic RTL document direction path is unaffected", () => {
    const doc = readWeb("features/language/document-locale-pack02c.test.ts");
    assert.match(doc, /enabled ar -> lang=ar dir=rtl/);
    const attrs = readWeb("features/language/components/DocumentLanguageAttributes.tsx");
    assert.match(attrs, /resolveDocumentHtmlLocale|no-op|intentionally a no-op/i);
  });

  it("Header/PWA LanguageSelector mounts removed (Step 03); cookie sync remains", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    const pwa = readWeb("features/pwa/components/PwaGlobalMenu.tsx");
    const layout = readWeb("design-system/components/HumanityLayout.tsx");
    assert.doesNotMatch(header, /LanguageSelector/);
    assert.doesNotMatch(mobile, /LanguageSelector/);
    assert.doesNotMatch(pwa, /LanguageSelector/);
    assert.match(layout, /InterfaceLanguageCookieSync/);
  });
});
