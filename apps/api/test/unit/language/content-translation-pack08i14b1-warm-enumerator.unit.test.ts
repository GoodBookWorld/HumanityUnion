/**
 * Pack 08I.14B.1 — staging warm enumerator discovery vs live API persistence.
 *
 * Root cause regression: warm script connected Mongo without
 * hydrating Initiative/Analysis snapshot stores (empty discovery).
 * Pack 08I.16 — operator uses lightweight bootstrap, not full API hydrate.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type {
  Initiative,
  InitiativeCollaborativeAnalysis,
  Petition,
} from "@hu/types";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";

const here = path.dirname(fileURLToPath(import.meta.url));

function readApi(relative: string): string {
  return readFileSync(path.resolve(here, "../../../", relative), "utf8");
}

const PREFIX = "08i14b1-warm";

function buildPublicInitiative(overrides: Partial<Initiative> = {}): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `${PREFIX}-init-public`,
    stewardId: `${PREFIX}-steward`,
    createdAt: now,
    updatedAt: now,
    title: "Staging-shaped Public Initiative",
    description: "Canonical English description for warm discovery.",
    status: "poll",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "environment",
      tags: [],
      region: "Global",
      language: "en",
      communitySlug: "test-community",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
    ...overrides,
  };
}

describe("Pack 08I.14B.1 — warm enumerator persistence bootstrap", () => {
  it("warm script bootstraps lightweight operator persistence before enumeration", () => {
    const script = readApi("src/scripts/warm-staging-content-translations.ts");
    assert.match(script, /bootstrapContentTranslationOperatorPersistence/);
    assert.doesNotMatch(script, /await bootstrapMongoPersistence\(\)/);
    assert.match(script, /SOURCE_RECORDS_DISCOVERED/);
    assert.match(script, /WARM_REQUEST_CANDIDATES/);
    assert.match(script, /ELIGIBLE_SOURCE_RECORDS/);
  });

  it("empty Initiative store surfaces discoveryHint at SOURCE_RECORDS_DISCOVERED=0", async () => {
    const { discoverStagingInitiativePathWarmSources } = await import(
      "../../../src/modules/language/content-translation-staging-warm-backfill.js"
    );
    const discovered = await discoverStagingInitiativePathWarmSources({
      kinds: ["initiative"],
      deps: {
        listInitiatives: () => [],
        listApprovedInitiativeComments: async () => ({
          comments: [],
          total: 0,
          limit: 100,
          offset: 0,
          hasMore: false,
        }),
        listPublishedAnalysesByInitiative: () => [],
        listPetitions: async () => [],
      },
    });
    assert.equal(discovered.candidates.length, 0);
    assert.match(String(discovered.discoveryHint), /SOURCE_RECORDS_DISCOVERED\.initiative=0/);
    assert.match(String(discovered.discoveryHint), /syncInitiativeStoreAfterMongoHydrate|bootstrapContentTranslationOperatorPersistence/);
  });
});

describe("Pack 08I.14B.1 — staging-shaped persistence discovery", () => {
  let createInitiative: (initiative: Initiative) => Initiative;
  let createAnalysis: (analysis: InitiativeCollaborativeAnalysis) => InitiativeCollaborativeAnalysis;
  let createMemoryComment: typeof import("../../../src/modules/initiative-comments/initiative-comment.memory.store.js").createInitiativeComment;
  let resetCommentMemory: () => void;
  let runWarm: typeof import("../../../src/modules/language/content-translation-staging-warm-backfill.js").runStagingInitiativePathContentTranslationWarm;
  let setWarmMemory: (enabled: boolean) => void;
  let resetWarmMemory: () => void;
  let listWarmPending: () => ReadonlyArray<{ eventId: string }>;

  before(async () => {
    process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";
    const initiativeStore = await import("../../../src/modules/initiatives/initiative.store.js");
    const analysisStore = await import(
      "../../../src/modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js"
    );
    const commentMemory = await import(
      "../../../src/modules/initiative-comments/initiative-comment.memory.store.js"
    );
    const warm = await import(
      "../../../src/modules/language/content-translation-staging-warm-backfill.js"
    );
    const enqueue = await import(
      "../../../src/modules/language/content-translation-warm-enqueue.js"
    );

    createInitiative = initiativeStore.createInitiative;
    createAnalysis = analysisStore.createAnalysis;
    createMemoryComment = commentMemory.createInitiativeComment;
    resetCommentMemory = commentMemory.resetInitiativeCommentStoreForTests;
    runWarm = warm.runStagingInitiativePathContentTranslationWarm;
    setWarmMemory = enqueue.setContentTranslationWarmForceMemoryForTests;
    resetWarmMemory = enqueue.resetContentTranslationWarmMemoryForTests;
    listWarmPending = enqueue.listContentTranslationWarmMemoryPendingForTests;

    setWarmMemory(true);
    resetWarmMemory();
    resetCommentMemory();
  });

  it("dry-run discovers non-zero initiative/comment/analysis/petition candidates", async () => {
    const publicInit = createInitiative(buildPublicInitiative());
    createInitiative(
      buildPublicInitiative({
        initiativeId: `${PREFIX}-init-private`,
        visibility: { policy: "steward_only" },
        title: "Private Initiative",
      }),
    );

    const now = new Date().toISOString();
    createAnalysis({
      analysisId: `${PREFIX}-analysis-public`,
      initiativeId: publicInit.initiativeId,
      authorId: `${PREFIX}-author`,
      title: "Published Collaborative Analysis",
      summary: "Analysis summary",
      supportingEvidence: "evidence",
      risks: "risks",
      openQuestions: "questions",
      suggestedImprovements: "improvements",
      references: "refs",
      status: "published",
      initiativeVersion: 1,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    });
    createAnalysis({
      analysisId: `${PREFIX}-analysis-draft`,
      initiativeId: publicInit.initiativeId,
      authorId: `${PREFIX}-author`,
      title: "Draft Analysis",
      summary: "draft",
      supportingEvidence: "",
      risks: "",
      openQuestions: "",
      suggestedImprovements: "",
      references: "",
      status: "draft",
      initiativeVersion: 1,
      createdAt: now,
      updatedAt: now,
    });

    const approved = createMemoryComment({
      initiativeId: publicInit.initiativeId,
      authorUserId: `${PREFIX}-user-a`,
      authorDisplayName: "Participant",
      body: "Approved public discussion comment body.",
    });
    const removed = createMemoryComment({
      initiativeId: publicInit.initiativeId,
      authorUserId: `${PREFIX}-user-b`,
      authorDisplayName: "Participant",
      body: "Soon removed comment body.",
    });
    // Mark removed via memory store delete path shape.
    const commentMemory = await import(
      "../../../src/modules/initiative-comments/initiative-comment.memory.store.js"
    );
    commentMemory.deleteInitiativeComment({
      commentId: removed.commentId,
      authorUserId: `${PREFIX}-user-b`,
    });

    // Petition: live API uses Mongo listPetitions; inject staging-shaped public/non-draft rows.
    const petitions = [
      {
        petitionId: `${PREFIX}-petition-open`,
        status: "Open",
        subject: {
          initiativeId: publicInit.initiativeId,
          title: "Open Petition",
          summary: "Petition summary",
          requestStatement: "request",
          expectedOutcome: "outcome",
          supportingContext: "context",
          keyArguments: ["a"],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        petitionId: `${PREFIX}-petition-draft`,
        status: "Draft",
        subject: {
          initiativeId: publicInit.initiativeId,
          title: "Draft Petition",
          summary: "draft",
        },
        createdAt: now,
        updatedAt: now,
      },
    ] as unknown as Petition[];

    const result = await runWarm({
      execute: false,
      kinds: ["initiative", "discussion_comment", "collaborative_analysis", "petition"],
      deps: {
        listPetitions: async () => petitions,
      },
    });

    const byKind = Object.fromEntries(
      result.discoveryByKind.map((row) => [row.sourceKind, row]),
    );

    assert.ok((byKind.initiative?.sourceRecordsDiscovered ?? 0) >= 2);
    assert.equal(byKind.initiative?.publicRecords, 1);
    assert.ok((byKind.initiative?.warmRequestCandidates ?? 0) >= 1);

    assert.ok((byKind.discussion_comment?.sourceRecordsDiscovered ?? 0) >= 1);
    assert.equal(byKind.discussion_comment?.publicRecords, 1);
    assert.ok((byKind.discussion_comment?.warmRequestCandidates ?? 0) >= 1);
    assert.ok(
      result.candidates.some(
        (c) => c.sourceKind === "discussion_comment" && c.sourceRecordId === approved.commentId,
      ),
    );
    assert.ok(
      !result.candidates.some(
        (c) => c.sourceKind === "discussion_comment" && c.sourceRecordId === removed.commentId,
      ),
    );

    assert.equal(byKind.collaborative_analysis?.sourceRecordsDiscovered, 1);
    assert.ok((byKind.collaborative_analysis?.warmRequestCandidates ?? 0) >= 1);

    assert.equal(byKind.petition?.sourceRecordsDiscovered, 2);
    assert.equal(byKind.petition?.publicRecords, 1);
    // Petition eligibility uses Mongo getPetition loader; public discovery must still be 1.
    assert.ok((byKind.petition?.publicRecords ?? 0) >= 1);

    assert.ok(result.totals.sourceRecordsDiscovered >= 5);
    assert.ok(result.totals.publicRecords >= 4);
    assert.ok(result.totals.warmRequestCandidates >= 3);
    assert.equal(result.discoveryHint, null);
  });

  it("excludes private initiatives and draft analyses", async () => {
    const result = await runWarm({
      execute: false,
      kinds: ["initiative", "collaborative_analysis", "discussion_comment"],
      deps: {
        listPetitions: async () => [],
      },
    });
    assert.ok(
      !result.candidates.some((c) => c.sourceRecordId === `${PREFIX}-init-private`),
    );
    assert.ok(
      !result.candidates.some((c) => c.sourceRecordId === `${PREFIX}-analysis-draft`),
    );
  });

  it("execute enqueue is idempotent/deduped on rerun", async () => {
    resetWarmMemory();
    const first = await runWarm({
      execute: true,
      kinds: ["initiative"],
      deps: { listPetitions: async () => [] },
    });
    assert.ok(first.totals.scheduled >= 1);
    const pendingAfterFirst = listWarmPending().length;

    const second = await runWarm({
      execute: true,
      kinds: ["initiative"],
      deps: { listPetitions: async () => [] },
    });
    assert.ok(second.totals.deduped >= 1);
    assert.equal(listWarmPending().length, pendingAfterFirst);
  });
});

describe("Pack 08I.14B.1 — contract regressions", () => {
  it("keeps staging guards and operator_backfill path", () => {
    const script = readApi("src/scripts/warm-staging-content-translations.ts");
    assert.match(script, /humanity_union_staging/);
    assert.match(script, /ALLOW_STAGING_CONTENT_TRANSLATION_WARM/);
    const moduleSource = readApi(
      "src/modules/language/content-translation-staging-warm-backfill.ts",
    );
    assert.match(moduleSource, /operator_backfill/);
    assert.match(moduleSource, /canExposePublicInitiativeProjection/);
  });
});
