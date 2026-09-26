/**
 * STEP 15D.14.B.2.1 — Participant biography/skills SOURCE_ORIGINAL policy.
 * No provider calls. No durable writes. No locale-specific branches.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { PublicMemberProfile, TranslatedContentRecord } from "@hu/types";
import {
  LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY,
  emptyLanguageLocalizationCountBucket,
} from "@hu/types";

import { applyParticipantPublicPlpToProjection } from "../../../src/modules/language/published-localized-presentation/universal/adapters/apply-participant-public-plp.js";
import { enqueueParticipantPublicPlpBuilds } from "../../../src/modules/language/published-localized-presentation/universal/adapters/enqueue-participant-public-plp.js";
import {
  buildParticipantPublicCanonicalPresentation,
  buildParticipantPublicMachineContentFingerprintInput,
  participantPublicHasMachineLocalizationObligation,
  participantPublicPlpDomainAdapter,
  resolveParticipantPublicPresentationSkills,
} from "../../../src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.js";
import { isCollectedPathMachineEligible } from "../../../src/modules/language/published-localized-presentation/universal/field-authority.js";
import { classifyContentTranslationValidity } from "../../../src/modules/language/content-translation-validity.js";
import { assessRequiredTerminologyProtection } from "../../../src/modules/language/terminology-protection-contract.js";
import { resolveCanonicalRegistryLocale } from "../../../src/modules/language/language-registry/index.js";
import {
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/language-registry/index.js";
import { evaluateLanguageLocalizationReadiness } from "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const CANONICAL_BIO = "Я пишу біографію українською — personal prose.";
const CANONICAL_SKILLS = ["civic design", "українська мова"] as const;

function publicProjection(
  overrides: Partial<PublicMemberProfile> = {},
): PublicMemberProfile {
  return {
    profileId: "profile-src-orig",
    publicName: "ada",
    displayName: "Ada",
    biography: CANONICAL_BIO,
    skills: [...CANONICAL_SKILLS],
    organization: "Org",
    messagingAvailability: "hidden",
    ...overrides,
  };
}

describe("15D.14.B.2.1 — Participant SOURCE_ORIGINAL biography/skills", () => {
  it("A. biography remains canonical across uk/ar/zh-Hant/ka presentation", async () => {
    const projection = publicProjection();
    for (const locale of ["uk", "ar", "zh-Hant", "ka"] as const) {
      const overlaid = await applyParticipantPublicPlpToProjection({
        projection,
        locale,
      });
      assert.equal(overlaid.biography, CANONICAL_BIO, locale);
    }
  });

  it("B. public free-text skills remain canonical", async () => {
    const projection = publicProjection();
    for (const locale of ["uk", "ar", "zh-Hant", "ka"] as const) {
      const overlaid = await applyParticipantPublicPlpToProjection({
        projection,
        locale,
      });
      assert.deepEqual(overlaid.skills, [...CANONICAL_SKILLS], locale);
    }
  });

  it("C. private skills remain private / excluded from presentation", () => {
    const skills = resolveParticipantPublicPresentationSkills({
      skills: ["secret", "hidden"],
      skillsVisibility: "private",
    });
    assert.deepEqual(skills, []);

    const built = buildParticipantPublicCanonicalPresentation({
      profileId: "p-private",
      displayName: "Bob",
      biography: "Bio",
      skills: ["secret"],
      skillsVisibility: "private",
    });
    assert.deepEqual((built.presentation as { skills: string[] }).skills, []);
  });

  it("D. biography/skills are not machine-eligible provider inputs", () => {
    assert.equal(participantPublicHasMachineLocalizationObligation(), false);
    const policy = participantPublicPlpDomainAdapter.fieldPolicyFor(
      "participant_public",
    );
    assert.equal(policy.biography, "SOURCE_ORIGINAL");
    assert.equal(policy.skills, "SOURCE_ORIGINAL");
    assert.equal(isCollectedPathMachineEligible("biography", policy), false);
    assert.equal(isCollectedPathMachineEligible("skills", policy), false);
    assert.equal(isCollectedPathMachineEligible("skills[0]", policy), false);

    const machine = buildParticipantPublicMachineContentFingerprintInput({
      biography: CANONICAL_BIO,
      skills: [...CANONICAL_SKILLS],
      skillsVisibility: "public",
    });
    assert.equal(machine.biography, "");
    assert.deepEqual(machine.skills, []);
  });

  it("E. missing translated biography/skills do not create localization work", async () => {
    assert.equal(
      LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.plpOwned.includes(
        "participant_public",
      ),
      false,
    );
    assert.ok(
      LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.sourceOriginal.includes(
        "participant_public",
      ),
    );

    const report = await evaluateLanguageLocalizationReadiness({
      locale: "uk",
      skipCorpusPlan: true,
      ctCounts: emptyLanguageLocalizationCountBucket(),
      plpCounts: emptyLanguageLocalizationCountBucket(),
      plpParticipantCounts: {
        ...emptyLanguageLocalizationCountBucket(),
        missing: 99,
        workItemsRequired: 99,
      },
      assessWebUi: async () => ({
        engineReady: true as const,
        dataReady: true,
        requiredKeyCount: 1,
        missingKeyCount: 0,
        emptyKeyCount: 0,
        englishFallbackKeyCount: 0,
        sampleMissingPaths: [],
      }),
      assessControlledVocabulary: async () => ({
        presentationReady: true,
        conceptsChecked: 0,
        conceptsWithTerminologyPreferredTerm: 0,
        conceptsWithWebUiFallbackOnly: 0,
        conceptsMissingLocalizedLabel: 0,
        missingLocalizedLabelConceptIds: [],
        missingPreferredTermGaps: [],
      }),
      assessHigherAuthority: async () => ({
        brandPublished: true,
        legalPublished: true,
        note: null,
      }),
      registryRecord: {
        languageId: "lang-uk",
        locale: "uk",
        languageCode: "uk",
        englishName: "Ukrainian",
        nativeName: "Українська",
        textDirection: "ltr",
        fallbackLocale: "en",
        enabled: true,
        uiTranslationStatus: "complete",
        contentTranslationEnabled: true,
        searchEnabled: true,
        seoIndexingEnabled: true,
        pwaPersistedReadingEnabled: true,
        aliases: [],
        providerMappings: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    assert.equal(report.plpParticipant?.missing ?? 0, 0);
    assert.equal(report.plpParticipant?.workItemsRequired ?? 0, 0);
    assert.ok(
      !report.gaps.some((gap) =>
        /participant_public (MISSING|STALE|INVALID|work)/i.test(gap),
      ),
    );
    const row = report.kindRows.find((r) => r.kindId === "participant_public");
    assert.ok(row);
    assert.match(row!.note ?? "", /SOURCE_ORIGINAL/);
    assert.equal(row!.counts, null);
  });

  it("F. historical PLP overlay cannot override canonical biography/skills", async () => {
    const projection = publicProjection({
      biography: CANONICAL_BIO,
      skills: [...CANONICAL_SKILLS],
    });
    // Even if a historical translated snapshot existed, apply is identity.
    const overlaid = await applyParticipantPublicPlpToProjection({
      projection,
      locale: "zh-Hant",
    });
    assert.equal(overlaid.biography, CANONICAL_BIO);
    assert.deepEqual(overlaid.skills, [...CANONICAL_SKILLS]);
    assert.notEqual(overlaid.biography, "歷史翻譯生物");
  });

  it("G. Workspace editing remains canonical (enqueue is no-op; no provider)", async () => {
    const enqueueSrc = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/published-localized-presentation/universal/adapters/enqueue-participant-public-plp.ts",
      ),
      "utf8",
    );
    assert.match(enqueueSrc, /no-op|SOURCE_ORIGINAL|retired/i);
    assert.doesNotMatch(enqueueSrc, /enqueuePlpBuildRequest/);

    await enqueueParticipantPublicPlpBuilds({
      profileId: "p1",
      userId: "u1",
      displayName: "Ada",
      biography: CANONICAL_BIO,
      skills: [...CANONICAL_SKILLS],
      skillsVisibility: "public",
      profileVisibility: "public",
    } as never);

    const service = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/member-profile/member-profile.service.ts",
      ),
      "utf8",
    );
    assert.match(service, /updateMemberProfileForUser/);
    assert.match(service, /validateMemberProfilePatch/);
  });

  it("H. Gate A: zh-hant → Registry canonical zh-Hant", async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    try {
      assert.equal(await resolveCanonicalRegistryLocale("zh-hant"), "zh-Hant");
    } finally {
      setLanguageRegistryForceMemoryForTests(false);
    }
  });

  it("I. Gate B: deterministic CT → INVALID", () => {
    const row: TranslatedContentRecord = {
      translationId: "t1",
      sourceKind: "initiative",
      sourceRecordId: "i1",
      sourceVersion: "v1",
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatedContent: { title: "[uk] title" },
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: "2026-09-01T00:00:00.000Z",
      stale: false,
      freshness: "current",
    };
    const validity = classifyContentTranslationValidity({
      translation: row,
      liveSourceVersion: "v1",
    });
    assert.equal(validity.reconciliationState, "INVALID");
  });

  it("J. B.2 terminology contracts for genuinely localized owners remain intact", () => {
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

    const ok = assessRequiredTerminologyProtection({
      concepts: [
        {
          conceptId: "humanity_union",
          canonicalEnglishTerm: "Humanity Union",
          category: "brand",
          status: "published",
          translations: {
            "zh-Hant": { preferredTerm: "人道聯盟協會", aliases: [] },
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      targetLocale: "zh-Hant",
      sourceText: "Join Humanity Union",
      translatedText: "加入人道聯盟協會",
    });
    assert.equal(ok.ok, true);

    // No locale-specific branches in participant adapter / apply.
    const adapter = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.ts",
      ),
      "utf8",
    );
    const apply = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/published-localized-presentation/universal/adapters/apply-participant-public-plp.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(adapter, /zh-Hant|locale === ["']uk["']/);
    assert.doesNotMatch(apply, /zh-Hant|locale === ["']uk["']/);
  });
});
