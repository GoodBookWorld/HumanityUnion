/**
 * HU-LC-05C.4C.7E.2T — blog posts, Discussion comments and Collaborative
 * Analyses never leave their canonical public visibility: through Content
 * Translation resolve/warm/discovery and through the public analysis API.
 * Non-public records behave exactly like unknown ids.
 *
 * Blog posts live in a process-owned MongoMemoryReplSet (one hu_test_
 * database, dropped afterwards); everything else stays in memory.
 */
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.NOTIFICATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

import express from "express";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import type {
  BlogPost,
  Initiative,
  InitiativeCollaborativeAnalysis,
  InitiativeComment,
} from "@hu/types";

import type * as Language from "../../../src/modules/language/index.js";
import type * as Service from "../../../src/modules/language/content-translation.service.js";

const RUN = randomBytes(4).toString("hex");
const DATABASE = `hu_test_ct_pub_priv_${RUN}`;
const LOCALE = "xx-C7E2T";
const AUTHOR_ID = `member-7e2t-${RUN}`;
const secret = (name: string) => `SECRET-${name}-${RUN}`;

const BLOG_PRIVATE = ["DraftPost", "BlockedPost", "ScheduledPost"] as const;
const COMMENT_PRIVATE = ["HiddenInitiativeComment", "PendingComment", "DeletedComment"] as const;
const ANALYSIS_PRIVATE = ["HiddenParentAnalysis", "UnpublishedAnalysis"] as const;

const blogIds: Record<string, string> = {};
const commentIds: Record<string, string> = {};
const analysisIds: Record<string, string> = {};
const initiativeIds: Record<"Public" | "Hidden", string> = { Public: "", Hidden: "" };
const providerTexts: string[] = [];

let language: typeof Language;
let service: typeof Service;
let replSet: MongoMemoryReplSet | null = null;
let server: Server | null = null;
let baseUrl = "";
let connected = false;

function initiative(name: "Public" | "Hidden"): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-7e2t-${name.toLowerCase()}-${RUN}`,
    stewardId: AUTHOR_ID,
    createdAt: now,
    updatedAt: now,
    title: secret(`${name}Initiative`),
    description: "Fixture Initiative.",
    status: "proposal",
    lifecyclePhase: "projected",
    visibility: { policy: name === "Public" ? "public" : "private" },
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

function blogPost(name: string, overrides: Partial<BlogPost>): BlogPost {
  const now = new Date(Date.now() - 60_000).toISOString();
  return {
    postId: `blog-7e2t-${name.toLowerCase()}-${RUN}`,
    slug: `blog-7e2t-${name.toLowerCase()}-${RUN}`,
    title: secret(name),
    excerpt: `${secret(name)} excerpt`,
    content: `<p>${secret(name)} content</p>`,
    status: "published",
    originalLanguage: "en",
    authorParticipantId: AUTHOR_ID,
    authorDisplayNameSnapshot: "Author",
    categoryId: "governance",
    tags: [],
    publishedVersion: 1,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    coverMedia: null,
    editorialHistory: [],
    safetyOutcome: "accepted",
    review: { reviewStatus: "approved" },
    ...overrides,
  } as BlogPost;
}

function analysis(
  name: string,
  initiativeId: string,
  status: "published" | "draft",
): InitiativeCollaborativeAnalysis {
  const now = new Date().toISOString();
  return {
    analysisId: `analysis-7e2t-${name.toLowerCase()}-${RUN}`,
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

async function get(path: string): Promise<{ status: number; text: string; json: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  return { status: response.status, text, json: JSON.parse(text) as Record<string, unknown> };
}

const resolvePath = (kind: string, id: string) =>
  `/api/v1/translations/resolve/${kind}/${encodeURIComponent(id)}?language=${LOCALE}`;

function assertNoPrivateTextSentToProvider(): void {
  for (const text of providerTexts) {
    for (const name of [...BLOG_PRIVATE, ...COMMENT_PRIVATE, ...ANALYSIS_PRIVATE]) {
      assert.equal(text.includes(secret(name)), false, `${name} text reached the provider`);
    }
  }
}

async function assertLikeUnknown(
  kind: string,
  privateIds: Record<string, string>,
  names: readonly string[],
  unknownId: string,
): Promise<void> {
  const unknown = await get(resolvePath(kind, unknownId));
  assert.ok(unknown.status >= 400, unknown.text);
  for (const name of names) {
    const result = await get(resolvePath(kind, privateIds[name]!));
    assert.equal(result.status, unknown.status, `${name}: ${result.text}`);
    assert.deepEqual(result.json, unknown.json, `${name} differs from an unknown id`);
    assert.equal(result.text.includes("SECRET"), false, `${name} leaks source text`);
  }
}

describe("HU-LC-05C.4C.7E.2T — remaining public content privacy gates", () => {
  before(async () => {
    const isolation =
      await import("../../../src/infrastructure/mongodb/explicit-isolated-mongo-test.js");
    const connection = await import("../../../src/infrastructure/mongodb/mongo-connection.js");
    const database = await import("../../../src/infrastructure/mongodb/mongo-database.js");
    const indexes = await import("../../../src/infrastructure/mongodb/mongo-indexes.js");
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const uri = replSet.getUri(DATABASE);
    assert.match(new URL(uri.replace(/^mongodb:/, "http:")).hostname, /^(127\.0\.0\.1|localhost)$/);
    isolation.assertExplicitIsolatedMongoTestTarget({ uri, database: DATABASE });
    isolation.lockExplicitIsolatedMongoTestConfig({ uri, database: DATABASE });
    await connection.connectMongoClient();
    connected = true;
    assert.equal(database.getMongoDatabase().databaseName, DATABASE);
    await indexes.ensureMongoIndexes();

    language = await import("../../../src/modules/language/index.js");
    service = await import("../../../src/modules/language/content-translation.service.js");
    // Background reconciliation is out of scope here; its delayed timers would keep the process alive.
    (
      await import("../../../src/modules/language/localization-reconciliation-driver.js")
    ).setLocalizationReconciliationDriverDepsForTests({ listTargetLocales: async () => [] });
    language.resetTranslationProviderForTests();
    language.resetContentTranslationMemoryStoreForTests();
    language.resetContentTranslationWarmMemoryForTests();
    language.setContentTranslationWarmForceMemoryForTests(true);
    language.setLanguageRegistryForceMemoryForTests(true);
    language.setTerminologyGlossaryForceMemoryForTests(true);
    language.resetLanguageRegistryStoreForTests();
    language.resetTerminologyGlossaryStoreForTests();
    await language.ensureLanguageRegistrySeeded();
    await language.ensureTerminologyGlossarySeeded();
    await language.createLanguageRegistryRecord({
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

    // Records every provider request; output is a real (non-placeholder) localization.
    const deterministic = new language.DeterministicTranslationProvider();
    language.setTranslationProviderForTests({
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

    const initiatives = await import("../../../src/modules/initiatives/initiative.store.js");
    for (const name of ["Public", "Hidden"] as const) {
      initiativeIds[name] = initiatives.createInitiative(initiative(name)).initiativeId;
    }

    const blog = await import("../../../src/modules/blog/persistence/blog.repository.js");
    const future = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString();
    for (const [name, overrides] of [
      ["PublicPost", {}],
      ["DraftPost", { status: "draft", publishedAt: undefined }],
      ["BlockedPost", { administrativelyBlocked: true }],
      ["ScheduledPost", { publishedAt: future }],
    ] as const) {
      const post = blogPost(name, overrides as Partial<BlogPost>);
      await blog.insertBlogPost(post);
      blogIds[name] = post.postId;
    }

    const comments = await import(
      "../../../src/modules/initiative-comments/initiative-comment.memory.store.js"
    );
    const comment = (name: string, initiativeId: string): InitiativeComment =>
      comments.createInitiativeComment({
        initiativeId,
        authorUserId: `user-7e2t-${name.toLowerCase()}-${RUN}`,
        authorDisplayName: "Participant",
        body: `${secret(name)} body`,
      });
    commentIds.PublicComment = comment("PublicComment", initiativeIds.Public).commentId;
    commentIds.HiddenInitiativeComment = comment(
      "HiddenInitiativeComment",
      initiativeIds.Hidden,
    ).commentId;
    const pending = comment("PendingComment", initiativeIds.Public);
    (pending as { status: InitiativeComment["status"] }).status = "pending";
    commentIds.PendingComment = pending.commentId;
    const deleted = comment("DeletedComment", initiativeIds.Public);
    comments.deleteInitiativeComment({
      commentId: deleted.commentId,
      authorUserId: deleted.authorUserId,
    });
    commentIds.DeletedComment = deleted.commentId;

    const analyses = await import(
      "../../../src/modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js"
    );
    for (const [name, parent, status] of [
      ["PublishedAnalysis", "Public", "published"],
      ["HiddenParentAnalysis", "Hidden", "published"],
      ["UnpublishedAnalysis", "Public", "draft"],
    ] as const) {
      analysisIds[name] = analyses.createAnalysis(
        analysis(name, initiativeIds[parent], status),
      ).analysisId;
    }

    const app = express();
    app.use(express.json());
    app.use(
      "/api/v1/translations",
      (await import("../../../src/modules/language/language.routes.js")).default,
    );
    app.use(
      "/api/v1/public/initiative-analyses",
      (
        await import(
          "../../../src/modules/initiative-collaborative-analysis/public-initiative-collaborative-analysis.routes.js"
        )
      ).default,
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    // A warm completion wakes a reconciliation pass; let it settle, then clear its continuation timer.
    const driver = await import("../../../src/modules/language/localization-reconciliation-driver.js");
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const state = driver.peekLocalizationReconciliationDriverStateForTests();
      if (state.inFlight.length === 0 && state.pendingWake.length === 0) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    driver.resetLocalizationReconciliationDriverForTests();
    if (language) {
      language.resetTranslationProviderForTests();
      language.resetContentTranslationMemoryStoreForTests();
      language.resetContentTranslationWarmMemoryForTests();
      language.setContentTranslationWarmForceMemoryForTests(false);
      language.resetTerminologyGlossaryStoreForTests();
      language.resetLanguageRegistryStoreForTests();
      language.setTerminologyGlossaryForceMemoryForTests(false);
      language.setLanguageRegistryForceMemoryForTests(false);
    }
    const connection = await import("../../../src/infrastructure/mongodb/mongo-connection.js");
    const database = await import("../../../src/infrastructure/mongodb/mongo-database.js");
    try {
      if (connected && database.getMongoDatabase().databaseName === DATABASE) {
        await database.getMongoDatabase().dropDatabase();
      }
    } finally {
      if (connected) {
        await connection.disconnectMongoClient();
      }
      await replSet?.stop({ doCleanup: true });
    }
  });

  it("blog resolve: draft, blocked and scheduled posts look exactly like unknown ids", async () => {
    await assertLikeUnknown("blog_post", blogIds, BLOG_PRIVATE, `blog-7e2t-unknown-${RUN}`);
    const open = await get(resolvePath("blog_post", blogIds.PublicPost!));
    assert.equal(open.status, 200, open.text);
    assert.equal(
      (open.json.data as { content: Record<string, string> }).content.title,
      secret("PublicPost"),
    );
  });

  it("comment resolve: hidden-Initiative, pending and deleted comments look like unknown ids", async () => {
    await assertLikeUnknown(
      "discussion_comment",
      commentIds,
      COMMENT_PRIVATE,
      `comment-7e2t-unknown-${RUN}`,
    );
    const open = await get(resolvePath("discussion_comment", commentIds.PublicComment!));
    assert.equal(open.status, 200, open.text);
    assert.equal(
      (open.json.data as { content: Record<string, string> }).content.body,
      `${secret("PublicComment")} body`,
    );
  });

  it("public analysis API hides unpublished and hidden-parent analyses like unknown ids", async () => {
    const unknown = await get(`/api/v1/public/initiative-analyses/analysis-7e2t-unknown-${RUN}`);
    assert.equal(unknown.status, 404, unknown.text);
    for (const name of ANALYSIS_PRIVATE) {
      const result = await get(`/api/v1/public/initiative-analyses/${analysisIds[name]}`);
      assert.equal(result.status, 404, `${name}: ${result.text}`);
      assert.deepEqual(result.json, unknown.json, `${name} differs from an unknown id`);
      assert.equal(result.text.includes("SECRET"), false, `${name} leaks analysis text`);
      assert.doesNotMatch(result.text, /private|hidden|draft/i, `${name} leaks state`);
    }
    const open = await get(`/api/v1/public/initiative-analyses/${analysisIds.PublishedAnalysis}`);
    assert.equal(open.status, 200, open.text);
    assert.equal((open.json.data as { title: string }).title, secret("PublishedAnalysis"));
  });

  it("warm and on-demand generation never send private posts or comments to the provider", async () => {
    for (const [kind, ids, names] of [
      ["blog_post", blogIds, BLOG_PRIVATE],
      ["discussion_comment", commentIds, COMMENT_PRIVATE],
    ] as const) {
      for (const name of names) {
        const id = ids[name]!;
        await language
          .processContentTranslationWarmRequested({
            commandName: "ContentTranslationWarmRequested",
            sourceKind: kind,
            sourceRecordId: id,
            requestedAt: new Date().toISOString(),
            reason: "public_mutation",
          })
          .then(
            (result) => assert.equal(result.outcome, "skipped_ineligible", name),
            (error: Error) => assert.match(error.message, /source unavailable/i, name),
          );
        await assert.rejects(
          language.getOrCreateContentTranslation({
            sourceKind: kind,
            sourceRecordId: id,
            targetLanguage: LOCALE,
            generateIfMissing: true,
            intent: "on_demand",
          }),
          name,
        );
        const repository = await import(
          "../../../src/modules/language/persistence/content-translation.repository.js"
        );
        assert.deepEqual(
          await repository.listContentTranslationsForSource({ sourceKind: kind, sourceRecordId: id }),
          [],
          `${name} produced translation rows`,
        );
      }
    }
    assertNoPrivateTextSentToProvider();
  });

  it("public posts and comments still warm, translate and display", async () => {
    for (const [kind, id, name] of [
      ["blog_post", blogIds.PublicPost!, "PublicPost"],
      ["discussion_comment", commentIds.PublicComment!, "PublicComment"],
    ] as const) {
      const before = providerTexts.length;
      const result = await language.processContentTranslationWarmRequested({
        commandName: "ContentTranslationWarmRequested",
        sourceKind: kind,
        sourceRecordId: id,
        requestedAt: new Date().toISOString(),
        reason: "public_mutation",
      });
      assert.equal(result.outcome, "completed", `${name}: ${JSON.stringify(result)}`);
      assert.ok(providerTexts.slice(before).some((text) => text.includes(secret(name))), name);
      const resolved = await get(resolvePath(kind, id));
      assert.equal(resolved.status, 200, resolved.text);
      assert.notEqual(
        (resolved.json.data as { presentationMode: string }).presentationMode,
        "original",
        `${name} should present its translation`,
      );
    }
    assertNoPrivateTextSentToProvider();
  });

  it("backfill and search discovery select only public posts and comments", async () => {
    const backfill = await import(
      "../../../src/modules/language/content-translation-staging-warm-backfill.js"
    );
    const discovered = (
      await backfill.discoverStagingInitiativePathWarmSources({
        kinds: ["blog_post", "discussion_comment"],
      })
    ).candidates.filter((candidate) => candidate.sourceRecordId.includes(RUN) || Object.values(commentIds).includes(candidate.sourceRecordId));
    assert.deepEqual(
      discovered.filter((c) => c.sourceKind === "blog_post").map((c) => c.sourceRecordId),
      [blogIds.PublicPost],
    );
    assert.deepEqual(
      discovered.filter((c) => c.sourceKind === "discussion_comment").map((c) => c.sourceRecordId),
      [commentIds.PublicComment],
    );
    const searched = (await language.listSearchDiscoveryWarmTargets())
      .filter((target) => target.sourceKind === "blog_post" && target.sourceRecordId.includes(RUN))
      .map((target) => target.sourceRecordId);
    assert.deepEqual(searched, [blogIds.PublicPost]);
  });

  it("keeps author access and canonical records unchanged", async () => {
    const blog = await import("../../../src/modules/blog/persistence/blog.repository.js");
    const analyses = await import(
      "../../../src/modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js"
    );
    const snapshot = async () =>
      JSON.stringify([
        ...(await Promise.all(Object.values(blogIds).map((id) => blog.findBlogPostById(id)))),
        ...Object.values(analysisIds).map((id) =>
          analyses.listMyInitiativeCollaborativeAnalyses({ participantId: AUTHOR_ID } as never).find(
            (row) => row.analysisId === id,
          ),
        ),
      ]);
    const before = await snapshot();

    const mine = analyses
      .listMyInitiativeCollaborativeAnalyses({ participantId: AUTHOR_ID } as never)
      .map((row) => row.analysisId);
    for (const name of ANALYSIS_PRIVATE) {
      assert.ok(mine.includes(analysisIds[name]!), `author still sees ${name}`);
    }
    for (const name of BLOG_PRIVATE) {
      const source = await service.loadTranslatableSource({
        sourceKind: "blog_post",
        sourceRecordId: blogIds[name]!,
      });
      assert.equal(source?.authorParticipantId, AUTHOR_ID, `${name} author check`);
      assert.equal(source?.isPublished, false, name);
    }
    const hiddenComment = await service.loadTranslatableSource({
      sourceKind: "discussion_comment",
      sourceRecordId: commentIds.HiddenInitiativeComment!,
    });
    assert.equal(hiddenComment?.isPublished, false);

    for (const name of [...BLOG_PRIVATE]) await get(resolvePath("blog_post", blogIds[name]!));
    for (const name of [...COMMENT_PRIVATE]) {
      await get(resolvePath("discussion_comment", commentIds[name]!));
    }
    for (const name of ANALYSIS_PRIVATE) {
      await get(`/api/v1/public/initiative-analyses/${analysisIds[name]}`);
    }
    assert.equal(await snapshot(), before);
  });
});
