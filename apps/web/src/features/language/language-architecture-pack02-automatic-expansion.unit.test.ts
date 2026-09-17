/**
 * Language Architecture Pack 02 — Registry-driven PWA ordinary reading ownership.
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

const eligible: PwaPersistedOrdinaryReadingEligibility = {
  enabled: true,
  contentTranslationEnabled: true,
  pwaPersistedReadingEnabled: true,
  pwaPersistedReadingReady: true,
};

describe("Language Architecture Pack 02 — ordinary reading ownership", () => {
  it("1. normal WEB + arbitrary CT-enabled locale → browser-native", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "browser",
        preferredReadingLanguage: "xx-Future",
        sourceKind: "initiative",
        pwaEligibility: eligible,
      }),
      "browser-native",
    );
  });

  it("2. standalone PWA + Registry activation gates → hu-persisted", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "xx-Future",
        sourceKind: "initiative",
        pwaEligibility: eligible,
      }),
      "hu-persisted",
    );
  });

  it("3. pwaPersistedReadingEnabled=false → browser-native", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "xx-Future",
        sourceKind: "initiative",
        pwaEligibility: { ...eligible, pwaPersistedReadingEnabled: false },
      }),
      "browser-native",
    );
  });

  it("4. Version 5.0: readiness false does not disable PWA persisted reading", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "xx-Future",
        sourceKind: "blog_post",
        pwaEligibility: { ...eligible, pwaPersistedReadingReady: false },
      }),
      "hu-persisted",
    );
  });

  it("5. arbitrary future locale can be PWA eligible without source allowlist", () => {
    assert.equal(
      shouldResolveHuPersistedOrdinaryReading({
        presentationMode: "standalone",
        preferredReadingLanguage: "xx-TestLocale",
        sourceKind: "collaborative_analysis",
        pwaEligibility: eligible,
      }),
      true,
    );
    const ownership = readFeatures("language/ordinary-reading-ownership.ts");
    assert.doesNotMatch(ownership, /PWA_PERSISTED_ORDINARY_READING_LANGUAGES/);
    assert.doesNotMatch(ownership, /\["uk",\s*"ar",\s*"zh-Hant"\]/);
  });

  it("6. uk/ar/zh-Hant retain Pack 01 behavior when Registry activation gates pass", () => {
    for (const language of ["uk", "ar", "zh-Hant"] as const) {
      assert.equal(
        resolveOrdinaryReadingOwner({
          presentationMode: "standalone",
          preferredReadingLanguage: language,
          sourceKind: "initiative",
          pwaEligibility: { ...eligible, pwaPersistedReadingReady: false },
        }),
        "hu-persisted",
      );
      assert.equal(
        resolveOrdinaryReadingOwner({
          presentationMode: "browser",
          preferredReadingLanguage: language,
          sourceKind: "initiative",
          pwaEligibility: eligible,
        }),
        "browser-native",
      );
    }
  });

  it("7. English remains canonical", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "en",
        sourceKind: "blog_post",
        pwaEligibility: eligible,
      }),
      "browser-native",
    );
  });

  it("8. public_news remains source-original for current and future locales", () => {
    assert.equal(isOrdinaryReadingPublicNewsExclusion("public_news"), true);
    for (const language of ["uk", "xx-Future", "ar"] as const) {
      assert.equal(
        resolveOrdinaryReadingOwner({
          presentationMode: "standalone",
          preferredReadingLanguage: language,
          sourceKind: "public_news",
          pwaEligibility: eligible,
        }),
        "browser-native",
      );
    }
  });

  it("19. Registry disable removes PWA persisted eligibility", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "uk",
        sourceKind: "initiative",
        pwaEligibility: { ...eligible, enabled: false },
      }),
      "browser-native",
    );
  });

  it("23. no hardcoded locale eligibility remains in PWA ordinary-reading runtime", () => {
    const ownership = readFeatures("language/ordinary-reading-ownership.ts");
    const ownerHook = readFeatures("language/use-ordinary-reading-owner.ts");
    assert.doesNotMatch(ownership, /PWA_PERSISTED_ORDINARY_READING_LANGUAGES/);
    assert.doesNotMatch(ownership, /isPwaPersistedOrdinaryReadingLanguage/);
    assert.match(ownerHook, /listSelectablePublicLanguages/);
    assert.match(ownerHook, /pwaEligibility/);
  });
});

describe("Language Architecture Pack 02 — surface invariants", () => {
  it("12. CA/IP late mount still uses PublicTranslatedFields ownership path", () => {
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

  it("13. Civic Media preserves PLP ownership under hu-persisted gate", () => {
    const page = readFeatures("civic-media-center/components/CivicMediaCenterPageContent.tsx");
    assert.match(page, /useOrdinaryReadingOwner/);
    assert.match(page, /civicMediaOwner === "hu-persisted" \? plpEditorial/);
  });

  it("Admin labels PWA civic as presentation coverage", () => {
    const admin = readFeatures("administration/components/AdminLanguagesSection.tsx");
    assert.match(admin, /PWA civic presentation coverage/);
  });

  it("11. provider is never called from visible-reading path", () => {
    const fields = readFeatures("language/components/PublicTranslatedFields.tsx");
    const hook = readFeatures("language/use-hu-persisted-ordinary-fields.ts");
    assert.doesNotMatch(hook, /generateContentTranslation\(/);
    assert.doesNotMatch(fields, /generateContentTranslation\(/);
    assert.match(hook, /resolveTranslatedContent/);
  });

  it("22. Registry textDirection remains RTL source of truth (no locale hardcode in owner)", () => {
    const ownership = readFeatures("language/ordinary-reading-ownership.ts");
    assert.doesNotMatch(ownership, /=== "ar"|=== 'ar'|RTL_LANGUAGE/);
    const resolveDoc = readFeatures("language/resolve-document-locale.ts");
    assert.match(resolveDoc, /textDirection/);
  });
});

describe("Version 5.0 — PWA persisted reading vs corpus readiness", () => {
  const activatedNotReady: PwaPersistedOrdinaryReadingEligibility = {
    enabled: true,
    contentTranslationEnabled: true,
    pwaPersistedReadingEnabled: true,
    pwaPersistedReadingReady: false,
  };

  it("standalone + activated language + ready=false → hu-persisted for ordinary kinds", () => {
    for (const sourceKind of [
      "initiative",
      "collaborative_analysis",
      "improvement_proposal",
      "blog_post",
      "civic_media",
      "discussion_comment",
    ] as const) {
      assert.equal(
        resolveOrdinaryReadingOwner({
          presentationMode: "standalone",
          preferredReadingLanguage: "uk",
          sourceKind,
          pwaEligibility: activatedNotReady,
        }),
        "hu-persisted",
        sourceKind,
      );
    }
  });

  it("Preferred Reading change recomputes ownership without allowlist", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "ar",
        sourceKind: "initiative",
        pwaEligibility: activatedNotReady,
      }),
      "hu-persisted",
    );
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "zh-Hant",
        sourceKind: "improvement_proposal",
        pwaEligibility: activatedNotReady,
      }),
      "hu-persisted",
    );
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "xx-FutureLang",
        sourceKind: "collaborative_analysis",
        pwaEligibility: activatedNotReady,
      }),
      "hu-persisted",
    );
    const ownerHook = readFeatures("language/use-ordinary-reading-owner.ts");
    assert.match(ownerHook, /\[preferredReadingLanguage\]/);
  });

  it("per-artifact CURRENT resolve + canonical fallback remain ownership-gated (not readiness)", () => {
    const hook = readFeatures("language/use-hu-persisted-ordinary-fields.ts");
    assert.match(hook, /owner !== "hu-persisted"/);
    assert.match(hook, /resolveTranslatedContent/);
    assert.match(hook, /if \(!complete\)/);
    assert.match(hook, /setPresentationMode\("original"\)/);
    assert.doesNotMatch(hook, /pwaPersistedReadingReady/);
    assert.doesNotMatch(hook, /generateContentTranslation\(/);
  });

  it("Admin readiness fields remain in contracts (not removed)", () => {
    const admin = readFeatures("administration/components/AdminLanguagesSection.tsx");
    assert.match(admin, /pwaCivicReadinessStatus/);
    assert.match(admin, /pwaPersistedReadingReady/);
    const api = readFeatures("language/public-languages-api.ts");
    assert.match(api, /pwaPersistedReadingReady/);
  });

  it("Civic Media PLP remains reachable when owner is hu-persisted despite ready=false", () => {
    assert.equal(
      shouldResolveHuPersistedOrdinaryReading({
        presentationMode: "standalone",
        preferredReadingLanguage: "uk",
        sourceKind: "civic_media",
        pwaEligibility: activatedNotReady,
      }),
      true,
    );
    const page = readFeatures("civic-media-center/components/CivicMediaCenterPageContent.tsx");
    assert.match(page, /civicMediaOwner === "hu-persisted" \? plpEditorial/);
  });

  it("public_news stays excluded even when activation gates pass and ready=false", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "standalone",
        preferredReadingLanguage: "uk",
        sourceKind: "public_news",
        pwaEligibility: activatedNotReady,
      }),
      "browser-native",
    );
  });

  it("normal WEB stays browser-native when activation gates pass", () => {
    assert.equal(
      resolveOrdinaryReadingOwner({
        presentationMode: "browser",
        preferredReadingLanguage: "uk",
        sourceKind: "initiative",
        pwaEligibility: activatedNotReady,
      }),
      "browser-native",
    );
  });
});
