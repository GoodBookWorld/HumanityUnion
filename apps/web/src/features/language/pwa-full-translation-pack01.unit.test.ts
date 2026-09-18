/**
 * PWA Full Translation Pack 01 — ordinary-reading ownership + WEB invariant.
 * Pack 02 generalized the allowlist to Registry/readiness gates; Pack 01
 * behavioral invariants for uk/ar/zh-Hant remain under those gates.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { PwaPersistedOrdinaryReadingEligibility } from "@hu/types";

import {
  isOrdinaryReadingPublicNewsExclusion,
  resolveOrdinaryReadingOwner,
  shouldResolveHuPersistedOrdinaryReading,
} from "./ordinary-reading-ownership.js";

const languageDir = path.dirname(fileURLToPath(import.meta.url));
const featuresRoot = path.resolve(languageDir, "..");

function readFeatures(rel: string): string {
  return readFileSync(path.join(featuresRoot, rel), "utf8");
}

const pack01Eligible: PwaPersistedOrdinaryReadingEligibility = {
  enabled: true,
  contentTranslationEnabled: true,
  pwaPersistedReadingEnabled: true,
  pwaPersistedReadingReady: true,
};

const pack01EligibleNotReady: PwaPersistedOrdinaryReadingEligibility = {
  ...pack01Eligible,
  pwaPersistedReadingReady: false,
};

describe("PWA Full Translation Pack 01 — ordinary reading ownership", () => {
  it("enables hu-persisted for standalone + uk|ar|zh-Hant when Registry gates pass", () => {
    for (const language of ["uk", "ar", "zh-Hant"] as const) {
      assert.equal(
        resolveOrdinaryReadingOwner({
          presentationMode: "standalone",
          preferredReadingLanguage: language,
          sourceKind: "initiative",
          pwaEligibility: pack01Eligible,
        }),
        "hu-persisted",
      );
      assert.equal(
        shouldResolveHuPersistedOrdinaryReading({
          presentationMode: "standalone",
          preferredReadingLanguage: language,
          sourceKind: "collaborative_analysis",
          pwaEligibility: pack01EligibleNotReady,
        }),
        true,
      );
    }
  });

  it("keeps Web and PWA eligible for uk/ar/zh-Hant when Registry gates pass", () => {
    for (const language of ["uk", "ar", "zh-Hant"] as const) {
      assert.equal(
        resolveOrdinaryReadingOwner({
          presentationMode: "browser",
          preferredReadingLanguage: language,
          sourceKind: "initiative",
          pwaEligibility: pack01Eligible,
        }),
        "hu-persisted",
      );
    }
  });

  it("keeps standalone English as browser-native / canonical", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "en",
        sourceKind: "blog_post",
        pwaEligibility: pack01Eligible,
      }),
      "browser-native",
    );
  });

  it("excludes Public News RSS from hu-persisted in PWA", () => {
    assert.equal(isOrdinaryReadingPublicNewsExclusion("public_news"), true);
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "uk",
        sourceKind: "public_news",
        pwaEligibility: pack01Eligible,
      }),
      "browser-native",
    );
  });
});

describe("PWA Full Translation Pack 01 — surface wiring", () => {
  it("PublicTranslatedFields uses ownership-gated cache-only resolve (no generate)", () => {
    const fields = readFeatures("language/components/PublicTranslatedFields.tsx");
    const hook = readFeatures("language/use-hu-persisted-ordinary-fields.ts");
    assert.match(fields, /useHuPersistedOrdinaryFields/);
    assert.match(fields, /data-hu-reading-owner=\{readingOwner\}/);
    assert.match(hook, /resolveTranslatedContent/);
    assert.doesNotMatch(hook, /generateContentTranslation\(/);
    assert.doesNotMatch(fields, /generateContentTranslation\(/);
    assert.match(hook, /owner !== "hu-persisted"/);
  });

  it("Pack 1 WEB invariant: ownership defaults browser-native before standalone ready", () => {
    const ownerHook = readFeatures("language/use-ordinary-reading-owner.ts");
    assert.match(ownerHook, /useState<HuPresentationMode>\("browser"\)/);
    assert.match(ownerHook, /ownershipReady/);
    assert.match(ownerHook, /: "browser-native"/);
  });

  it("CA/IP PublicResults still use PublicTranslatedFields (PWA resolves via shared owner)", () => {
    const ca = readFeatures(
      "initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult.tsx",
    );
    const ip = readFeatures(
      "initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
    );
    assert.match(ca, /PublicTranslatedFields/);
    assert.match(ip, /PublicTranslatedFields/);
    assert.doesNotMatch(ca, /generateContentTranslation/);
    assert.doesNotMatch(ip, /generateContentTranslation/);
  });

  it("Initiative presentation restores CT only through ownership gate", () => {
    const hook = readFeatures(
      "public-initiative-experience/use-initiative-public-presentation.ts",
    );
    assert.match(hook, /useOrdinaryReadingOwner/);
    assert.match(hook, /owner !== "hu-persisted"/);
    assert.match(hook, /resolveInitiativeDetailPresentation/);
  });

  it("Discussion comments resolve body via hu-persisted ownership gate", () => {
    const panel = readFeatures(
      "public-initiative-experience/components/PublicDiscussionPanel.tsx",
    );
    assert.match(panel, /DiscussionCommentBody/);
    assert.match(panel, /useHuPersistedOrdinaryFields/);
    assert.match(panel, /discussion_comment/);
  });

  it("Blog article/card use ownership-gated persisted fields", () => {
    const article = readFeatures("blog/components/BlogArticlePageContent.tsx");
    const card = readFeatures("blog/components/BlogPostCard.tsx");
    assert.match(article, /useHuPersistedOrdinaryFields/);
    assert.match(card, /useHuPersistedOrdinaryFields/);
    assert.doesNotMatch(article, /generateContentTranslation/);
    assert.doesNotMatch(card, /generateContentTranslation/);
  });

  it("Public News RSS remains original in PWA (no CT/PLP visible apply)", () => {
    const newsHook = readFeatures("public-news/use-localized-public-news-card.ts");
    const card = readFeatures("public-news/components/PublicNewsCard.tsx");
    assert.match(newsHook, /plpPresentation: null/);
    assert.match(newsHook, /never HU-persisted|Pack 01/i);
    assert.match(card, /data-hu-ordinary-reading-exclusion="public-news-rss"/);
    assert.match(card, /data-hu-reading-owner="browser-native"/);
    assert.doesNotMatch(newsHook, /generateContentTranslation/);
  });

  it("Civic Media preserves PLP overlay only under hu-persisted owner", () => {
    const page = readFeatures("civic-media-center/components/CivicMediaCenterPageContent.tsx");
    const editorial = readFeatures(
      "civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
    );
    assert.match(page, /useOrdinaryReadingOwner/);
    assert.match(page, /civicMediaOwner === "hu-persisted" \? plpEditorial/);
    assert.match(editorial, /owner === "hu-persisted" && initialEditorial/);
    assert.match(page, /selectCivicMediaFactCheckOrdinaryPresentation/);
    assert.match(page, /selectCivicMediaPropagandaOrdinaryPresentation/);
    assert.doesNotMatch(page, /void factCheckMaps/);
  });

  it("Author Mode / generate-on-read remain retired on ordinary reading path", () => {
    const fields = readFeatures("language/components/PublicTranslatedFields.tsx");
    const hook = readFeatures("language/use-hu-persisted-ordinary-fields.ts");
    assert.match(fields, /enableOnDemandGenerate/);
    assert.match(fields, /ignored/);
    assert.doesNotMatch(hook, /generateIfMissing:\s*true/);
    assert.doesNotMatch(hook, /generateContentTranslation\(/);
    assert.doesNotMatch(fields, /generateContentTranslation\(/);
  });
});
