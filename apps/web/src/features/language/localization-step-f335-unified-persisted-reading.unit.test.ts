/**
 * F.3.35 — ordinary Web and PWA share one persisted-reading eligibility rule.
 * The legacy Registry flag is stored, not a runtime read gate.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isPwaPersistedOrdinaryReadingEligible,
  type PwaPersistedOrdinaryReadingEligibility,
} from "@hu/types";

import { resolveLocalizedPresentation } from "./resolve-localized-presentation.js";
import { resolveOrdinaryReadingOwner } from "./ordinary-reading-ownership.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const featuresRoot = path.resolve(here, "..");

function readFeatures(rel: string): string {
  return readFileSync(path.join(featuresRoot, rel), "utf8");
}

const hebrewShaped: PwaPersistedOrdinaryReadingEligibility = {
  enabled: true,
  contentTranslationEnabled: true,
  pwaPersistedReadingEnabled: false,
  pwaPersistedReadingReady: false,
};

function owner(input: {
  readonly presentationMode: "browser" | "standalone";
  readonly sourceKind: string;
  readonly eligibility?: PwaPersistedOrdinaryReadingEligibility;
  readonly language?: string;
}) {
  return resolveOrdinaryReadingOwner({
    presentationMode: input.presentationMode,
    preferredReadingLanguage: input.language ?? "xx-Future",
    sourceKind: input.sourceKind,
    pwaEligibility: input.eligibility ?? hebrewShaped,
  });
}

describe("F.3.35 unified persisted-reading eligibility", () => {
  it("A. ordinary Web stays hu-persisted when the legacy flag is false", () => {
    assert.equal(isPwaPersistedOrdinaryReadingEligible(hebrewShaped), true);
    assert.equal(
      owner({ presentationMode: "browser", sourceKind: "initiative" }),
      "hu-persisted",
    );
  });

  it("B. installed PWA uses the same owner for the same registry state", () => {
    assert.equal(
      owner({ presentationMode: "standalone", sourceKind: "initiative" }),
      "hu-persisted",
    );
  });

  it("C. enabled=false closes persisted reading", () => {
    const closed = { ...hebrewShaped, enabled: false };
    assert.equal(isPwaPersistedOrdinaryReadingEligible(closed), false);
    assert.equal(
      owner({
        presentationMode: "browser",
        sourceKind: "blog_post",
        eligibility: closed,
      }),
      "browser-native",
    );
  });

  it("D. contentTranslationEnabled=false closes persisted reading", () => {
    const closed = { ...hebrewShaped, contentTranslationEnabled: false };
    assert.equal(isPwaPersistedOrdinaryReadingEligible(closed), false);
    assert.equal(
      owner({
        presentationMode: "standalone",
        sourceKind: "civic_media",
        eligibility: closed,
      }),
      "browser-native",
    );
  });

  it("E/F/G. CURRENT artifact is used; a missing artifact falls back alone", async () => {
    assert.equal(
      owner({ presentationMode: "browser", sourceKind: "initiative" }),
      "hu-persisted",
    );
    assert.equal(
      owner({ presentationMode: "browser", sourceKind: "initiative_revision" }),
      "hu-persisted",
    );
    assert.equal(
      owner({ presentationMode: "browser", sourceKind: "blog_post" }),
      "hu-persisted",
    );

    const generates: string[] = [];
    const current = await resolveLocalizedPresentation({
      request: {
        sourceKind: "initiative",
        sourceRecordId: "initiative-current",
        displayLanguage: "xx-Future",
        ready: true,
        translationPreference: "preferred",
        enableOnDemandGenerate: true,
      },
      canonicalFields: { title: "Source title" },
      deps: {
        resolveTranslatedContent: async () => ({
          presentationMode: "preferred_translation",
          content: { title: "Localized title" },
          activeLanguage: "xx-Future",
          originalLanguage: "en",
          originalContent: { title: "Source title" },
          translation: null,
          isMachineTranslated: true,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: false,
        }),
        generateContentTranslation: async () => {
          generates.push("initiative");
          throw new Error("must not generate");
        },
      },
    });
    const missing = await resolveLocalizedPresentation({
      request: {
        sourceKind: "initiative_revision",
        sourceRecordId: "revision-missing",
        displayLanguage: "xx-Future",
        ready: true,
        translationPreference: "preferred",
        enableOnDemandGenerate: true,
      },
      canonicalFields: { title: "Revision source" },
      deps: {
        resolveTranslatedContent: async () => ({
          presentationMode: "original",
          content: { title: "Revision source" },
          activeLanguage: "en",
          originalLanguage: "en",
          originalContent: { title: "Revision source" },
          translation: null,
          isMachineTranslated: false,
          isStale: false,
          canViewOriginal: false,
          canViewTranslation: false,
        }),
        generateContentTranslation: async () => {
          generates.push("revision");
          throw new Error("must not generate");
        },
      },
    });

    assert.equal(current.fields.title, "Localized title");
    assert.equal(current.presentationMode, "preferred_translation");
    assert.equal(missing.fields.title, "Revision source");
    assert.equal(missing.presentationMode, "original");
    assert.deepEqual(generates, []);
  });

  it("H. public_news stays browser-native", () => {
    assert.equal(
      owner({ presentationMode: "browser", sourceKind: "public_news" }),
      "browser-native",
    );
    assert.equal(
      owner({ presentationMode: "standalone", sourceKind: "public_news" }),
      "browser-native",
    );
  });

  it("I. pwaPersistedReadingReady=false does not close reading", () => {
    assert.equal(
      owner({
        presentationMode: "browser",
        sourceKind: "collaborative_analysis",
        eligibility: { ...hebrewShaped, pwaPersistedReadingReady: false },
      }),
      "hu-persisted",
    );
  });

  it("J. presentationMode does not split Web and PWA", () => {
    const web = owner({ presentationMode: "browser", sourceKind: "improvement_proposal" });
    const pwa = owner({
      presentationMode: "standalone",
      sourceKind: "improvement_proposal",
    });
    assert.equal(web, pwa);
    assert.equal(web, "hu-persisted");
  });

  it("K. ordinary reading does not call the provider", () => {
    const hook = readFeatures("language/use-hu-persisted-ordinary-fields.ts");
    const fields = readFeatures("language/components/PublicTranslatedFields.tsx");
    const resolver = readFeatures("language/resolve-localized-presentation.ts");
    assert.doesNotMatch(hook, /generateContentTranslation\(/);
    assert.doesNotMatch(fields, /generateContentTranslation\(/);
    assert.match(resolver, /Never calls Gemini|never on-demand generate/i);
    assert.match(hook, /owner !== "hu-persisted"/);
  });

  it("L. eligibility has no locale or sourceKind branch", () => {
    const eligibility = readFileSync(
      path.resolve(
        here,
        "../../../../../packages/types/src/domain/language-registry.ts",
      ),
      "utf8",
    );
    const start = eligibility.indexOf("export function isPwaPersistedOrdinaryReadingEligible");
    const end = eligibility.indexOf("export function", start + 10);
    const body = eligibility.slice(start, end === -1 ? undefined : end);
    assert.doesNotMatch(body, /=== ["'](?:he|uk|ar|zh-Hant)["']|sourceKind|civic_media|locale ===/);
    assert.doesNotMatch(body, /pwaPersistedReadingEnabled/);
    assert.equal(
      owner({ presentationMode: "browser", sourceKind: "blog_post", language: "xx-Other" }),
      owner({ presentationMode: "browser", sourceKind: "blog_post", language: "xx-Future" }),
    );
    const ownership = readFeatures("language/ordinary-reading-ownership.ts");
    assert.doesNotMatch(ownership, /fetch\(|router\.refresh|measureBoundedPwaCivicCoverage/);
    assert.match(
      readFeatures("public-initiative-experience/use-initiative-public-presentation.ts"),
      /useOrdinaryReadingOwner/,
    );
    assert.match(
      readFeatures("blog/components/BlogArticlePageContent.tsx"),
      /useHuPersistedOrdinaryFields/,
    );
    assert.match(
      readFeatures("civic-media-center/components/CivicMediaCenterPageContent.tsx"),
      /useOrdinaryReadingOwner/,
    );
  });
});
