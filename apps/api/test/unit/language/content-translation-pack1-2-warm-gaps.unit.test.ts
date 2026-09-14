/**
 * Pack 1.2 — close automatic CT warm gaps + CURRENT completeness.
 * No live Gemini / no historical warm execution.
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
  assertEligibleSourceFieldsFullyTranslated,
  ContentTranslationValidationError,
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  listAutomaticContentTranslationTargetLocales,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  TranslationProviderError,
  updateLanguageRegistryRecord,
  type TranslationProvider,
  type TranslationProviderRequest,
  type TranslationProviderResult,
} from "../../../src/modules/language/index.js";
import { findContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  listContentTranslationWarmMemoryPendingForTests,
} from "../../../src/modules/language/content-translation-warm-enqueue.js";
import {
  createInitiative,
  deleteInitiative,
  updateInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import { republishInitiativeContent } from "../../../src/modules/initiatives/initiative.service.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");

function readApi(relative: string): string {
  return readFileSync(path.join(repoRoot, "apps/api", relative), "utf8");
}

function sampleInitiative(overrides?: Partial<Initiative>): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack12-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-pack12",
    createdAt: now,
    updatedAt: now,
    title: "Clean River Initiative",
    description: "Participants restore a local river with evidence-based steps.",
    status: "proposal",
    lifecyclePhase: "projected",
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
    ...overrides,
  };
}

class ScriptedStructuredTranslationProvider implements TranslationProvider {
  readonly providerId = "deterministic" as const;
  private readonly script: (request: TranslationProviderRequest) => Record<string, string>;

  constructor(script: (request: TranslationProviderRequest) => Record<string, string>) {
    this.script = script;
  }

  async translate(request: TranslationProviderRequest): Promise<TranslationProviderResult> {
    if (!request.safetyCleared) {
      throw new TranslationProviderError("safety_rejected", "Safety not cleared.");
    }
    return {
      providerId: this.providerId,
      translatedText: JSON.stringify(this.script(request)),
    };
  }
}

describe("Pack 1.2 — automatic translation warm gaps", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetTranslationProviderForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
  });

  afterEach(() => {
    resetTranslationProviderForTests();
    resetContentTranslationWarmMemoryForTests();
    resetContentTranslationMemoryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("A. Initiative republish schedules warm when eligible title/description change", async () => {
    const initiative = createInitiative(sampleInitiative());
    resetContentTranslationWarmMemoryForTests();

    republishInitiativeContent(initiative, {
      title: "Restored River Initiative",
      description: initiative.description,
    });
    // scheduleContentTranslationWarmAfterMutation is fire-and-forget — flush microtasks.
    await new Promise<void>((resolve) => setImmediate(resolve));

    const pending = listContentTranslationWarmMemoryPendingForTests();
    assert.equal(pending.length, 1);
    assert.equal(pending[0]!.command.sourceKind, "initiative");
    assert.equal(pending[0]!.command.sourceRecordId, initiative.initiativeId);
    assert.equal(pending[0]!.command.reason, "public_update");

    deleteInitiative(initiative.initiativeId);
  });

  it("A2. Initiative republish without eligible field change does not schedule warm", async () => {
    const initiative = createInitiative(sampleInitiative());
    resetContentTranslationWarmMemoryForTests();

    republishInitiativeContent(initiative, {});
    await new Promise<void>((resolve) => setImmediate(resolve));

    const pending = listContentTranslationWarmMemoryPendingForTests();
    assert.equal(pending.length, 0);
    deleteInitiative(initiative.initiativeId);
  });

  it("B. Automatic warm targets require enabled && contentTranslationEnabled", async () => {
    const targets = await listAutomaticContentTranslationTargetLocales({
      excludeSourceLanguage: "en",
    });
    assert.ok(targets.includes("uk"));
    assert.ok(!targets.includes("en"));

    await updateLanguageRegistryRecord("lang-uk", {
      contentTranslationEnabled: false,
    });
    const after = await listAutomaticContentTranslationTargetLocales({
      excludeSourceLanguage: "en",
    });
    assert.ok(!after.includes("uk"));
  });

  it("C–D. sourceVersion change rebuilds; same version reuses CURRENT without provider", async () => {
    const initiative = createInitiative(sampleInitiative());
    let providerCalls = 0;
    setTranslationProviderForTests(
      new ScriptedStructuredTranslationProvider(() => {
        providerCalls += 1;
        return {
          title: "Ініціатива чистої річки",
          description: "Учасники відновлюють місцеву річку.",
        };
      }),
    );

    const first = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(first.generated, true);
    assert.equal(providerCalls, 1);
    const version1 = first.source.sourceVersion;

    const second = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(second.generated, false);
    assert.equal(providerCalls, 1);
    assert.equal(second.translation?.sourceVersion, version1);

    updateInitiative(initiative.initiativeId, {
      title: "Clean River Initiative Updated",
    });

    const third = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(third.generated, true);
    assert.equal(providerCalls, 2);
    assert.notEqual(third.source.sourceVersion, version1);

    deleteInitiative(initiative.initiativeId);
  });

  it("E. Failed incomplete build does not destroy previous CURRENT", async () => {
    const initiative = createInitiative(sampleInitiative());
    let mode: "complete" | "incomplete" = "complete";
    setTranslationProviderForTests(
      new ScriptedStructuredTranslationProvider(() => {
        if (mode === "complete") {
          return {
            title: "Ініціатива чистої річки",
            description: "Учасники відновлюють місцеву річку.",
          };
        }
        return {
          title: "Ініціатива чистої річки",
        };
      }),
    );

    const created = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(created.generated, true);
    const keptId = created.translation!.translationId;
    const keptVersion = created.translation!.sourceVersion;

    mode = "incomplete";
    updateInitiative(initiative.initiativeId, {
      title: "Clean River Initiative v2",
    });

    await assert.rejects(
      () =>
        getOrCreateContentTranslation({
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLanguage: "uk",
          generateIfMissing: true,
          intent: "automatic_warm",
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "MISSING_REQUIRED_PATH",
    );

    const previous = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: keptVersion,
      targetLanguage: "uk",
    });
    assert.ok(previous);
    assert.equal(previous.translationId, keptId);
    assert.equal(previous.translatedContent.title, "Ініціатива чистої річки");

    deleteInitiative(initiative.initiativeId);
  });

  it("F. Completeness validation: missing required field fails; empty optional ok; complete succeeds", () => {
    assert.throws(
      () =>
        assertEligibleSourceFieldsFullyTranslated({
          sourceKind: "initiative",
          sourceFields: { title: "T", description: "D" },
          translatedFields: { title: "T-uk" },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "MISSING_REQUIRED_PATH",
    );

    assert.doesNotThrow(() =>
      assertEligibleSourceFieldsFullyTranslated({
        sourceKind: "initiative",
        sourceFields: { title: "T", description: "" },
        translatedFields: { title: "T-uk" },
      }),
    );

    assert.doesNotThrow(() =>
      assertEligibleSourceFieldsFullyTranslated({
        sourceKind: "petition",
        sourceFields: {
          title: "T",
          summary: "S",
          requestStatement: "",
          expectedOutcome: "",
          supportingContext: "",
          keyArguments: "",
        },
        translatedFields: { title: "T-uk", summary: "S-uk" },
      }),
    );
  });

  it("civic_media remains seed/operator warm (no mutation schedule invented)", () => {
    const loaders = readApi("src/modules/language/content-translation-civic-loaders.ts");
    assert.match(loaders, /no admin mutation API|static seed record/);
    assert.match(loaders, /discoverCivicMediaTranslationRecordIds/);
    const warmScript = readApi("src/scripts/warm-staging-content-translations.ts");
    assert.match(warmScript, /civic_media|CONTENT_TRANSLATION_RECOVERY/);
  });

  it("G. Pack 1.1 generate-on-read remains retired", () => {
    const routes = readApi("src/modules/language/language.routes.ts");
    assert.match(routes, /status\(410\)/);
    assert.doesNotMatch(routes, /generateIfMissing:\s*true/);
    const webFields = readFileSync(
      path.join(repoRoot, "apps/web/src/features/language/components/PublicTranslatedFields.tsx"),
      "utf8",
    );
    assert.doesNotMatch(webFields, /generateContentTranslation/);
  });
});
