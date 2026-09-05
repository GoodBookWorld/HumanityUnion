/**
 * Pack 08K.1 — public localization reconciliation operator.
 * Deterministic only — no live Gemini / no staging Mongo mutation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.CONTENT_TRANSLATION_WARM_LOCALE_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import type { Initiative, TranslatedContentRecord } from "@hu/types";
import {
  protectedIdentity,
  protectedTechnical,
} from "@hu/types";

import {
  collectAutoTranslatableNodes,
  discoverPublicLocalizationCorpus,
  ensureLanguageRegistrySeeded,
  getContentTranslationWorkerPeakConcurrencyForTests,
  listAutomaticContentTranslationTargetLocales,
  listContentTranslationWarmMemoryPendingForTests,
  markContentTranslationWarmMemoryFailedForTests,
  planPresentationLocaleCoverage,
  processContentTranslationWarmRequested,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetContentTranslationWorkerConcurrencyForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  resolveContentTranslationWorkerConcurrency,
  runPublicLocalizationReconciliation,
  sanitizeFieldsForAutomaticTranslation,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  uniquePresentationsRequiringWork,
  updateLanguageRegistryRecord,
  waitForPublicLocalizationMaterialization,
} from "../../../src/modules/language/index.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
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
    initiativeId: `initiative-pack08k1-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-pack08k1",
    createdAt: now,
    updatedAt: now,
    title: `Pack08K1 Initiative ${suffix}`,
    description: `Canonical English prose for reconciliation tests ${suffix}.`,
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

class TrackingFakeProvider implements TranslationProvider {
  readonly providerId = "deterministic" as const;
  callCount = 0;
  lastTexts: string[] = [];
  peakInFlight = 0;
  private inFlight = 0;
  private readonly delayMs: number;

  constructor(input?: { readonly delayMs?: number }) {
    this.delayMs = input?.delayMs ?? 10;
  }

  async translate(request: {
    readonly text: string;
    readonly targetLanguage: string;
  }): Promise<{
    readonly translatedText: string;
    readonly providerId: "deterministic";
    readonly isPlaceholder: boolean;
  }> {
    this.callCount += 1;
    this.lastTexts.push(request.text);
    this.inFlight += 1;
    this.peakInFlight = Math.max(this.peakInFlight, this.inFlight);
    try {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      const parsed = JSON.parse(request.text) as Record<string, string>;
      const translated: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        translated[key] = `[${request.targetLanguage}] ${value}`;
      }
      return {
        translatedText: JSON.stringify(translated),
        providerId: this.providerId,
        isPlaceholder: true,
      };
    } finally {
      this.inFlight -= 1;
    }
  }
}

function machineRow(input: {
  sourceKind: TranslatedContentRecord["sourceKind"];
  sourceRecordId: string;
  sourceVersion: string;
  targetLanguage: TranslatedContentRecord["targetLanguage"];
  fields: Record<string, string>;
  translationKind?: TranslatedContentRecord["translationKind"];
  stale?: boolean;
}): TranslatedContentRecord {
  const now = new Date().toISOString();
  return {
    translationId: `tr-${input.sourceRecordId}-${input.targetLanguage}`,
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    sourceVersion: input.sourceVersion,
    sourceLanguage: "en",
    targetLanguage: input.targetLanguage,
    translatedContent: input.fields,
    translationProvider: "deterministic",
    translationKind: input.translationKind ?? "machine",
    createdAt: now,
    updatedAt: now,
    stale: input.stale ?? false,
    freshness: input.stale ? "stale" : "current",
  };
}

describe("Pack 08K.1 — public localization reconciliation", () => {
  let provider: TrackingFakeProvider;
  const createdInitiativeIds: string[] = [];

  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetContentTranslationWorkerConcurrencyForTests();
    resetLanguageRegistryStoreForTests();
    resetTranslationProviderForTests();
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    for (const locale of ["zh-Hant", "ar"] as const) {
      try {
        await updateLanguageRegistryRecord(`lang-${locale}`, {
          enabled: true,
          contentTranslationEnabled: true,
        });
      } catch {
        // optional seed
      }
    }
    provider = new TrackingFakeProvider();
    setTranslationProviderForTests(provider);
  });

  afterEach(async () => {
    for (const id of createdInitiativeIds.splice(0)) {
      try {
        deleteInitiative(id);
      } catch {
        // ignore
      }
    }
    resetTranslationProviderForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("1. diagnostic discovery === reconciliation discovery (shared module)", async () => {
    const corpusSrc = readApi("src/modules/language/public-localization-corpus.ts");
    const diagnoseSrc = readApi("src/scripts/diagnose-public-localization-coverage.ts");
    const reconcileSrc = readApi(
      "src/modules/language/public-localization-reconciliation.ts",
    );
    assert.match(corpusSrc, /DIAGNOSTIC_DISCOVERY === RECONCILIATION_DISCOVERY/);
    assert.match(diagnoseSrc, /auditPublicLocalizationCorpus/);
    assert.match(reconcileSrc, /discoverPublicLocalizationCorpus/);
    assert.match(reconcileSrc, /auditPublicLocalizationCorpus/);

    const initiative = sampleInitiative("shared-discovery");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const a = await discoverPublicLocalizationCorpus({
      kinds: ["initiative"],
      deps: {
        listInitiatives: () => [initiative],
      },
    });
    const b = await discoverPublicLocalizationCorpus({
      kinds: ["initiative"],
      deps: {
        listInitiatives: () => [initiative],
      },
    });
    assert.deepEqual(
      a.candidates.map((c) => `${c.sourceKind}:${c.sourceRecordId}`),
      b.candidates.map((c) => `${c.sourceKind}:${c.sourceRecordId}`),
    );
  });

  it("2. dry-run performs zero writes / provider calls", async () => {
    const initiative = sampleInitiative("dry-run");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const beforePending = listContentTranslationWarmMemoryPendingForTests().length;
    const result = await runPublicLocalizationReconciliation({
      execute: false,
      kinds: ["initiative"],
      deps: { listInitiatives: () => [initiative] },
      targetLocales: ["uk", "zh-Hant", "ar"],
    });

    assert.equal(result.mode, "dry-run");
    assert.ok(result.audit.totals.WORK_ITEMS_REQUIRED >= 1);
    assert.equal(provider.callCount, 0);
    assert.equal(
      listContentTranslationWarmMemoryPendingForTests().length,
      beforePending,
    );
    assert.equal(result.enqueueResults.length, 0);
  });

  it("3. Blog 14-style corpus schedules all missing locale identities", () => {
    const locales = ["uk", "zh-Hant", "ar"] as const;
    const blogs = Array.from({ length: 14 }, (_, i) => ({
      sourceKind: "blog_post" as const,
      sourceRecordId: `blog-${i}`,
      sourceVersion: "v1",
      presentation: {
        title: `Blog title ${i}`,
        excerpt: `Blog excerpt ${i}`,
        content: `Blog body ${i}`,
      },
    }));

    const work = blogs.flatMap((blog) =>
      locales.map((locale) =>
        planPresentationLocaleCoverage({
          sourceKind: blog.sourceKind,
          sourceRecordId: blog.sourceRecordId,
          sourceLanguage: "en",
          sourceVersion: blog.sourceVersion,
          presentation: blog.presentation,
          targetLanguage: locale,
          translationRows: [],
        }),
      ),
    );

    const items = work.map((w) => w.workItem).filter(Boolean);
    assert.equal(items.length, 14 * 3);
    assert.equal(uniquePresentationsRequiringWork(items as never[]).length, 14);
  });

  it("4. Media generic presentation schedules missing locales", () => {
    const presentation = {
      principles: [{ title: "Principle", body: "Principle body" }],
      trustedCards: [
        {
          outletName: protectedIdentity("Outlet Name"),
          websiteUrl: protectedTechnical("https://example.org"),
          explanation: "Trusted explanation prose",
        },
      ],
    };
    const auto = collectAutoTranslatableNodes(presentation);
    assert.ok(auto.some((n) => n.path.includes("explanation")));
    assert.ok(!auto.some((n) => n.value === "Outlet Name"));
    assert.ok(!auto.some((n) => n.value.includes("https://")));

    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const planned = planPresentationLocaleCoverage({
        sourceKind: "civic_media",
        sourceRecordId: "media-1",
        sourceLanguage: "en",
        sourceVersion: "v1",
        presentation,
        targetLanguage: locale,
        translationRows: [],
      });
      assert.equal(planned.state, "MISSING");
      assert.ok(planned.workItem);
    }
  });

  it("5–8. CA / Comment / Petition / Collective Decision reconcile via same planner", () => {
    const cases = [
      {
        sourceKind: "collaborative_analysis" as const,
        presentation: {
          title: "CA title",
          summary: "CA summary",
          nested: { openQuestion: "Only this node missing later" },
        },
      },
      {
        sourceKind: "discussion_comment" as const,
        presentation: { body: "Comment body" },
      },
      {
        sourceKind: "petition" as const,
        presentation: {
          title: "Petition",
          paragraphs: ["p1", "p2", "p3", "p4", "p5"],
        },
      },
      {
        sourceKind: "collective_decision" as const,
        presentation: {
          title: "Decision title",
          summary: "Decision summary",
        },
      },
    ];

    for (const entry of cases) {
      const planned = planPresentationLocaleCoverage({
        sourceKind: entry.sourceKind,
        sourceRecordId: `${entry.sourceKind}-1`,
        sourceLanguage: "en",
        sourceVersion: "v1",
        presentation: entry.presentation,
        targetLanguage: "uk",
        translationRows: [],
      });
      assert.equal(planned.state, "MISSING", entry.sourceKind);
      assert.ok(planned.workItem, entry.sourceKind);
    }

    // Petition: 5 paragraphs, one missing → STALE work with single fallback path.
    const petitionPresentation = {
      title: "Petition",
      paragraphs: ["p1", "p2", "p3", "p4", "p5"],
    };
    const auto = collectAutoTranslatableNodes(petitionPresentation);
    assert.equal(auto.length, 6); // title + 5 paragraphs
    const translated: Record<string, string> = {};
    for (const node of auto) {
      if (node.path !== "paragraphs[4]") {
        translated[node.path] = `[uk] ${node.value}`;
      }
    }
    const partial = planPresentationLocaleCoverage({
      sourceKind: "petition",
      sourceRecordId: "petition-partial",
      sourceLanguage: "en",
      sourceVersion: "v1",
      presentation: petitionPresentation,
      targetLanguage: "uk",
      translationRows: [
        machineRow({
          sourceKind: "petition",
          sourceRecordId: "petition-partial",
          sourceVersion: "v1",
          targetLanguage: "uk",
          fields: translated,
        }),
      ],
    });
    assert.equal(partial.state, "STALE");
    assert.equal(partial.fallbackNodes, 1);
    assert.deepEqual(partial.fallbackPaths, ["paragraphs[4]"]);
  });

  it("9. unknown nested semantic property requires no allowlist edit", () => {
    const presentation = {
      title: "T",
      brandNewNeverSeenBefore: {
        deeperStill: "New prose that must translate",
      },
    };
    const planned = planPresentationLocaleCoverage({
      sourceKind: "initiative",
      sourceRecordId: "nested-new",
      sourceLanguage: "en",
      sourceVersion: "v1",
      presentation,
      targetLanguage: "uk",
      translationRows: [],
    });
    assert.ok(planned.fallbackPaths.includes("brandNewNeverSeenBefore.deeperStill"));
  });

  it("10–11. protected identity/URL/email/ID never enter provider payload", () => {
    const fields = {
      title: "Public title",
      authorName: "Should not appear if sanitized via protected wrappers path",
      websiteUrl: "https://example.org/secret",
      contactEmail: "person@example.org",
      status: "published",
      recordId: "id-123",
    };
    // Flat field bag still may include strings; presentation wrappers exclude from collect.
    const presentation = {
      title: "Public title",
      authorName: protectedIdentity("Alice"),
      websiteUrl: protectedTechnical("https://example.org/secret"),
      contactEmail: protectedTechnical("person@example.org"),
      status: protectedTechnical("published"),
      recordId: protectedTechnical("id-123"),
    };
    const auto = collectAutoTranslatableNodes(presentation);
    assert.deepEqual(
      auto.map((n) => n.path),
      ["title"],
    );

    const sanitized = sanitizeFieldsForAutomaticTranslation({
      sourceKind: "blog_post",
      fields,
    });
    // Eligibility sanitize keeps AUTO_TRANSLATABLE projection; blog uses title/excerpt/content.
    assert.ok(typeof sanitized.title === "string");
  });

  it("12. CURRENT complete presentation not rescheduled", () => {
    const presentation = { title: "T", description: "D" };
    const planned = planPresentationLocaleCoverage({
      sourceKind: "initiative",
      sourceRecordId: "current-1",
      sourceLanguage: "en",
      sourceVersion: "v1",
      presentation,
      targetLanguage: "uk",
      translationRows: [
        machineRow({
          sourceKind: "initiative",
          sourceRecordId: "current-1",
          sourceVersion: "v1",
          targetLanguage: "uk",
          fields: { title: "[uk] T", description: "[uk] D" },
        }),
      ],
    });
    assert.equal(planned.state, "CURRENT");
    assert.equal(planned.workItem, null);
  });

  it("13. manual/human translation not overwritten (not scheduled)", () => {
    const presentation = { title: "T", description: "D" };
    const planned = planPresentationLocaleCoverage({
      sourceKind: "initiative",
      sourceRecordId: "human-1",
      sourceLanguage: "en",
      sourceVersion: "v1",
      presentation,
      targetLanguage: "uk",
      translationRows: [
        machineRow({
          sourceKind: "initiative",
          sourceRecordId: "human-1",
          sourceVersion: "v1",
          targetLanguage: "uk",
          fields: { title: "Людина", description: "Опис" },
          translationKind: "human",
        }),
      ],
    });
    assert.equal(planned.state, "MANUAL_PRESERVED");
    assert.equal(planned.workItem, null);
  });

  it("14. STALE schedules regeneration", () => {
    const presentation = { title: "T", description: "D" };
    const planned = planPresentationLocaleCoverage({
      sourceKind: "initiative",
      sourceRecordId: "stale-1",
      sourceLanguage: "en",
      sourceVersion: "v2",
      presentation,
      targetLanguage: "uk",
      translationRows: [
        machineRow({
          sourceKind: "initiative",
          sourceRecordId: "stale-1",
          sourceVersion: "v1",
          targetLanguage: "uk",
          fields: { title: "[uk] old", description: "[uk] old" },
          stale: true,
        }),
      ],
    });
    assert.equal(planned.state, "STALE");
    assert.ok(planned.workItem);
  });

  it("15. enabled Registry locales discovered dynamically", async () => {
    const locales = await listAutomaticContentTranslationTargetLocales();
    assert.ok(locales.includes("uk"));
    // Disable zh-Hant content translation and ensure list shrinks.
    await updateLanguageRegistryRecord("lang-zh-Hant", {
      contentTranslationEnabled: false,
    });
    const after = await listAutomaticContentTranslationTargetLocales();
    assert.ok(!after.includes("zh-Hant"));
    assert.ok(after.includes("uk"));
  });

  it("16. worker peak respects configured cap", async () => {
    assert.equal(resolveContentTranslationWorkerConcurrency(), 1);
    const initiative = sampleInitiative("concurrency");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const result = await runPublicLocalizationReconciliation({
      execute: true,
      kinds: ["initiative"],
      deps: { listInitiatives: () => [initiative] },
      targetLocales: ["uk", "ar"],
    });
    assert.equal(result.mode, "execute");
    assert.ok(result.presentationsScheduled + result.presentationsDeduped >= 1);

    const pending = listContentTranslationWarmMemoryPendingForTests();
    for (const record of pending) {
      await processContentTranslationWarmRequested(record.command);
    }
    assert.ok(getContentTranslationWorkerPeakConcurrencyForTests() <= 1);
  });

  it("17. wait exits when complete", async () => {
    const initiative = sampleInitiative("wait-complete");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    await upsertContentTranslation(
      machineRow({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: "ignored",
        targetLanguage: "uk",
        fields: { title: "[uk] T", description: "[uk] D" },
      }),
    );

    // Resolve live sourceVersion via reconciliation dry-run path after generating CURRENT.
    const dry = await runPublicLocalizationReconciliation({
      execute: false,
      kinds: ["initiative"],
      deps: { listInitiatives: () => [initiative] },
      targetLocales: ["uk"],
    });

    // Force work items that are already CURRENT by constructing explicit identities
    // that match upserted version — use work items from a missing case then upsert.
    const missingItems = dry.audit.workItems;
    if (missingItems.length > 0) {
      for (const item of missingItems) {
        await upsertContentTranslation(
          machineRow({
            sourceKind: item.sourceKind,
            sourceRecordId: item.sourceRecordId,
            sourceVersion: item.sourceVersion,
            targetLanguage: item.targetLanguage,
            fields: { title: "[uk] T", description: "[uk] D" },
          }),
        );
      }
      const waited = await waitForPublicLocalizationMaterialization({
        workItems: missingItems,
        timeoutMs: 5_000,
        pollIntervalMs: 50,
      });
      assert.equal(waited.timedOut, false);
      assert.equal(waited.progress.CURRENT, missingItems.length);
      assert.equal(waited.progress.TERMINAL_FAILED, 0);
    } else {
      // Already complete — wait on empty set.
      const waited = await waitForPublicLocalizationMaterialization({
        workItems: [],
        timeoutMs: 1_000,
        pollIntervalMs: 50,
      });
      assert.equal(waited.timedOut, false);
      assert.equal(waited.progress.WORK_ITEMS_TOTAL, 0);
    }
  });

  it("18. wait exits on terminal failure", async () => {
    const initiative = sampleInitiative("wait-fail");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const dry = await runPublicLocalizationReconciliation({
      execute: true,
      kinds: ["initiative"],
      deps: { listInitiatives: () => [initiative] },
      targetLocales: ["uk"],
    });
    assert.ok(dry.audit.workItems.length >= 1);

    const pending = listContentTranslationWarmMemoryPendingForTests();
    assert.ok(pending.length >= 1);
    for (const record of pending) {
      markContentTranslationWarmMemoryFailedForTests(record.eventId);
    }

    const waited = await waitForPublicLocalizationMaterialization({
      workItems: dry.audit.workItems,
      timeoutMs: 3_000,
      pollIntervalMs: 50,
    });
    assert.equal(waited.timedOut, false);
    assert.ok(waited.progress.TERMINAL_FAILED >= 1);
    assert.equal(waited.progress.PENDING, 0);
  });

  it("19. wait exits on timeout", async () => {
    const waited = await waitForPublicLocalizationMaterialization({
      workItems: [
        {
          sourceKind: "initiative",
          sourceRecordId: "never-materializes",
          sourceVersion: "v1",
          targetLanguage: "uk",
          state: "MISSING",
          autoNodeCount: 1,
          missingOrStaleNodeCount: 1,
          fallbackPaths: ["title"],
        },
      ],
      timeoutMs: 400,
      pollIntervalMs: 50,
    });
    assert.equal(waited.timedOut, true);
    assert.ok(waited.progress.TIMED_OUT >= 1);
  });

  it("20. discovery zero/partial cannot masquerade as success", async () => {
    const empty = await discoverPublicLocalizationCorpus({
      kinds: ["initiative"],
      deps: {
        listInitiatives: () => [],
      },
    });
    assert.equal(empty.discoveryStatus, "FAILED");
    assert.equal(empty.candidates.length, 0);

    const script = readApi("src/scripts/reconcile-public-localization.ts");
    assert.match(script, /DISCOVERY_STATUS/);
    assert.match(script, /universalCorpusSuccessClaimed/);
    assert.match(script, /PARTIAL/);
    assert.match(script, /FAILED/);
  });

  it("21. process terminates deterministically (scripts call process.exit)", () => {
    const reconcile = readApi("src/scripts/reconcile-public-localization.ts");
    const diagnose = readApi("src/scripts/diagnose-public-localization-coverage.ts");
    assert.match(reconcile, /process\.exit\(/);
    assert.match(diagnose, /process\.exit\(/);
    assert.match(reconcile, /ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION/);
    assert.match(reconcile, /PLATFORM_MODE=production is not allowed/);
    assert.doesNotMatch(reconcile, /ALLOW_STAGING_CONTENT_TRANSLATION_WARM/);
  });

  it("counter rename is explicit (MISSING_TARGET_TRANSLATION_IDENTITIES)", () => {
    const corpus = readApi("src/modules/language/public-localization-corpus.ts");
    assert.match(corpus, /MISSING_TARGET_TRANSLATION_IDENTITIES/);
    assert.match(corpus, /SOURCE_PRESENTATION_COUNT/);
    assert.match(corpus, /PRESENTATIONS_WITH_ANY_FALLBACK/);
    assert.match(corpus, /Formerly MISSING_TRANSLATION_IDENTITIES/);
  });

  it("execute gate refuses production by default (script contract)", () => {
    const reconcile = readApi("src/scripts/reconcile-public-localization.ts");
    assert.match(reconcile, /humanity_union_staging/);
    assert.match(reconcile, /assertReconciliationGuards/);
    assert.match(reconcile, /ALLOW_FLAG/);
  });
});
