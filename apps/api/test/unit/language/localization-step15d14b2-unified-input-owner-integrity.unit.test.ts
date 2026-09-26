/**
 * STEP 15D.14.B.2 — unified localization input & owner integrity.
 * Architecture regression suite (A–K). No provider calls. No durable writes.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { TerminologyConcept, TranslatedContentRecord } from "@hu/types";

import {
  buildLocalizationInputVersionFromConcepts,
  classifyLocalizationInputCurrentness,
  sourceContainsCanonicalTerm,
} from "../../../src/modules/language/localization-input-contract.js";
import {
  assessRequiredTerminologyProtection,
} from "../../../src/modules/language/terminology-protection-contract.js";
import {
  classifyContentTranslationValidity,
} from "../../../src/modules/language/content-translation-validity.js";
import {
  buildParticipantPublicCanonicalPresentation,
  buildParticipantPublicMachineContentFingerprintInput,
} from "../../../src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.js";
import { resolveCanonicalRegistryLocale } from "../../../src/modules/language/language-registry/index.js";
import {
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/language-registry/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function concept(input: {
  conceptId: string;
  canonicalEnglishTerm: string;
  category: TerminologyConcept["category"];
  preferredByLocale?: Record<string, string>;
}): TerminologyConcept {
  const translations: TerminologyConcept["translations"] = {};
  for (const [locale, preferredTerm] of Object.entries(
    input.preferredByLocale ?? {},
  )) {
    translations[locale] = { preferredTerm, aliases: [] };
  }
  return {
    conceptId: input.conceptId,
    canonicalEnglishTerm: input.canonicalEnglishTerm,
    category: input.category,
    status: "published",
    translations,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const HUMANITY_UNION = concept({
  conceptId: "humanity_union",
  canonicalEnglishTerm: "Humanity Union",
  category: "brand",
  preferredByLocale: {
    "zh-Hant": "人道聯盟協會",
    ar: "اتحاد الإنسانية",
  },
});

const INITIATIVE = concept({
  conceptId: "initiative",
  canonicalEnglishTerm: "Initiative",
  category: "workflow_stage",
  preferredByLocale: {
    "zh-Hant": "倡議",
  },
});

const UNRELATED = concept({
  conceptId: "workspace",
  canonicalEnglishTerm: "Workspace",
  category: "domain",
  preferredByLocale: {
    "zh-Hant": "工作空間-CHANGED",
  },
});

function baseCt(overrides: Partial<TranslatedContentRecord>): TranslatedContentRecord {
  return {
    translationId: "t1",
    sourceKind: "initiative",
    sourceRecordId: "init-1",
    sourceVersion: "v-source",
    sourceLanguage: "en",
    targetLanguage: "zh-Hant",
    translatedContent: { title: "localized" },
    translationProvider: "gemini",
    translationKind: "machine",
    createdAt: "2026-09-01T00:00:00.000Z",
    stale: false,
    freshness: "current",
    ...overrides,
  };
}

describe("15D.14.B.2 — localization input / terminology / owners", () => {
  it("A. source unchanged + relevant terminology changed → no longer READY", () => {
    const sourceText = "Welcome to Humanity Union civic work";
    const before = buildLocalizationInputVersionFromConcepts({
      sourceVersion: "v1",
      targetLocale: "zh-Hant",
      concepts: [
        {
          ...HUMANITY_UNION,
          translations: {
            "zh-Hant": { preferredTerm: "人類聯盟", aliases: [] },
          },
        },
      ],
      sourceText,
    });
    const after = buildLocalizationInputVersionFromConcepts({
      sourceVersion: "v1",
      targetLocale: "zh-Hant",
      concepts: [HUMANITY_UNION],
      sourceText,
    });
    assert.notEqual(
      before.localizationInputVersion,
      after.localizationInputVersion,
    );
    assert.equal(
      classifyLocalizationInputCurrentness({
        storedLocalizationInputVersion: before.localizationInputVersion,
        liveLocalizationInputVersion: after.localizationInputVersion,
      }),
      "stale",
    );
    const row = baseCt({
      localizationInputVersion: before.localizationInputVersion,
      translatedContent: { title: "人類聯盟 歡迎" },
    });
    const validity = classifyContentTranslationValidity({
      translation: row,
      liveSourceVersion: "v-source",
      liveLocalizationInputVersion: after.localizationInputVersion,
    });
    assert.equal(validity.reconciliationState, "STALE");
    assert.equal(validity.presentationEligible, false);
  });

  it("B. unrelated terminology change does not invalidate", () => {
    const sourceText = "Humanity Union Initiative launch";
    const withWorkspaceA = buildLocalizationInputVersionFromConcepts({
      sourceVersion: "v1",
      targetLocale: "zh-Hant",
      concepts: [
        HUMANITY_UNION,
        INITIATIVE,
        {
          ...UNRELATED,
          translations: {
            "zh-Hant": { preferredTerm: "工作空間", aliases: [] },
          },
        },
      ],
      sourceText,
    });
    const withWorkspaceB = buildLocalizationInputVersionFromConcepts({
      sourceVersion: "v1",
      targetLocale: "zh-Hant",
      concepts: [HUMANITY_UNION, INITIATIVE, UNRELATED],
      sourceText,
    });
    assert.equal(
      withWorkspaceA.localizationInputVersion,
      withWorkspaceB.localizationInputVersion,
    );
  });

  it("C. shared terminology contract helpers exist for CT and PLP", () => {
    const providerBoundary = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/media-plp-materializer/provider-boundary.ts",
      ),
      "utf8",
    );
    const ctService = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/content-translation.service.ts",
      ),
      "utf8",
    );
    assert.match(providerBoundary, /resolveSharedProviderTerminologyContext/);
    assert.match(providerBoundary, /assessRequiredTerminologyProtection/);
    assert.match(ctService, /assertRequiredTerminologyProtection/);
    assert.match(ctService, /localizationInputVersion/);
  });

  it("D. Humanity Union required preferred term (generic, no locale branch)", () => {
    const ok = assessRequiredTerminologyProtection({
      concepts: [HUMANITY_UNION],
      targetLocale: "zh-Hant",
      sourceText: "Join Humanity Union today",
      translatedText: "立即加入人道聯盟協會",
    });
    assert.equal(ok.ok, true);

    const missing = assessRequiredTerminologyProtection({
      concepts: [HUMANITY_UNION],
      targetLocale: "zh-Hant",
      sourceText: "Join Humanity Union today",
      translatedText: "立即加入 Humanity Union",
    });
    assert.equal(missing.ok, false);
    assert.ok(
      missing.violations.some(
        (v) =>
          v.conceptId === "humanity_union" &&
          (v.reason === "missing_preferred" || v.reason === "residual_canonical"),
      ),
    );

    const arOk = assessRequiredTerminologyProtection({
      concepts: [HUMANITY_UNION],
      targetLocale: "ar",
      sourceText: "Join Humanity Union today",
      translatedText: "انضم إلى اتحاد الإنسانية اليوم",
    });
    assert.equal(arOk.ok, true);
  });

  it("E. mixed …Initiative residual English is INVALID at protection boundary", () => {
    assert.equal(sourceContainsCanonicalTerm("全球人類資本與民主Initiative", "Initiative"), true);
    const mixed = assessRequiredTerminologyProtection({
      concepts: [INITIATIVE],
      targetLocale: "zh-Hant",
      sourceText: "Global Human Capital and Democracy Initiative",
      translatedText: "全球人類資本與民主Initiative",
    });
    assert.equal(mixed.ok, false);
    assert.ok(
      mixed.violations.some(
        (v) =>
          v.conceptId === "initiative" &&
          (v.reason === "residual_canonical" || v.reason === "missing_preferred"),
      ),
    );

    const fixed = assessRequiredTerminologyProtection({
      concepts: [INITIATIVE],
      targetLocale: "zh-Hant",
      sourceText: "Global Human Capital and Democracy Initiative",
      translatedText: "全球人類資本與民主倡議",
    });
    assert.equal(fixed.ok, true);
  });

  it("F. participant_public SOURCE_ORIGINAL — prose edits do not create localization version work", () => {
    const a = buildParticipantPublicCanonicalPresentation({
      profileId: "p1",
      displayName: "Ada",
      biography: "Bio one",
      organization: "Org A",
      skills: ["Rust"],
      skillsVisibility: "public",
    });
    const identityOnly = buildParticipantPublicCanonicalPresentation({
      profileId: "p1",
      displayName: "Ada Lovelace",
      biography: "Bio one",
      organization: "Org B",
      skills: ["Rust"],
      skillsVisibility: "public",
    });
    assert.equal(a.canonicalVersion, identityOnly.canonicalVersion);

    const proseEdit = buildParticipantPublicCanonicalPresentation({
      profileId: "p1",
      displayName: "Ada",
      biography: "Bio two",
      organization: "Org A",
      skills: ["Rust"],
      skillsVisibility: "public",
    });
    // B.2.1 — source-original owner version is not prose-driven.
    assert.equal(a.canonicalVersion, proseEdit.canonicalVersion);
  });

  it("G. private skills excluded; no MACHINE_CONTENT obligation", () => {
    const privateSkills = buildParticipantPublicMachineContentFingerprintInput({
      biography: "Hello",
      skills: ["secret-skill", "private-only"],
      skillsVisibility: "private",
    });
    assert.deepEqual(privateSkills.skills, []);
    assert.equal(privateSkills.biography, "");

    const built = buildParticipantPublicCanonicalPresentation({
      profileId: "p2",
      displayName: "Bob",
      biography: "Hello",
      skills: ["secret-skill"],
      skillsVisibility: "private",
    });
    assert.deepEqual(
      (built.presentation as { skills: string[] }).skills,
      [],
    );

    const adapter = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.ts",
      ),
      "utf8",
    );
    assert.match(adapter, /SOURCE_ORIGINAL/);
    assert.match(adapter, /skillsVisibility/);
    assert.doesNotMatch(adapter, /biography:\s*"MACHINE_CONTENT"/);
  });

  it("H. PLP deterministic / invalid not READY (generic PLP contract intact)", () => {
    // Architecture rule still holds for MACHINE owners; participant_public itself
    // has no machine obligation after B.2.1.
    const rowReason = classifyContentTranslationValidity({
      translation: baseCt({
        translationProvider: "deterministic",
        translatedContent: { title: "[zh-Hant] title" },
      }),
      liveSourceVersion: "v-source",
    });
    assert.equal(rowReason.reconciliationState, "INVALID");
  });

  it("I. Blog sidebar consumes shared hu-persisted blog_post boundary", () => {
    const latest = readFileSync(
      path.resolve(
        here,
        "../../../../../apps/web/src/features/blog/components/BlogLatestMiniCards.tsx",
      ),
      "utf8",
    );
    const authors = readFileSync(
      path.resolve(
        here,
        "../../../../../apps/web/src/features/blog/components/BlogAuthorsSidebar.tsx",
      ),
      "utf8",
    );
    assert.match(latest, /useHuPersistedOrdinaryFields/);
    assert.match(latest, /sourceKind:\s*"blog_post"/);
    assert.match(authors, /useHuPersistedOrdinaryFields/);
    assert.match(authors, /sourceKind:\s*"blog_post"/);
    assert.doesNotMatch(latest, /zh-Hant|arabic|locale ===/);
  });

  it("J. Gate A: zh-hant → Registry canonical zh-Hant", async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    try {
      assert.equal(await resolveCanonicalRegistryLocale("zh-hant"), "zh-Hant");
    } finally {
      setLanguageRegistryForceMemoryForTests(false);
    }
  });

  it("K. Gate B: deterministic CT CURRENT → INVALID", () => {
    const row = baseCt({
      translationProvider: "deterministic",
      translatedContent: { title: "[zh-Hant] title" },
    });
    const validity = classifyContentTranslationValidity({
      translation: row,
      liveSourceVersion: "v-source",
    });
    assert.equal(validity.reconciliationState, "INVALID");
    assert.equal(validity.presentationEligible, false);
  });
});
