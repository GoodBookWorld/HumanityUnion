/**
 * Pack 08I.1 — audited public-route WEB_UI residuals + brand invariant + initiative diagnosis.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "./catalog-parity.js";
import { loadUiMessagesForLocale } from "./load-ui-messages.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readNested(messages: Record<string, unknown>, dottedPath: string): string {
  const parts = dottedPath.split(".");
  let cursor: unknown = messages;
  for (const part of parts) {
    assert.ok(cursor && typeof cursor === "object" && !Array.isArray(cursor), dottedPath);
    cursor = (cursor as Record<string, unknown>)[part];
  }
  assert.equal(typeof cursor, "string", dottedPath);
  return cursor as string;
}

const PUBLIC_ROUTE_KEYS = [
  "knowledgePublic.pageTitle",
  "knowledgePublic.pageIntro",
  "knowledgePublic.loading",
  "knowledgePublic.blogTitle",
  "knowledgePublic.openBlog",
  "institutionsPublic.headline",
  "institutionsPublic.subheadline",
  "institutionsPublic.banner",
  "institutionsPublic.primaryCta",
  "worldInitiativesPublic.pageTitle",
  "worldInitiativesPublic.pageIntro",
  "worldInitiativesPublic.unavailableTitle",
  "worldInitiativesPublic.unavailableBody",
  "publicHome.headline",
  "publicHome.subheadline",
  "publicHome.primaryCta",
  "publicHome.secondaryCta",
  "initiativeExperience.civicArchivePublic.pageTitle",
  "initiativeExperience.civicArchivePublic.resultsTitle",
  "initiativeExperience.civicArchivePublic.idleInstruction",
] as const;

describe("Pack 08I.1 — public routes WEB_UI + brand + initiative diagnosis", () => {
  it("catalog parity includes knowledge/institutions/archive/home/initiatives keys", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of PUBLIC_ROUTE_KEYS) {
        assert.equal(typeof readNested(loaded.messages, key), "string", `${locale}:${key}`);
      }
    }

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });

  it("BRAND_LOCALIZATION: HumanityHeader uses localized brand hook and ignores glossary", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    assert.match(header, /useLocalizedBrand/);
    assert.match(header, /brand\.siteName/);
    assert.match(header, /brand\.slogan/);
    assert.match(header, /humanity-header__brand-name/);
    assert.doesNotMatch(header, /terminology-glossary|terminologyGlossary|TerminologyGlossary/);
    assert.doesNotMatch(header, /admin-terminology-glossary/);
    assert.doesNotMatch(header, /useTranslations\(["']brand["']\)/);
    assert.doesNotMatch(header, /BRAND_TAGLINE/);
  });

  it("knowledge / institutions / initiatives / home chrome use catalogs", () => {
    const knowledge = readWeb(
      "features/knowledge-center/components/KnowledgeCenterPageContent.tsx",
    );
    const institutions = readWeb(
      "features/institutions/components/InstitutionsPageContent.tsx",
    );
    const initiatives = readWeb(
      "features/initiatives/components/WorldInitiativesPageContent.tsx",
    );
    const initiativesPage = readWeb("app/initiatives/page.tsx");
    const homeHero = readWeb("features/public-home-v2/components/PublicHomeHeroSection.tsx");

    assert.match(knowledge, /useTranslations\("knowledgePublic"\)/);
    assert.match(knowledge, /t\("pageTitle"\)/);
    assert.match(knowledge, /t\("pageIntro"\)/);
    assert.match(knowledge, /t\("blogTitle"\)/);
    assert.doesNotMatch(knowledge, />Knowledge Center</);

    assert.match(institutions, /useTranslations\("institutionsPublic"\)/);
    assert.match(institutions, /t\("headline"\)/);
    assert.match(institutions, /t\("subheadline"\)/);
    assert.match(institutions, /t\("banner"\)/);
    assert.match(institutions, /t\("primaryCta"\)/);
    assert.doesNotMatch(institutions, /INSTITUTIONS_HERO/);

    assert.match(initiatives, /useTranslations\("worldInitiativesPublic"\)/);
    assert.match(initiatives, /t\("pageTitle"\)/);
    assert.doesNotMatch(initiatives, />World Initiatives</);
    assert.match(initiativesPage, /getTranslations\("worldInitiativesPublic"\)/);
    assert.match(initiativesPage, /unavailableTitle/);
    assert.doesNotMatch(initiativesPage, /World initiatives temporarily unavailable/);

    assert.match(homeHero, /useTranslations\("publicHome"\)/);
    assert.match(homeHero, /t\("headline"\)/);
    assert.match(homeHero, /t\("subheadline"\)/);
    assert.match(homeHero, /t\("primaryCta"\)/);
    assert.match(homeHero, /t\("secondaryCta"\)/);
    assert.doesNotMatch(homeHero, /PUBLIC_HOME_HERO\.headline/);
  });

  it("PublicExperienceHero prefers translated title; falls back on original presentationMode", () => {
    const hero = readWeb(
      "features/public-initiative-experience/components/PublicExperienceHero.tsx",
    );
    assert.match(hero, /resolveTranslatedContent/);
    assert.match(hero, /sourceKind:\s*"initiative"/);
    assert.match(hero, /resolved\.content\.title\s*\|\|\s*title/);
    assert.match(hero, /presentationMode\s*===\s*"original"/);
    assert.match(hero, /generateContentTranslation/);
    // Civic titles remain content-owned — no UI catalog inventing initiative titles.
    assert.doesNotMatch(hero, /useTranslations\(["']initiativeTitles/);
    assert.doesNotMatch(hero, /t\(["']title["']\)/);
  });
});
