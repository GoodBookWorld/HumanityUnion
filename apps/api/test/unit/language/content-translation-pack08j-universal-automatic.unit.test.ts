/**
 * Pack 08J — universal automatic translation: default AUTO_TRANSLATABLE,
 * NON_TRANSLATABLE exclusion, generic walker, no allowlist enrollment for new keys.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "2";

import type { Initiative } from "@hu/types";
import { DEFAULT_LOCALIZABLE_RULE, LOCALIZATION_OWNERSHIP_SYNONYMS } from "@hu/types";

import {
  DeterministicTranslationProvider,
  assertSafeForAutomaticTranslation,
  filterTranslatedFieldsToSourceAllowlist,
  getContentTranslationWorkerPeakConcurrencyForTests,
  getOrCreateContentTranslation,
  isNonTranslatableFieldKey,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWorkerConcurrencyForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  resolveAutomaticTranslationFieldKeys,
  resolveContentTranslationWorkerConcurrency,
  sanitizeFieldsForAutomaticTranslation,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  stripNonTranslatableKeys,
  TranslationProviderError,
  updateLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  walkTranslatablePresentation,
} from "../../../src/modules/language/index.js";
import { CONTENT_TRANSLATION_FIELD_ALLOWLIST } from "../../../src/modules/language/content-translation-eligibility.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import type { TranslationProvider } from "../../../src/modules/language/translation-provider.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readApi(relative: string): string {
  return readFileSync(path.resolve(here, "../../../", relative), "utf8");
}

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack08j-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-pack08j",
    createdAt: now,
    updatedAt: now,
    title: `Pack 08J Initiative ${suffix}`,
    description: `Canonical English description for Pack 08J ${suffix}.`,
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
  };
}

class TrackingProvider implements TranslationProvider {
  readonly providerId = "deterministic" as const;
  lastText: string | null = null;
  callCount = 0;
  peakInFlight = 0;
  private inFlight = 0;

  async translate(request: {
    readonly text: string;
    readonly targetLanguage: string;
    readonly safetyCleared?: boolean;
  }): Promise<{
    readonly translatedText: string;
    readonly providerId: "deterministic";
    readonly isPlaceholder: boolean;
  }> {
    this.callCount += 1;
    this.inFlight += 1;
    this.peakInFlight = Math.max(this.peakInFlight, this.inFlight);
    this.lastText = request.text;
    try {
      await new Promise((resolve) => setTimeout(resolve, 15));
      const parsed = JSON.parse(request.text) as Record<string, string>;
      const translated: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        translated[key] = `[${request.targetLanguage}] ${value}`;
      }
      return {
        translatedText: JSON.stringify(translated),
        providerId: this.providerId,
        isPlaceholder: false,
      };
    } finally {
      this.inFlight -= 1;
    }
  }
}

describe("Pack 08J — ownership synonyms + default rule", () => {
  it("maps UI_CHROME and AUTO_TRANSLATABLE_CONTENT synonyms", () => {
    assert.equal(LOCALIZATION_OWNERSHIP_SYNONYMS.UI_CHROME, "WEB_UI");
    assert.equal(LOCALIZATION_OWNERSHIP_SYNONYMS.AUTO_TRANSLATABLE_CONTENT, "CIVIC_CONTENT");
    assert.match(DEFAULT_LOCALIZABLE_RULE, /AUTO_TRANSLATABLE_CONTENT/);
    assert.match(DEFAULT_LOCALIZABLE_RULE, /by default/i);
  });
});

describe("Pack 08J — NON_TRANSLATABLE policy", () => {
  it("strips identity/private/technical keys and never sends them to provider", () => {
    const stripped = stripNonTranslatableKeys({
      title: "River cleanup",
      description: "Help restore the river.",
      email: "person@example.com",
      participantId: "p-1",
      url: "https://example.com",
      status: "open",
      futureSemanticNote: "A new semantic field without allowlist edit.",
    });
    assert.equal(stripped.title, "River cleanup");
    assert.equal(stripped.futureSemanticNote, "A new semantic field without allowlist edit.");
    assert.equal(stripped.email, undefined);
    assert.equal(stripped.participantId, undefined);
    assert.equal(stripped.url, undefined);
    assert.equal(stripped.status, undefined);
    assert.ok(isNonTranslatableFieldKey("email"));
    assert.ok(isNonTranslatableFieldKey("uniqueName"));
    assert.equal(isNonTranslatableFieldKey("futureSemanticNote"), false);
  });

  it("assertSafeForAutomaticTranslation rejects protected payload leakage", () => {
    assert.throws(
      () => assertSafeForAutomaticTranslation({ email: "a@b.com" }),
      (error: unknown) =>
        error instanceof TranslationProviderError && error.code === "forbidden",
    );
  });
});

describe("Pack 08J — new semantic field without allowlist edit", () => {
  const createdIds: string[] = [];
  let provider: TrackingProvider;

  beforeEach(async () => {
    process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "2";
    resetContentTranslationWorkerConcurrencyForTests();
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    provider = new TrackingProvider();
    setTranslationProviderForTests(provider);
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
  });

  afterEach(() => {
    for (const id of createdIds.splice(0)) {
      deleteInitiative(id);
    }
    resetContentTranslationMemoryStoreForTests();
    resetTranslationProviderForTests();
    resetContentTranslationWorkerConcurrencyForTests();
  });

  it("A. futureSemanticNote translates without editing CONTENT_TRANSLATION_FIELD_ALLOWLIST", () => {
    assert.ok(
      !(CONTENT_TRANSLATION_FIELD_ALLOWLIST.initiative as readonly string[]).includes(
        "futureSemanticNote",
      ),
    );
    const keys = resolveAutomaticTranslationFieldKeys({
      sourceFields: {
        title: "Title",
        description: "Description",
        futureSemanticNote: "New semantic prose",
      },
      compatibilityAllowlist: CONTENT_TRANSLATION_FIELD_ALLOWLIST.initiative as readonly string[],
    });
    assert.ok(keys.includes("futureSemanticNote"));
    assert.ok(keys.includes("title"));

    const filtered = filterTranslatedFieldsToSourceAllowlist({
      sourceKind: "initiative",
      sourceFields: {
        title: "Title",
        description: "Description",
        futureSemanticNote: "New semantic prose",
      },
      translatedFields: {
        title: "[uk] Title",
        description: "[uk] Description",
        futureSemanticNote: "[uk] New semantic prose",
        invented: "nope",
      },
    });
    assert.equal(filtered.futureSemanticNote, "[uk] New semantic prose");
    assert.equal(filtered.invented, undefined);
  });

  it("B. protected values never reach provider from sanitizeFieldsForAutomaticTranslation", async () => {
    const initiative = createInitiative(sampleInitiative("protect"));
    createdIds.push(initiative.initiativeId);

    // Simulate a loader bag that accidentally included email + a new semantic field.
    const sanitized = sanitizeFieldsForAutomaticTranslation({
      sourceKind: "initiative",
      fields: {
        title: initiative.title,
        description: initiative.description,
        futureSemanticNote: "Extra semantic prose for 08J.",
        email: "leak@example.com",
        participantId: "p-leak",
      },
    });
    assert.equal(sanitized.email, undefined);
    assert.equal(sanitized.participantId, undefined);
    assert.equal(sanitized.futureSemanticNote, "Extra semantic prose for 08J.");

    await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.ok(provider.lastText);
    assert.doesNotMatch(provider.lastText!, /leak@example\.com/);
    assert.doesNotMatch(provider.lastText!, /p-leak/);
  });

  it("C. Brand/Legal remain non-machine domains in ownership docs", () => {
    const ownership = readApi("src/modules/language/localization-ownership.ts");
    assert.match(ownership, /BRAND_LOCALIZATION/);
    assert.match(ownership, /LEGAL_LOCALIZATION/);
    const consumer = readApi("src/modules/language/content-translation-warm-consumer.ts");
    assert.doesNotMatch(consumer, /brand-localization|legal-localization/);
  });

  it("D. walker preserves structure and NON_TRANSLATABLE keys", async () => {
    const projected = {
      title: "Hello",
      nested: { summary: "World", participantId: "p-1" },
      tags: ["one", "two"],
    };
    const walked = await walkTranslatablePresentation(projected, async ({ value }) => `[uk] ${value}`);
    assert.equal(walked.title, "[uk] Hello");
    assert.equal(walked.nested.summary, "[uk] World");
    assert.equal(walked.nested.participantId, "p-1");
    assert.deepEqual(walked.tags, ["[uk] one", "[uk] two"]);
  });

  it("E. concurrency stress still respects worker cap", async () => {
    assert.equal(resolveContentTranslationWorkerConcurrency(), 2);
    const initiatives = Array.from({ length: 40 }, (_, index) => {
      const initiative = createInitiative(sampleInitiative(`stress-${index}`));
      createdIds.push(initiative.initiativeId);
      return initiative;
    });
    await Promise.all(
      initiatives.map((initiative) =>
        getOrCreateContentTranslation({
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLanguage: "uk",
          generateIfMissing: true,
          intent: "automatic_warm",
        }),
      ),
    );
    assert.ok(provider.peakInFlight <= 2);
    assert.ok(getContentTranslationWorkerPeakConcurrencyForTests() <= 2);
  });

  it("F. recovery operator exits deterministically (process.exit)", () => {
    const script = readApi("src/scripts/warm-staging-content-translations.ts");
    assert.match(script, /process\.exit\(process\.exitCode \?\? 0\)/);
    assert.match(script, /recovery|migration only/i);
    assert.match(script, /scheduleContentTranslationWarmAfterMutation/);
    assert.match(script, /terminalFailed/);
  });

  it("G. wait diagnostics distinguish FAILED vs PENDING", () => {
    const repair = readApi("src/modules/language/content-translation-staging-warm-repair.ts");
    assert.match(repair, /resolveContentTranslationWarmOutboxDisposition/);
    assert.match(repair, /terminalFailed \+= 1/);
    assert.match(repair, /state: "FAILED"/);
    assert.doesNotMatch(repair, /const terminalFailed = 0;/);
  });
});

describe("Pack 08J — architecture contracts", () => {
  it("docs describe AUTO_TRANSLATABLE default and exclusion policy", () => {
    const docs = readFileSync(
      path.resolve(here, "../../../../../project/architecture/core/LANGUAGE_TRANSLATION_ARCHITECTURE_v1.0.md"),
      "utf8",
    );
    assert.match(docs, /Pack 08J/);
    assert.match(docs, /AUTO_TRANSLATABLE_CONTENT/);
    assert.match(docs, /compatibility shim/i);
    assert.match(docs, /recovery \/ migration only/i);
  });

  it("single translation engine preserved", () => {
    const service = readApi("src/modules/language/content-translation.service.ts");
    assert.match(service, /sanitizeFieldsForAutomaticTranslation/);
    assert.match(service, /withContentTranslationWorkerSlot/);
    const worker = readApi("src/modules/language/content-translation-worker-concurrency.ts");
    assert.match(worker, /DEFAULT_WORKER_CONCURRENCY = 1/);
  });
});
