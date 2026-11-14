/**
 * HU-LC-05C.4C.7E.2S — Content Translation never exposes, or sends to a
 * provider, Initiatives or Collaborative Analyses that are not publicly
 * readable. Non-readable records resolve exactly like unknown ids.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import type { Initiative, InitiativeCollaborativeAnalysis } from "@hu/types";

import {
  DeterministicTranslationProvider,
  TranslationProviderError,
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  getOrCreateContentTranslation,
  listSearchDiscoveryWarmTargets,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  resetTranslationProviderForTests,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  setTranslationProviderForTests,
} from "../../../src/modules/language/index.js";
import { discoverStagingInitiativePathWarmSources } from "../../../src/modules/language/content-translation-staging-warm-backfill.js";
import { processContentTranslationWarmRequested } from "../../../src/modules/language/content-translation-warm-consumer.js";
import {
  loadTranslatableSource,
  resolvePublicTranslatedContent,
} from "../../../src/modules/language/content-translation.service.js";
import { listContentTranslationsForSource } from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  createAnalysis,
  deleteAnalysesByAuthorIdForTests,
  getAnalysisById,
} from "../../../src/modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import {
  createInitiative,
  deleteInitiative,
  getInitiativeById,
} from "../../../src/modules/initiatives/initiative.store.js";

const RUN = randomBytes(4).toString("hex");
const LOCALE = "xx-C7E2S";
const AUTHOR_ID = `member-7e2s-${RUN}`;
const secret = (name: string) => `SECRET-${name}-${RUN}`;

const INITIATIVE_CASES = {
  PublicInitiative: { lifecyclePhase: "projected", visibility: "public", blocked: false },
  DraftInitiative: { lifecyclePhase: "draft", visibility: "public", blocked: false },
  PrivateInitiative: { lifecyclePhase: "projected", visibility: "private", blocked: false },
  BlockedInitiative: { lifecyclePhase: "projected", visibility: "public", blocked: true },
} as const;
type InitiativeCase = keyof typeof INITIATIVE_CASES;
const PRIVATE_INITIATIVES: readonly InitiativeCase[] = [
  "DraftInitiative",
  "PrivateInitiative",
  "BlockedInitiative",
];

type AnalysisCase = "PublishedAnalysis" | "UnpublishedAnalysis" | "HiddenParentAnalysis";
const PRIVATE_ANALYSES: readonly AnalysisCase[] = ["UnpublishedAnalysis", "HiddenParentAnalysis"];

const initiativeIds = {} as Record<InitiativeCase, string>;
const analysisIds = {} as Record<AnalysisCase, string>;
const providerTexts: string[] = [];

let server: Server | null = null;
let baseUrl = "";

function initiative(name: InitiativeCase): Initiative {
  const shape = INITIATIVE_CASES[name];
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-7e2s-${name.toLowerCase()}-${RUN}`,
    stewardId: AUTHOR_ID,
    createdAt: now,
    updatedAt: now,
    title: secret(name),
    description: `${secret(name)} description`,
    status: "proposal",
    lifecyclePhase: shape.lifecyclePhase,
    visibility: { policy: shape.visibility },
    ...(shape.blocked ? { administrativelyBlocked: true } : {}),
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
  } as unknown as Initiative;
}

function analysis(
  name: AnalysisCase,
  initiativeId: string,
  status: "published" | "draft",
): InitiativeCollaborativeAnalysis {
  const now = new Date().toISOString();
  return {
    analysisId: `analysis-7e2s-${name.toLowerCase()}-${RUN}`,
    initiativeId,
    authorId: AUTHOR_ID,
    title: secret(name),
    summary: `${secret(name)} summary`,
    supportingEvidence: `${secret(name)} evidence`,
    risks: `${secret(name)} risks`,
    openQuestions: `${secret(name)} questions`,
    suggestedImprovements: `${secret(name)} improvements`,
    references: `${secret(name)} references`,
    status,
    initiativeVersion: 1,
    createdAt: now,
    updatedAt: now,
    ...(status === "published" ? { publishedAt: now } : {}),
  } as InitiativeCollaborativeAnalysis;
}

async function resolveOverHttp(
  kind: "initiative" | "collaborative_analysis",
  id: string,
): Promise<{ status: number; text: string; json: Record<string, unknown> }> {
  const response = await fetch(
    `${baseUrl}/api/v1/translations/resolve/${kind}/${encodeURIComponent(id)}?language=${LOCALE}`,
  );
  const text = await response.text();
  return { status: response.status, text, json: JSON.parse(text) as Record<string, unknown> };
}

function assertNoPrivateTextSentToProvider(): void {
  const privateNames = [...PRIVATE_INITIATIVES, ...PRIVATE_ANALYSES];
  for (const text of providerTexts) {
    for (const name of privateNames) {
      assert.equal(text.includes(secret(name)), false, `${name} text reached the provider`);
    }
  }
}

describe("HU-LC-05C.4C.7E.2S — cross-kind Content Translation privacy gates", () => {
  before(async () => {
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    setContentTranslationWarmForceMemoryForTests(true);
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await ensureTerminologyGlossarySeeded();

    // Records every provider request; output is a real (non-placeholder) localization.
    const deterministic = new DeterministicTranslationProvider();
    setTranslationProviderForTests({
      providerId: "gemini",
      translate: async (request) => {
        providerTexts.push(request.text);
        const result = await deterministic.translate(request);
        return {
          ...result,
          providerId: "gemini",
          isPlaceholder: false,
          translatedText: result.translatedText
            .split(`[${request.targetLanguage}] `)
            .join("Localized "),
        };
      },
    });

    await createLanguageRegistryRecord({
      languageId: `lang-${LOCALE.toLowerCase()}`,
      locale: LOCALE,
      englishName: "Privacy Synthetic",
      nativeName: "Privacy Synthetic",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: true,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });

    for (const name of Object.keys(INITIATIVE_CASES) as InitiativeCase[]) {
      const created = createInitiative(initiative(name));
      initiativeIds[name] = created.initiativeId;
    }
    for (const [name, parent, status] of [
      ["PublishedAnalysis", "PublicInitiative", "published"],
      ["UnpublishedAnalysis", "PublicInitiative", "draft"],
      ["HiddenParentAnalysis", "PrivateInitiative", "published"],
    ] as const) {
      analysisIds[name] = createAnalysis(analysis(name, initiativeIds[parent], status)).analysisId;
    }

    const app = express();
    app.use(express.json());
    app.use(
      "/api/v1/translations",
      (await import("../../../src/modules/language/language.routes.js")).default,
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    deleteAnalysesByAuthorIdForTests(AUTHOR_ID);
    for (const id of Object.values(initiativeIds)) {
      deleteInitiative(id);
    }
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("anonymous Initiative resolve: non-public Initiatives look exactly like unknown ids", async () => {
    const unknown = await resolveOverHttp("initiative", `initiative-7e2s-unknown-${RUN}`);
    assert.ok(unknown.status >= 400, unknown.text);
    for (const name of PRIVATE_INITIATIVES) {
      const result = await resolveOverHttp("initiative", initiativeIds[name]);
      assert.equal(result.status, unknown.status, `${name}: ${result.text}`);
      assert.deepEqual(result.json, unknown.json, `${name} differs from an unknown id`);
      assert.equal(result.text.includes("SECRET"), false, `${name} leaks source text`);
      assert.doesNotMatch(result.text, /draft|private|blocked|projected/i, `${name} leaks state`);
    }
    const open = await resolveOverHttp("initiative", initiativeIds.PublicInitiative);
    assert.equal(open.status, 200, open.text);
    assert.equal(
      (open.json.data as { content: Record<string, string> }).content.title,
      secret("PublicInitiative"),
    );
  });

  it("anonymous Analysis resolve: unpublished or hidden-parent analyses look like unknown ids", async () => {
    const unknown = await resolveOverHttp("collaborative_analysis", `analysis-7e2s-unknown-${RUN}`);
    assert.ok(unknown.status >= 400, unknown.text);
    for (const name of PRIVATE_ANALYSES) {
      const result = await resolveOverHttp("collaborative_analysis", analysisIds[name]);
      assert.equal(result.status, unknown.status, `${name}: ${result.text}`);
      assert.deepEqual(result.json, unknown.json, `${name} differs from an unknown id`);
      assert.equal(result.text.includes("SECRET"), false, `${name} leaks source text`);
    }
    const open = await resolveOverHttp("collaborative_analysis", analysisIds.PublishedAnalysis);
    assert.equal(open.status, 200, open.text);
    assert.equal(
      (open.json.data as { content: Record<string, string> }).content.title,
      secret("PublishedAnalysis"),
    );
  });

  it("the generate-on-read path refuses private sources instead of falling back to the original", async () => {
    for (const [kind, id] of [
      ...PRIVATE_INITIATIVES.map((name) => ["initiative", initiativeIds[name]] as const),
      ...PRIVATE_ANALYSES.map((name) => ["collaborative_analysis", analysisIds[name]] as const),
    ]) {
      await assert.rejects(
        resolvePublicTranslatedContent({
          sourceKind: kind,
          sourceRecordId: id,
          preferredReadingLanguage: LOCALE,
          translationPreference: "preferred",
          generateIfMissing: true,
        }),
        (error: unknown) =>
          error instanceof TranslationProviderError && /not found/i.test(error.message),
        id,
      );
    }
    assertNoPrivateTextSentToProvider();
  });

  it("warm and on-demand generation never send private text to the provider", async () => {
    for (const [kind, id] of [
      ...PRIVATE_INITIATIVES.map((name) => ["initiative", initiativeIds[name]] as const),
      ...PRIVATE_ANALYSES.map((name) => ["collaborative_analysis", analysisIds[name]] as const),
    ]) {
      const result = await processContentTranslationWarmRequested({
        commandName: "ContentTranslationWarmRequested",
        sourceKind: kind,
        sourceRecordId: id,
        requestedAt: new Date().toISOString(),
        reason: "public_mutation",
      });
      assert.equal(result.outcome, "skipped_ineligible", id);
      await assert.rejects(
        getOrCreateContentTranslation({
          sourceKind: kind,
          sourceRecordId: id,
          targetLanguage: LOCALE,
          generateIfMissing: true,
          intent: "on_demand",
        }),
        (error: unknown) => error instanceof TranslationProviderError && error.code === "forbidden",
        id,
      );
      assert.deepEqual(
        await listContentTranslationsForSource({ sourceKind: kind, sourceRecordId: id }),
        [],
        `${id} produced translation rows`,
      );
    }
    assertNoPrivateTextSentToProvider();
  });

  it("public Initiatives and published analyses still warm and resolve their translations", async () => {
    for (const [kind, id, name] of [
      ["initiative", initiativeIds.PublicInitiative, "PublicInitiative"],
      ["collaborative_analysis", analysisIds.PublishedAnalysis, "PublishedAnalysis"],
    ] as const) {
      const before = providerTexts.length;
      const result = await processContentTranslationWarmRequested({
        commandName: "ContentTranslationWarmRequested",
        sourceKind: kind,
        sourceRecordId: id,
        requestedAt: new Date().toISOString(),
        reason: "public_mutation",
      });
      assert.equal(result.outcome, "completed", `${name}: ${JSON.stringify(result)}`);
      assert.ok(providerTexts.slice(before).some((text) => text.includes(secret(name))), name);
      const rows = await listContentTranslationsForSource({ sourceKind: kind, sourceRecordId: id });
      assert.ok(rows.some((row) => row.targetLanguage === LOCALE), `${name} translation row`);
      const resolved = await resolveOverHttp(kind, id);
      assert.equal(resolved.status, 200, resolved.text);
      assert.notEqual(
        (resolved.json.data as { presentationMode: string }).presentationMode,
        "original",
        `${name} should present its translation`,
      );
    }
    assertNoPrivateTextSentToProvider();
  });

  it("backfill and search discovery select only publicly readable Initiatives and analyses", async () => {
    const discovered = await discoverStagingInitiativePathWarmSources({
      kinds: ["initiative", "collaborative_analysis"],
    });
    const searched = await listSearchDiscoveryWarmTargets();
    for (const targets of [discovered.candidates, searched]) {
      const ofRun = targets.filter((target) => target.sourceRecordId.includes(RUN));
      assert.deepEqual(
        ofRun
          .filter((target) => target.sourceKind === "initiative")
          .map((target) => target.sourceRecordId),
        [initiativeIds.PublicInitiative],
      );
      assert.deepEqual(
        ofRun
          .filter((target) => target.sourceKind === "collaborative_analysis")
          .map((target) => target.sourceRecordId),
        [analysisIds.PublishedAnalysis],
      );
    }
  });

  it("keeps steward lookups and canonical records unchanged", async () => {
    const before = JSON.stringify([
      ...Object.values(initiativeIds).map((id) => getInitiativeById(id)),
      ...Object.values(analysisIds).map((id) => getAnalysisById(id)),
    ]);
    for (const name of PRIVATE_INITIATIVES) {
      const source = await loadTranslatableSource({
        sourceKind: "initiative",
        sourceRecordId: initiativeIds[name],
      });
      assert.equal(source?.authorParticipantId, AUTHOR_ID, `${name} author check`);
      assert.equal(source?.isPublished, false, name);
      await resolveOverHttp("initiative", initiativeIds[name]);
    }
    for (const name of PRIVATE_ANALYSES) {
      const source = await loadTranslatableSource({
        sourceKind: "collaborative_analysis",
        sourceRecordId: analysisIds[name],
      });
      assert.equal(source?.authorParticipantId, AUTHOR_ID, `${name} author check`);
      assert.equal(source?.isPublished, false, name);
      await resolveOverHttp("collaborative_analysis", analysisIds[name]);
    }
    const after = JSON.stringify([
      ...Object.values(initiativeIds).map((id) => getInitiativeById(id)),
      ...Object.values(analysisIds).map((id) => getAnalysisById(id)),
    ]);
    assert.equal(after, before);
  });
});
