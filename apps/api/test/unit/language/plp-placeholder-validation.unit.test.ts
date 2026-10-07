/**
 * Civic Media PLP deterministic placeholders are not localized presentations.
 * `[locale] ` plus the canonical source is invalid for every locale.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  emptyLanguageLocalizationCountBucket,
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpPrincipleEntityId,
  plpBuildWorkKey,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
  type LanguageLocalizationCountBucket,
  type PublicPresentationNode,
} from "@hu/types";

import { TRUSTED_MEDIA_RESOURCES } from "../../../src/modules/civic-media-center/content/trusted-media.js";
import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
  CIVIC_MEDIA_SELECTION_PRINCIPLES,
} from "../../../src/modules/civic-media-center/content/sections.js";
import {
  isDeterministicPlaceholderForCanonicalSource,
  omitDeterministicPlaceholderValues,
} from "../../../src/modules/language/content-translation-validity.js";
import { assessMediaCarouselPlpPresenceForLocale } from "../../../src/modules/language/assess-media-carousel-plp-presence.js";
import { planLanguageHistoricalBackfill } from "../../../src/modules/language/language-localization-activation/language-historical-backfill-planner.js";
import {
  ensureLanguageRegistrySeeded,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/language-registry/language-registry.repository.js";
import {
  evaluateLocalizationContentIntegrity,
  LOCALIZATION_CONTENT_INTEGRITY_VERSION,
} from "../../../src/modules/language/published-localized-presentation/content-integrity.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  buildCanonicalPrinciplePresentation,
  buildCanonicalTrustedPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js";
import { loadMediaPlpLiveCanonicalSource } from "../../../src/modules/language/published-localized-presentation/media/live-source.js";
import { publishAtomicMemory } from "../../../src/modules/language/published-localized-presentation/persistence/memory.store.js";
import {
  findCurrentPublishedPresentation,
  resetPublishedLocalizationPersistenceForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/persistence/repository.js";
import { collectAutoPaths } from "../../../src/modules/language/published-localized-presentation/presentation-paths.js";
import { resetMediaPlpResolveCacheForTests } from "../../../src/modules/language/published-localized-presentation/resolve-cache.js";
import { resolvePublishedPresentation } from "../../../src/modules/language/published-localized-presentation/resolve-published-presentation.js";
import { mergeLocalizedLayersByProvenance } from "../../../src/modules/language/published-localized-presentation/validate-build-result.js";
import {
  evaluateLocalizationStructuralIntegrity,
} from "../../../src/modules/language/published-localized-presentation/structural-integrity.js";
import { classifyUsableLocalizedPresentation } from "../../../src/modules/language/published-localized-presentation/usability.js";
import { isCollectedPathLocalizationRequired } from "../../../src/modules/language/published-localized-presentation/universal/field-authority.js";
import { resolveFieldPolicyForEntityType } from "../../../src/modules/language/published-localized-presentation/universal/resolve-field-policy.js";
import { enqueuePlpBuildRequest } from "../../../src/modules/language/published-localized-presentation/universal/build-request-queue.js";
import { resetPlpBuildRequestQueueForTests } from "../../../src/modules/language/published-localized-presentation/universal/build-request-queue.js";
import { processPlpBuildRequest } from "../../../src/modules/language/published-localized-presentation/universal/process-plp-build-request.js";
import {
  listPlpAutoBuildWorkForTests,
  putPlpAutoBuildWorkForTests,
  resetPlpAutoBuildWorkStoreForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  type PlpAutoBuildWorkRecord,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";
import { setMediaResourceForceMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.repository.js";

const CANONICAL_EXPLANATION = "Independent international news agency";
const REAL_UKRAINIAN = "Незалежне міжнародне інформаційне агентство";
const PRINCIPLE_ID = mediaPlpPrincipleEntityId(
  CIVIC_MEDIA_SELECTION_PRINCIPLES[0]!.id,
);

const trustedPolicy = resolveFieldPolicyForEntityType(
  MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
);
const principlePolicy = resolveFieldPolicyForEntityType(
  MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
);
const editorialPolicy = resolveFieldPolicyForEntityType(
  MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
);

const trustedCanonical = asMediaPlpPresentationNode(
  buildCanonicalTrustedPresentation({
    ...TRUSTED_MEDIA_RESOURCES[0]!,
    explanation: CANONICAL_EXPLANATION,
  }),
);
const trustedVersion = fingerprintMediaPlpCanonicalVersion(trustedCanonical);

function valuesFor(
  canonical: PublicPresentationNode,
  policy: ReturnType<typeof resolveFieldPolicyForEntityType>,
  localize: (path: string, value: string) => string,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const node of collectAutoPaths(canonical)) {
    if (!isCollectedPathLocalizationRequired(node.path, policy)) {
      continue;
    }
    values[node.path] = localize(node.path, node.value);
  }
  return values;
}

function presentationFrom(
  canonical: PublicPresentationNode,
  values: Record<string, string>,
): PublicPresentationNode {
  return mergeLocalizedLayersByProvenance({
    canonicalPresentation: canonical,
    layers: [{ source: "MACHINE", values }],
  }).presentation;
}

function passedIntegrity(input: {
  readonly locale: string;
  readonly canonical: PublicPresentationNode;
  readonly localized: PublicPresentationNode;
  readonly policy: ReturnType<typeof resolveFieldPolicyForEntityType>;
  readonly lieContentPassed?: boolean;
}) {
  const content = evaluateLocalizationContentIntegrity({
    locale: input.locale,
    canonicalPresentation: input.canonical,
    localizedPresentation: input.localized,
    fieldPolicy: input.policy,
    evaluatedAt: "2026-10-07T00:00:00.000Z",
  });
  const structural = evaluateLocalizationStructuralIntegrity({
    locale: input.locale,
    canonicalPresentation: input.canonical,
    localizedPresentation: input.localized,
    fieldPolicy: input.policy,
    evaluatedAt: "2026-10-07T00:00:00.000Z",
  });
  return {
    content: input.lieContentPassed
      ? {
          ...content,
          version: LOCALIZATION_CONTENT_INTEGRITY_VERSION,
          status: "PASSED" as const,
          reasonCodes: [],
        }
      : content,
    structural,
  };
}

function snapshotFor(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonical: PublicPresentationNode;
  readonly version: string;
  readonly localized: PublicPresentationNode;
  readonly policy: ReturnType<typeof resolveFieldPolicyForEntityType>;
  readonly lieContentPassed?: boolean;
  readonly contentRevision?: number;
}) {
  const integrity = passedIntegrity(input);
  return {
    snapshotId: `${input.entityType}:${input.entityId}:${input.locale}`,
    identity: {
      entityType: input.entityType,
      entityId: input.entityId,
      locale: input.locale,
      canonicalVersion: input.version,
      localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    },
    state: "PUBLISHED" as const,
    contentRevision: input.contentRevision ?? 1,
    presentation: input.localized,
    provenance: [],
    contentIntegrity: integrity.content,
    structuralIntegrity: integrity.structural,
    createdAt: "2026-10-07T00:00:00.000Z",
    updatedAt: "2026-10-07T00:00:00.000Z",
  };
}

function classifyTrusted(locale: string, explanation: string) {
  const localized = presentationFrom(
    trustedCanonical,
    valuesFor(trustedCanonical, trustedPolicy, () => explanation),
  );
  const snapshot = snapshotFor({
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
    entityId: "reuters",
    locale,
    canonical: trustedCanonical,
    version: trustedVersion,
    localized,
    policy: trustedPolicy,
    lieContentPassed: true,
  });
  return {
    localized,
    content: evaluateLocalizationContentIntegrity({
      locale,
      canonicalPresentation: trustedCanonical,
      localizedPresentation: localized,
      fieldPolicy: trustedPolicy,
    }),
    usability: classifyUsableLocalizedPresentation({
      locale,
      liveCanonicalVersion: trustedVersion,
      canonicalPresentation: trustedCanonical,
      snapshot,
    }),
  };
}

beforeEach(async () => {
  resetPlpBuildRequestQueueForTests();
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(true);
  setMediaResourceForceMemoryForTests(true);
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpResolveCacheForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  setLanguageRegistryForceMemoryForTests(true);
  await ensureLanguageRegistrySeeded();
  await updateLanguageRegistryRecord("lang-uk", {
    enabled: true,
    contentTranslationEnabled: true,
  });
});

afterEach(() => {
  resetPlpBuildRequestQueueForTests();
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  setMediaResourceForceMemoryForTests(false);
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpResolveCacheForTests();
  setLanguageRegistryForceMemoryForTests(false);
});

describe("PLP deterministic placeholder validation", () => {
  it("A. a real translation stays current and usable", () => {
    const result = classifyTrusted("uk", REAL_UKRAINIAN);
    assert.equal(result.content.status, "PASSED");
    assert.equal(result.usability.allowPublishedLocalized, true);
    assert.equal(result.usability.rebuildRequired, false);
    assert.equal(
      isDeterministicPlaceholderForCanonicalSource({
        locale: "uk",
        localized: "Незалежне [uk] агентство",
        canonical: CANONICAL_EXPLANATION,
      }),
      false,
    );
  });

  it("B/C/D. exact locale prefixes of the canonical source are invalid", () => {
    for (const [locale, localized] of [
      ["uk", "[uk] Independent international news agency"],
      ["zh-Hant", "[zh-hant] Independent international news agency"],
      ["ar", "[ar] Independent international news agency"],
    ] as const) {
      const result = classifyTrusted(locale, localized);
      assert.equal(result.content.status, "FAILED", locale);
      assert.ok(
        result.content.reasonCodes.includes("DETERMINISTIC_PLACEHOLDER"),
        locale,
      );
      assert.equal(result.content.LOCALIZED_VALUE_NODE_COUNT, 0, locale);
      assert.equal(result.usability.allowPublishedLocalized, false, locale);
      assert.equal(result.usability.rebuildRequired, true, locale);
    }
  });

  it("E. protected names and URLs stay source-original beside a real translation", () => {
    const result = classifyTrusted("uk", REAL_UKRAINIAN);
    assert.equal(result.content.status, "PASSED");
    const name = (result.localized as { name?: { value?: string } }).name;
    const website = (result.localized as { websiteUrl?: { value?: string } }).websiteUrl;
    assert.equal(name && "value" in name ? name.value : name, "Reuters");
    assert.equal(
      website && "value" in website ? website.value : website,
      "https://www.reuters.com/",
    );
  });

  it("F. public resolve does not return a placeholder as PUBLISHED_LOCALIZED", async () => {
    const localized = presentationFrom(
      trustedCanonical,
      valuesFor(
        trustedCanonical,
        trustedPolicy,
        () => "[uk] Independent international news agency",
      ),
    );
    const snapshot = snapshotFor({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: "reuters",
      locale: "uk",
      canonical: trustedCanonical,
      version: trustedVersion,
      localized,
      policy: trustedPolicy,
      lieContentPassed: true,
    });
    publishAtomicMemory({ candidate: snapshot });
    const resolved = await resolvePublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: "reuters",
      locale: "uk",
      liveCanonicalVersion: trustedVersion,
      canonicalPresentation: trustedCanonical,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
  });

  it("G/H/K. the worker regenerates a placeholder and does not reuse the bag", async () => {
    const principle = CIVIC_MEDIA_SELECTION_PRINCIPLES[0]!;
    const canonical = asMediaPlpPresentationNode(
      buildCanonicalPrinciplePresentation(principle),
    );
    const version = fingerprintMediaPlpCanonicalVersion(canonical);
    const placeholderValues = valuesFor(canonical, principlePolicy, (_path, value) => {
      return `[uk] ${value}`;
    });
    const localized = presentationFrom(canonical, placeholderValues);
    publishAtomicMemory({
      candidate: snapshotFor({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: PRINCIPLE_ID,
        locale: "uk",
        canonical,
        version,
        localized,
        policy: principlePolicy,
        lieContentPassed: true,
      }),
    });

    let providerCalls = 0;
    const realValues = valuesFor(canonical, principlePolicy, (_path, value) => {
      return `Локал ${value}`;
    });
    const first = await processPlpBuildRequest(
      {
        workKey: "placeholder-principle",
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: PRINCIPLE_ID,
        locale: "uk",
        canonicalVersion: version,
        contentRevision: 1,
        trigger: "ADMIN_REBUILD",
        enqueuedAt: "2026-10-07T00:00:00.000Z",
        status: "RUNNING",
      },
      {
        importProvider: async () => ({
          provider: {} as never,
          PROVIDER_TRANSPORT: "test",
        }),
        lookupTranslation: async () => ({
          EXISTING_TRANSLATION_COMPLETE: true,
          values: placeholderValues,
        }),
        callProvider: async () => {
          providerCalls += 1;
          return { ok: true, values: realValues };
        },
        verifyDurability: async () => ({ ok: true }),
      },
    );
    assert.notEqual(first.status, "SKIPPED_USABLE");
    assert.equal(first.status, "COMPLETED");
    assert.equal(providerCalls, 1);

    const current = await findCurrentPublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
      entityId: PRINCIPLE_ID,
      locale: "uk",
    });
    const usable = classifyUsableLocalizedPresentation({
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: canonical,
      snapshot: current,
    });
    assert.equal(usable.allowPublishedLocalized, true);

    const second = await processPlpBuildRequest(
      {
        workKey: "placeholder-principle",
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: PRINCIPLE_ID,
        locale: "uk",
        canonicalVersion: version,
        contentRevision: 1,
        trigger: "ADMIN_REBUILD",
        enqueuedAt: "2026-10-07T00:00:00.000Z",
        status: "RUNNING",
      },
      {
        importProvider: async () => {
          throw new Error("provider must not load for a current snapshot");
        },
        callProvider: async () => {
          providerCalls += 1;
          return { ok: true, values: realValues };
        },
      },
    );
    assert.equal(second.status, "SKIPPED_USABLE");
    assert.equal(providerCalls, 1);
    assert.deepEqual(
      omitDeterministicPlaceholderValues({
        locale: "uk",
        values: placeholderValues,
        canonicalValues: valuesFor(canonical, principlePolicy, (_path, value) => value),
      }),
      {},
    );
  });

  it("I/K. one placeholder among 53 presentations is invalid work, then current", async () => {
    const editorial = asMediaPlpPresentationNode(
      buildCanonicalEditorialPresentation({
        overview: CIVIC_MEDIA_OVERVIEW,
        faq: [...CIVIC_MEDIA_FAQ],
      }),
    );
    const editorialVersion = fingerprintMediaPlpCanonicalVersion(editorial);
    const editorialReal = presentationFrom(
      editorial,
      valuesFor(editorial, editorialPolicy, (_path, value) => `Локал ${value}`),
    );
    const editorialUsable = classifyUsableLocalizedPresentation({
      locale: "uk",
      liveCanonicalVersion: editorialVersion,
      canonicalPresentation: editorial,
      snapshot: snapshotFor({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
        locale: "uk",
        canonical: editorial,
        version: editorialVersion,
        localized: editorialReal,
        policy: editorialPolicy,
      }),
    });
    assert.equal(editorialUsable.allowPublishedLocalized, true);

    const presence = await assessMediaCarouselPlpPresenceForLocale({
      locale: "uk",
      pageSize: 200,
      loadCanonical: loadMediaPlpLiveCanonicalSource,
      findPlp: async ({ entityType, entityId, locale }) => {
        const source = await loadMediaPlpLiveCanonicalSource({
          entityType: entityType as never,
          entityId,
        });
        if (
          !source.CANONICAL_USABLE ||
          source.canonicalPresentation == null ||
          !source.CANONICAL_VERSION
        ) {
          return null;
        }
        const policy = resolveFieldPolicyForEntityType(entityType);
        const placeholder = entityId === PRINCIPLE_ID;
        const localized = presentationFrom(
          source.canonicalPresentation,
          valuesFor(source.canonicalPresentation, policy, (_path, value) =>
            placeholder ? `[uk] ${value}` : `Локал ${value}`,
          ),
        );
        return snapshotFor({
          entityType,
          entityId,
          locale,
          canonical: source.canonicalPresentation,
          version: source.CANONICAL_VERSION,
          localized,
          policy,
          lieContentPassed: true,
        });
      },
    });
    const checked = presence.byKind.reduce((sum, row) => sum + row.checked, 0);
    assert.equal(checked, 52);
    assert.equal(presence.byKind.some((row) => row.kindId === "public_news"), false);
    const editorialCurrent = editorialUsable.allowPublishedLocalized ? 1 : 0;
    assert.equal(presence.total.current + editorialCurrent, 52);
    assert.equal(presence.total.invalid + 0, 1);
    assert.equal(presence.total.workItemsRequired, 1);

    const repaired = await assessMediaCarouselPlpPresenceForLocale({
      locale: "uk",
      pageSize: 200,
      findPlp: async ({ entityType, entityId, locale }) => {
        const source = await loadMediaPlpLiveCanonicalSource({
          entityType: entityType as never,
          entityId,
        });
        if (
          !source.canonicalPresentation ||
          !source.CANONICAL_VERSION ||
          !source.CANONICAL_USABLE
        ) {
          return null;
        }
        const policy = resolveFieldPolicyForEntityType(entityType);
        const localized = presentationFrom(
          source.canonicalPresentation,
          valuesFor(source.canonicalPresentation, policy, (_path, value) => `Локал ${value}`),
        );
        return snapshotFor({
          entityType,
          entityId,
          locale,
          canonical: source.canonicalPresentation,
          version: source.CANONICAL_VERSION,
          localized,
          policy,
        });
      },
    });
    assert.equal(repaired.total.invalid, 0);
    assert.equal(repaired.total.workItemsRequired, 0);
    assert.equal(repaired.total.current + editorialCurrent, 53);
  });

  it("J/L. invalid PLP is enqueued by reconciliation and a current snapshot is not", async () => {
    const invalidPlan = await planLanguageHistoricalBackfill({
      locale: "uk",
      registryEligible: true,
      deps: {
        auditCorpus: async () => ({ byLocale: [] }) as never,
        classifyMediaEditorial: async () => "INVALID",
        assessCarouselPlp: async () => ({
          total: {
            ...emptyLanguageLocalizationCountBucket(),
            invalid: 1,
            workItemsRequired: 1,
          },
          byKind: [
            {
              kindId: "civic_media_principle",
              checked: 1,
              counts: {
                ...emptyLanguageLocalizationCountBucket(),
                invalid: 1,
                workItemsRequired: 1,
              } satisfies LanguageLocalizationCountBucket,
            },
          ],
        }),
      },
    });
    assert.ok(invalidPlan.summary.plpWorkItems > 0);
    assert.equal(
      invalidPlan.items.find((item) => item.kindId === "civic_media_editorial")?.action,
      "enqueue_plp_editorial",
    );
    assert.equal(
      invalidPlan.items.find((item) => item.kindId === "civic_media_principle")?.action,
      "enqueue_plp_carousel",
    );

    const principle = CIVIC_MEDIA_SELECTION_PRINCIPLES[0]!;
    const canonical = asMediaPlpPresentationNode(
      buildCanonicalPrinciplePresentation(principle),
    );
    const version = fingerprintMediaPlpCanonicalVersion(canonical);
    const placeholder = presentationFrom(
      canonical,
      valuesFor(canonical, principlePolicy, (_path, value) => `[uk] ${value}`),
    );
    publishAtomicMemory({
      candidate: snapshotFor({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: PRINCIPLE_ID,
        locale: "uk",
        canonical,
        version,
        localized: placeholder,
        policy: principlePolicy,
        lieContentPassed: true,
      }),
    });
    const now = "2026-10-07T00:00:00.000Z";
    const completed: PlpAutoBuildWorkRecord = {
      workKey: plpBuildWorkKey({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: PRINCIPLE_ID,
        locale: "uk",
      }),
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
      entityId: PRINCIPLE_ID,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      status: "completed",
      attempts: 1,
      maxAttempts: 5,
      lastError: null,
      failureCode: null,
      failureStage: null,
      retryable: null,
      enqueuedAt: now,
      claimedAt: null,
      completedAt: now,
      updatedAt: now,
      lastFailureAt: null,
      nextAttemptAt: null,
      recoveryGeneration: null,
      batchCheckpoint: null,
    };
    putPlpAutoBuildWorkForTests(completed);
    const enqueued = await enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
      entityId: PRINCIPLE_ID,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      canonicalPresentation: canonical,
      reopenFailedSameVersion: true,
    });
    assert.equal(enqueued.skippedUsable, false);
    assert.equal(enqueued.accepted, true);
    assert.equal(
      listPlpAutoBuildWorkForTests().find((row) => row.entityId === PRINCIPLE_ID)?.status,
      "pending",
    );

    const real = presentationFrom(
      canonical,
      valuesFor(canonical, principlePolicy, (_path, value) => `Локал ${value}`),
    );
    publishAtomicMemory({
      candidate: snapshotFor({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: PRINCIPLE_ID,
        locale: "uk",
        canonical,
        version,
        localized: real,
        policy: principlePolicy,
        contentRevision: 2,
      }),
    });
    const row = listPlpAutoBuildWorkForTests().find((item) => item.entityId === PRINCIPLE_ID);
    assert.ok(row);
    putPlpAutoBuildWorkForTests({
      ...row,
      status: "completed",
      attempts: 1,
      completedAt: now,
    });
    const again = await enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
      entityId: PRINCIPLE_ID,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      canonicalPresentation: canonical,
      reopenFailedSameVersion: true,
    });
    const third = await enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
      entityId: PRINCIPLE_ID,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      canonicalPresentation: canonical,
      reopenFailedSameVersion: true,
    });
    assert.equal(again.skippedUsable, true);
    assert.equal(third.skippedUsable, true);
    assert.equal(
      listPlpAutoBuildWorkForTests().find((item) => item.entityId === PRINCIPLE_ID)?.status,
      "completed",
    );

    const currentPlan = await planLanguageHistoricalBackfill({
      locale: "uk",
      registryEligible: true,
      deps: {
        auditCorpus: async () => ({ byLocale: [] }) as never,
        classifyMediaEditorial: async () => "CURRENT_PUBLISHED_COMPLETE",
        assessCarouselPlp: async () => ({
          total: {
            ...emptyLanguageLocalizationCountBucket(),
            current: 52,
          },
          byKind: [
            {
              kindId: "civic_media_principle",
              checked: 6,
              counts: {
                ...emptyLanguageLocalizationCountBucket(),
                current: 6,
              },
            },
            {
              kindId: "civic_media_trusted",
              checked: 33,
              counts: {
                ...emptyLanguageLocalizationCountBucket(),
                current: 33,
              },
            },
            {
              kindId: "civic_media_fact_check",
              checked: 7,
              counts: {
                ...emptyLanguageLocalizationCountBucket(),
                current: 7,
              },
            },
            {
              kindId: "civic_media_propaganda",
              checked: 6,
              counts: {
                ...emptyLanguageLocalizationCountBucket(),
                current: 6,
              },
            },
          ],
        }),
      },
    });
    assert.equal(currentPlan.summary.plpWorkItems, 0);
    assert.ok(
      currentPlan.items
        .filter((item) => item.owner === "PLP")
        .every((item) => item.action === "skip_current"),
    );
  });

  it("M. one placeholder FAQ leaf invalidates the editorial presentation", () => {
    const canonical = asMediaPlpPresentationNode(
      buildCanonicalEditorialPresentation({
        overview: CIVIC_MEDIA_OVERVIEW,
        faq: [...CIVIC_MEDIA_FAQ],
      }),
    );
    let replaced = false;
    const values = valuesFor(canonical, editorialPolicy, (path, value) => {
      if (!replaced && path.includes("question")) {
        replaced = true;
        return `[uk] ${value}`;
      }
      return `Локал ${value}`;
    });
    assert.equal(replaced, true);
    const localized = presentationFrom(canonical, values);
    const content = evaluateLocalizationContentIntegrity({
      locale: "uk",
      canonicalPresentation: canonical,
      localizedPresentation: localized,
      fieldPolicy: editorialPolicy,
    });
    assert.ok(content.reasonCodes.includes("DETERMINISTIC_PLACEHOLDER"));
    assert.ok(content.DETERMINISTIC_PLACEHOLDER_PATHS.some((path) => path.includes("question")));
    const usability = classifyUsableLocalizedPresentation({
      locale: "uk",
      liveCanonicalVersion: fingerprintMediaPlpCanonicalVersion(canonical),
      canonicalPresentation: canonical,
      snapshot: snapshotFor({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
        locale: "uk",
        canonical,
        version: fingerprintMediaPlpCanonicalVersion(canonical),
        localized,
        policy: editorialPolicy,
        lieContentPassed: true,
      }),
    });
    assert.equal(usability.allowPublishedLocalized, false);
    assert.equal(usability.rebuildRequired, true);
  });
});
