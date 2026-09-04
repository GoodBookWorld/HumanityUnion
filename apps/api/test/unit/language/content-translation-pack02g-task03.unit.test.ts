/**
 * Production Completion Pack 02G Task 03 — civic/public translation source expansion.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";

import type { Initiative } from "@hu/types";

import {
  CONTENT_TRANSLATION_FIELD_ALLOWLIST,
  CONTENT_TRANSLATION_PRIVACY_EXCLUSIONS,
  PUBLIC_CONTENT_TRANSLATION_SOURCE_KINDS,
  assertCanonicalSourceEligibleForTranslation,
  assertPublicFieldsAllowlisted,
  buildContentTranslationSourceVersion,
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  isPrivacyExcludedTranslationSurface,
  isPublicContentTranslationSourceKind,
  isSupportedContentTranslationSourceKind,
  joinTranslationLines,
  loadCivicMediaTranslationSource,
  loadOfficialResponseTranslationSource,
  loadTranslatableSource,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  stableJsonForTranslation,
  DeterministicTranslationProvider,
  TranslationProviderError,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

const TASK03_KINDS = [
  "improvement_proposal",
  "initiative_revision",
  "decision_session",
  "collective_decision",
  "implementation_commitment",
  "implementation_tracking",
  "official_response",
  "public_impact",
  "civic_archive",
  "civic_media",
] as const;

function sampleInitiative(): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack02g-t03-${Date.now()}`,
    stewardId: "member-pack02g-t03",
    createdAt: now,
    updatedAt: now,
    title: "Clean River Initiative",
    description: "Participants will restore a local river.",
    status: "proposal",
    lifecyclePhase: "published",
    visibility: { policy: "public" },
    metadata: {
      category: "Community",
      tags: [],
      region: "Test",
      language: "en",
      communitySlug: "test",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

describe("Production Completion Pack 02G Task 03 — civic source expansion", () => {
  let initiative: Initiative;

  beforeEach(async () => {
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    setTranslationProviderForTests(new DeterministicTranslationProvider());
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", { enabled: true });
    await createLanguageRegistryRecord({
      locale: "g2-t03-fr",
      englishName: "French T03",
      nativeName: "Français T03",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
    });
    initiative = sampleInitiative();
    createInitiative(initiative);
  });

  afterEach(() => {
    deleteInitiative(initiative.initiativeId);
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("adds explicit Task 03 sourceKinds with public allowlists; lifecycle_stage stays non-generic", () => {
    for (const kind of TASK03_KINDS) {
      assert.equal(isSupportedContentTranslationSourceKind(kind), true);
      assert.equal(isPublicContentTranslationSourceKind(kind), true);
      assert.ok((CONTENT_TRANSLATION_FIELD_ALLOWLIST[kind] as readonly string[]).length > 0);
    }
    assert.deepEqual([...CONTENT_TRANSLATION_FIELD_ALLOWLIST.lifecycle_stage], []);
    assert.equal(isPrivacyExcludedTranslationSurface("discussion_comment"), false);
    assert.equal(isSupportedContentTranslationSourceKind("discussion_comment"), true);
    assert.ok((PUBLIC_CONTENT_TRANSLATION_SOURCE_KINDS as readonly string[]).includes("discussion_comment"));
    assert.ok(!(PUBLIC_CONTENT_TRANSLATION_SOURCE_KINDS as readonly string[]).includes("lifecycle_stage"));
  });

  it("official_response allowlist excludes private transport/metadata fields", () => {
    const allow = CONTENT_TRANSLATION_FIELD_ALLOWLIST.official_response as readonly string[];
    assert.deepEqual([...allow].sort(), [
      "organizationName",
      "responseReference",
      "subject",
      "summary",
    ]);
    for (const banned of [
      "rawSource",
      "messageHeaders",
      "providerMetadata",
      "recordedByParticipantId",
      "verifiedByParticipantId",
    ]) {
      assert.ok(!allow.includes(banned));
      assert.throws(
        () =>
          assertPublicFieldsAllowlisted({
            sourceKind: "official_response",
            fields: { subject: "s", summary: "s", responseReference: "r", organizationName: "o", [banned]: "x" },
          }),
        TranslationProviderError,
      );
    }
    assert.equal(isPrivacyExcludedTranslationSurface("official_response_raw_source"), true);
  });

  it("civic_archive allowlist excludes verification metadata", () => {
    const allow = CONTENT_TRANSLATION_FIELD_ALLOWLIST.civic_archive as readonly string[];
    assert.ok(allow.includes("title"));
    assert.ok(allow.includes("implementationStory"));
    assert.ok(!allow.includes("verification"));
    assert.ok(!allow.some((field) => field.includes("hash") || field.includes("signature")));
    assert.equal(isPrivacyExcludedTranslationSurface("civic_archive_verification_metadata"), true);
    assert.throws(
      () =>
        assertPublicFieldsAllowlisted({
          sourceKind: "civic_archive",
          fields: {
            title: "t",
            summary: "s",
            implementationPeriod: "p",
            initiativeSummary: "i",
            civicChallenge: "c",
            implementationStory: "story",
            verifiedPublicImpact: "v",
            lessonsLearned_whatWorked: "a",
            lessonsLearned_whatDidNotWork: "b",
            lessonsLearned_recommendationsForFuture: "c",
            lessonsLearned_transferableExperience: "d",
            knowledgeContribution_socialBenefits: "e",
            knowledgeContribution_environmentalBenefits: "f",
            knowledgeContribution_economicBenefits: "g",
            knowledgeContribution_governanceBenefits: "h",
            knowledgeContribution_educationalBenefits: "i",
            knowledgeContribution_additionalObservations: "j",
            timelineLabels: "k",
            verification: "secret",
          },
        }),
      TranslationProviderError,
    );
  });

  it("civic_media loads editorial + trusted explanations; excludes resource URLs/names", async () => {
    const missing = await loadCivicMediaTranslationSource("not-the-center");
    assert.equal(missing, null);

    const loaded = await loadCivicMediaTranslationSource("civic-media-center");
    assert.ok(loaded);
    assert.equal(loaded.sourceKind, "civic_media");
    assert.equal(loaded.isPublished, true);
    assert.equal(loaded.sourceLanguage, "en");
    assert.deepEqual(
      Object.keys(loaded.fields).sort(),
      [...CONTENT_TRANSLATION_FIELD_ALLOWLIST.civic_media].sort(),
    );
    assert.ok("trustedMediaExplanations" in loaded.fields);
    assert.ok(!JSON.stringify(loaded.fields).includes("websiteUrl"));
    assert.ok(!JSON.stringify(loaded.fields).includes("diagramSvg"));
    assert.ok(!("trustedMedia" in loaded.fields));
    assert.ok(CONTENT_TRANSLATION_FIELD_ALLOWLIST.civic_media.includes("trustedMediaExplanations"));

    const again = await loadCivicMediaTranslationSource("civic-media-center");
    assert.equal(again?.sourceVersion, loaded.sourceVersion);

    const mutated = {
      ...loaded.fields,
      overviewTitle: `${loaded.fields.overviewTitle} changed`,
    };
    assert.notEqual(
      buildContentTranslationSourceVersion({
        fields: mutated,
        versionStamp: "2026-06-27T00:00:00.000Z",
      }),
      loaded.sourceVersion,
    );

    assertCanonicalSourceEligibleForTranslation({
      intent: "automatic_warm",
      source: {
        ...loaded,
        safetyCleared: true,
      },
    });
  });

  it("unpublished/missing civic records reject via null loader; official_response missing is null", async () => {
    assert.equal(await loadOfficialResponseTranslationSource("missing-response"), null);
    assert.equal(
      await loadTranslatableSource({
        sourceKind: "improvement_proposal",
        sourceRecordId: "missing-proposal",
      }),
      null,
    );
    assert.equal(
      await loadTranslatableSource({
        sourceKind: "collective_decision",
        sourceRecordId: "missing-decision",
      }),
      null,
    );
  });

  it("structured serialization is deterministic; private metadata ignored in field maps", () => {
    assert.equal(joinTranslationLines([" a ", "", "b"]), "a\nb");
    const a = stableJsonForTranslation({ z: 1, a: ["x", "y"] });
    const b = stableJsonForTranslation({ a: ["x", "y"], z: 1 });
    assert.equal(a, b);
  });

  it("Initiative / Collaborative Analysis / Petition allowlists unchanged; blog still loader-only kind", async () => {
    assert.deepEqual([...CONTENT_TRANSLATION_FIELD_ALLOWLIST.initiative], ["title", "description"]);
    assert.equal(CONTENT_TRANSLATION_FIELD_ALLOWLIST.collaborative_analysis.length, 7);
    assert.equal(CONTENT_TRANSLATION_FIELD_ALLOWLIST.petition.length, 6);
    assert.deepEqual([...CONTENT_TRANSLATION_FIELD_ALLOWLIST.blog_post], [
      "title",
      "excerpt",
      "content",
    ]);

    const loaded = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(loaded);
    const generated = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
    });
    assert.equal(generated.generated, true);
    assert.equal(initiative.title, "Clean River Initiative");
  });

  it("unpublished public-kind eligibility rejects generation; target==source skips", () => {
    assert.throws(
      () =>
        assertCanonicalSourceEligibleForTranslation({
          intent: "on_demand",
          source: {
            sourceKind: "improvement_proposal",
            sourceRecordId: "p1",
            sourceLanguage: "en",
            fields: {
              targetSection: "t",
              currentIssue: "i",
              proposedChange: "c",
              rationale: "r",
              expectedImprovement: "e",
              references: "ref",
              decisionNote: "",
            },
            sourceVersion: "v-1",
            isPublished: false,
            safetyCleared: true,
          },
        }),
      /published/i,
    );

    assert.throws(
      () =>
        assertCanonicalSourceEligibleForTranslation({
          intent: "automatic_warm",
          source: {
            sourceKind: "civic_media",
            sourceRecordId: "civic-media-center",
            sourceLanguage: "en",
            fields: {
              overviewTitle: "t",
              overviewSummary: "s",
              overviewPoints: "[]",
              selectionPrinciples: "[]",
              faq: "[]",
              initiativeFlowTitle: "f",
              initiativeFlowSummary: "fs",
              initiativeFlowStages: "a",
            },
            sourceVersion: "v-1",
            isPublished: false,
            safetyCleared: true,
          },
        }),
      /published/i,
    );
  });

  it("routes register new sourceKinds; no outbox/warming/Web wiring in Task 03", () => {
    const routes = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/language.routes.ts"),
      "utf8",
    );
    for (const kind of TASK03_KINDS) {
      assert.match(routes, new RegExp(`"${kind}"`));
    }
    const civicLoaders = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/content-translation-civic-loaders.ts"),
      "utf8",
    );
    assert.doesNotMatch(civicLoaders, /enqueueDomainEvent|enqueueOutbox|ContentTranslationWarmRequested/);
    assert.match(civicLoaders, /getPublicOfficialResponse/);
    assert.match(civicLoaders, /getPublicCivicArchive/);
    // Official Response loader field object must not assign private transport fields.
    const officialFn = civicLoaders.slice(
      civicLoaders.indexOf("loadOfficialResponseTranslationSource"),
      civicLoaders.indexOf("loadPublicImpactTranslationSource"),
    );
    assert.match(officialFn, /subject: projection\.subject/);
    assert.doesNotMatch(officialFn, /projection\.rawSource|projection\.messageHeaders|projection\.providerMetadata/);
    assert.doesNotMatch(civicLoaders, /diagramSvg|websiteUrl/);
  });
});
