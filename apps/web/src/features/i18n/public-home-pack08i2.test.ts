/**
 * Pack 08I.2 — public Home deeper-body WEB_UI catalogs + residual chrome.
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

const PUBLIC_HOME_BODY_KEYS = [
  "publicHome.humanityAiPrinciple",
  "publicHome.coreValues.sectionTitle",
  "publicHome.coreValues.responsibility.word",
  "publicHome.coreValues.responsibility.hint",
  "publicHome.coreValues.justice.word",
  "publicHome.coreValues.security.word",
  "publicHome.coreValues.progress.word",
  "publicHome.opportunities.sectionTitle",
  "publicHome.opportunities.community.title",
  "publicHome.opportunities.solutions.title",
  "publicHome.opportunities.action.title",
  "publicHome.opportunities.preserve.title",
  "publicHome.pipeline.eyebrow",
  "publicHome.pipeline.title",
  "publicHome.pipeline.description",
  "publicHome.pipeline.problem.label",
  "publicHome.pipeline.archive.explanation",
  "publicHome.latestInitiatives.title",
  "publicHome.latestInitiatives.intro",
  "publicHome.latestPublicImpact.title",
  "publicHome.latestPublicImpact.intro",
  "publicHome.knowledge.title",
  "publicHome.knowledge.description",
  "publicHome.knowledge.entries.explanations.title",
  "publicHome.knowledge.entries.guides.description",
  "publicHome.knowledge.entries.civic-archive.actionLabel",
  "publicHome.ecosystem.primary",
  "publicHome.ecosystem.supporting",
  "publicHome.ecosystem.createInitiative",
  "publicHome.worldMap.title",
  "publicHome.worldMap.description",
  "publicHome.geographic.title",
  "publicHome.civicMedia.title",
  "publicHome.civicArchive.explore",
  "navigation.footerMission",
  "institutionsPublic.gridTitle",
  "institutionsPublic.gridIntro",
  "institutionsPublic.regionalTitle",
  "institutionsPublic.footerStatementLine1",
  "institutionsPublic.relatedTitle",
] as const;

const HOME_COMPONENTS_USING_PUBLIC_HOME = [
  "features/public-home-v2/components/PublicHomeHeroSection.tsx",
  "features/public-home-v2/components/PublicHomeHumanityAiPrinciple.tsx",
  "features/public-home-v2/components/PublicHomeCoreValuesSection.tsx",
  "features/public-home-v2/components/PublicHomeOpportunitySection.tsx",
  "features/public-home-v2/components/PublicHomeCivicPipelineSection.tsx",
  "features/public-home-v2/components/PublicHomeLatestInitiativesSection.tsx",
  "features/public-home-v2/components/PublicHomeLatestPublicImpactSection.tsx",
  "features/public-home-v2/components/PublicHomeKnowledgeSection.tsx",
  "features/public-home-v2/components/PublicHomeKnowledgeCollection.tsx",
  "features/public-home-v2/components/PublicHomeEcosystemStatementSection.tsx",
  "features/public-home-v2/components/PublicHomeWorldMapPlaceholderSection.tsx",
  "features/public-home-v2/components/PublicHomeGeographicNavigationSection.tsx",
  "features/public-home-v2/components/PublicHomeCivicMediaSection.tsx",
  "features/public-home-v2/components/PublicHomeCivicArchiveSection.tsx",
] as const;

describe("Pack 08I.2 — public Home deeper WEB_UI + residual chrome", () => {
  it("catalog parity covers coreValues, opportunities, pipeline, knowledge, ecosystem", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of PUBLIC_HOME_BODY_KEYS) {
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

  it("home body components use useTranslations(\"publicHome\")", () => {
    for (const relative of HOME_COMPONENTS_USING_PUBLIC_HOME) {
      const source = readWeb(relative);
      assert.match(source, /useTranslations\("publicHome"\)/, relative);
    }
  });

  it("hero/core/opportunities/pipeline do not read PUBLIC_HOME_* display strings", () => {
    const hero = readWeb("features/public-home-v2/components/PublicHomeHeroSection.tsx");
    const core = readWeb("features/public-home-v2/components/PublicHomeCoreValuesSection.tsx");
    const opportunities = readWeb(
      "features/public-home-v2/components/PublicHomeOpportunitySection.tsx",
    );
    const pipeline = readWeb(
      "features/public-home-v2/components/PublicHomeCivicPipelineSection.tsx",
    );

    assert.doesNotMatch(hero, /PUBLIC_HOME_HERO\.(headline|subheadline|primaryCta\.label|secondaryCta\.label)/);
    assert.doesNotMatch(core, /value\.(word|hint)/);
    assert.match(core, /t\(`coreValues\.\$\{value\.id\}\.word`\)/);
    assert.match(core, /t\(`coreValues\.\$\{value\.id\}\.hint`\)/);
    assert.doesNotMatch(opportunities, /opportunity\.(title|description)/);
    assert.match(opportunities, /t\(`opportunities\.\$\{opportunity\.id\}\.title`\)/);
    assert.doesNotMatch(pipeline, /step\.(label|explanation)/);
    assert.match(pipeline, /t\(`pipeline\.\$\{step\.id\}\.label`\)/);
    assert.match(pipeline, /t\("pipeline\.title"\)/);
  });

  it("footer mission and institutions chrome use catalogs", () => {
    const footer = readWeb(
      "features/public-experience/components/PublicExperienceFooter.tsx",
    );
    const institutions = readWeb(
      "features/institutions/components/InstitutionsPageContent.tsx",
    );
    const related = readWeb(
      "features/institutions/components/InstitutionsLatestInitiativesSection.tsx",
    );

    assert.match(footer, /tNav\("footerMission"\)/);
    assert.doesNotMatch(footer, /FOOTER_MISSION/);

    assert.match(institutions, /t\("gridTitle"\)/);
    assert.match(institutions, /t\("regionalTitle"\)/);
    assert.match(institutions, /t\("footerStatementLine1"\)/);
    assert.doesNotMatch(institutions, />Proposed Institutions</);
    assert.doesNotMatch(institutions, /INSTITUTIONS_FOOTER\.statement/);

    assert.match(related, /useTranslations\("institutionsPublic"\)/);
    assert.match(related, /t\("relatedTitle"\)/);
  });
});
