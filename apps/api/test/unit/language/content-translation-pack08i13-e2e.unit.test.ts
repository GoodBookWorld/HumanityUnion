/**
 * Pack 08I.13 — end-to-end content translation identity boundary.
 *
 * Proves canonical source → eligibility → provider → content_translations
 * persistence → lookup → public presentation for Initiative, Blog, Media, Discussion.
 * Does not mock away persistence/lookup sourceKind+sourceVersion identity.
 */
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";
process.env.MEDIA_RESOURCE_PERSISTENCE = "memory";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { BlogPost, Initiative } from "@hu/types";

import { isMongoAvailableForTests } from "../../helpers/test-env.js";
import {
  CONTENT_TRANSLATION_FIELD_ALLOWLIST,
  PUBLIC_CONTENT_TRANSLATION_SOURCE_KINDS,
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  isPrivacyExcludedTranslationSurface,
  isPublicContentTranslationSourceKind,
  isSupportedContentTranslationSourceKind,
  loadTranslatableSource,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  resolvePublicTranslatedContent,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  DeterministicTranslationProvider,
} from "../../../src/modules/language/index.js";
import {
  createInitiative,
  deleteInitiative,
  updateInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import {
  createInitiativeComment as createMemoryComment,
  deleteInitiativeComment,
  resetInitiativeCommentStoreForTests,
  resetInitiativeCommentRateLimitsMemoryForTests,
} from "../../../src/modules/initiative-comments/initiative-comment.memory.store.js";
import { replaceBlogPost, findBlogPostById } from "../../../src/modules/blog/persistence/blog.repository.js";
import { setMediaResourceForceMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.repository.js";

const TARGET = "g2-i13-a" as const;
const TARGET_PREFIX = new RegExp(`\\[${TARGET}\\]`, "i");

function sampleInitiative(): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack08i13-${Date.now()}`,
    stewardId: "member-pack08i13",
    createdAt: now,
    updatedAt: now,
    title: "Clean River Initiative",
    description: "Participants will restore a local river with evidence-based steps.",
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

function sampleBlogPost(postId: string): BlogPost {
  const now = new Date().toISOString();
  return {
    postId,
    slug: `pack08i13-${postId.slice(-8)}`,
    title: "Leader Principles",
    excerpt: "A short excerpt about civic leadership.",
    content: "<p>Leaders listen before they decide.</p>",
    status: "published",
    originalLanguage: "en",
    authorParticipantId: "author-pack08i13",
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
    review: {
      reviewStatus: "approved",
    },
  };
}

describe("Pack 08I.13 — content translation E2E identity boundary", () => {
  const provider = new DeterministicTranslationProvider();
  let initiative: Initiative;

  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetTranslationProviderForTests();
    setTranslationProviderForTests(provider);
    provider.clearLastRequestForTests();
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await createLanguageRegistryRecord({
      locale: TARGET,
      englishName: "I13 Target",
      nativeName: "I13 Target",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
      uiTranslationStatus: "complete",
      searchEnabled: true,
      seoIndexingEnabled: true,
    });
    setMediaResourceForceMemoryForTests(true);
    resetInitiativeCommentStoreForTests();
    resetInitiativeCommentRateLimitsMemoryForTests();
    initiative = sampleInitiative();
    createInitiative(initiative);
  });

  afterEach(() => {
    deleteInitiative(initiative.initiativeId);
    resetContentTranslationMemoryStoreForTests();
    resetTranslationProviderForTests();
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
    setMediaResourceForceMemoryForTests(false);
    resetInitiativeCommentStoreForTests();
  });

  it("discussion_comment is public-eligible (body only), not privacy-excluded", () => {
    assert.equal(isSupportedContentTranslationSourceKind("discussion_comment"), true);
    assert.equal(isPublicContentTranslationSourceKind("discussion_comment"), true);
    assert.equal(isPrivacyExcludedTranslationSurface("discussion_comment"), false);
    assert.deepEqual([...CONTENT_TRANSLATION_FIELD_ALLOWLIST.discussion_comment], ["body"]);
    assert.ok(
      (PUBLIC_CONTENT_TRANSLATION_SOURCE_KINDS as readonly string[]).includes("discussion_comment"),
    );
  });

  it("Initiative: miss → generate → persist → lookup → presentation; current skips regenerate", async () => {
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    assert.equal(source.sourceKind, "initiative");
    assert.deepEqual(Object.keys(source.fields).sort(), ["description", "title"]);

    const miss = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: TARGET,
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(miss.presentationMode, "original");

    const generated = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: TARGET,
      generateIfMissing: true,
    });
    assert.equal(generated.generated, true);
    assert.ok(generated.translation);
    assert.equal(generated.translation.sourceKind, "initiative");
    assert.equal(generated.translation.sourceVersion, source.sourceVersion);
    assert.equal(generated.translation.targetLanguage, TARGET);
    assert.ok(provider.getLastRequestForTests());

    const displayed = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: TARGET,
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(displayed.presentationMode, "preferred_translation");
    assert.match(String(displayed.content.title ?? ""), TARGET_PREFIX);
    assert.match(String(displayed.content.description ?? ""), TARGET_PREFIX);

    provider.clearLastRequestForTests();
    const reused = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: TARGET,
      generateIfMissing: true,
    });
    assert.equal(reused.generated, false);
    assert.equal(provider.getLastRequestForTests(), null);
  });

  it("Initiative stale translation is not presented as current", async () => {
    await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: TARGET,
      generateIfMissing: true,
    });

    initiative = updateInitiative(initiative.initiativeId, {
      title: "Updated Clean River Initiative",
      updatedAt: new Date().toISOString(),
    })!;

    const afterChange = await resolvePublicTranslatedContent({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      preferredReadingLanguage: TARGET,
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(afterChange.presentationMode, "original");
    assert.equal(afterChange.isStale, true);

    const regenerated = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: TARGET,
      generateIfMissing: true,
    });
    assert.equal(regenerated.generated, true);
  });

  it("Blog post: persistence/lookup identity preserves title+content fields", async (t) => {
    if (!isMongoAvailableForTests()) {
      t.skip("Mongo required for blog_post canonical load");
      return;
    }

    const postId = `blog-pack08i13-${Date.now()}`;
    let loaded;
    try {
      await replaceBlogPost(sampleBlogPost(postId));
      loaded = await findBlogPostById(postId);
    } catch {
      t.skip("Mongo unreachable for blog_post canonical load");
      return;
    }
    assert.ok(loaded);

    const source = await loadTranslatableSource({
      sourceKind: "blog_post",
      sourceRecordId: postId,
    });
    assert.ok(source);
    assert.equal(source.sourceKind, "blog_post");
    assert.ok(source.fields.title);
    assert.ok(source.fields.content);

    const first = await getOrCreateContentTranslation({
      sourceKind: "blog_post",
      sourceRecordId: postId,
      targetLanguage: TARGET,
      generateIfMissing: true,
    });
    assert.equal(first.generated, true);
    assert.equal(first.translation?.sourceVersion, source.sourceVersion);

    const display = await resolvePublicTranslatedContent({
      sourceKind: "blog_post",
      sourceRecordId: postId,
      preferredReadingLanguage: TARGET,
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(display.presentationMode, "preferred_translation");
    assert.match(String(display.content.title ?? ""), TARGET_PREFIX);
    assert.match(String(display.content.content ?? ""), TARGET_PREFIX);

    const second = await getOrCreateContentTranslation({
      sourceKind: "blog_post",
      sourceRecordId: postId,
      targetLanguage: TARGET,
      generateIfMissing: true,
    });
    assert.equal(second.generated, false);
  });

  it("civic_media: same sourceKind identity for generate and lookup", async () => {
    const source = await loadTranslatableSource({
      sourceKind: "civic_media",
      sourceRecordId: "civic-media-center",
    });
    assert.ok(source);
    assert.equal(source.sourceKind, "civic_media");
    assert.equal(source.sourceRecordId, "civic-media-center");

    const generated = await getOrCreateContentTranslation({
      sourceKind: "civic_media",
      sourceRecordId: "civic-media-center",
      targetLanguage: TARGET,
      generateIfMissing: true,
    });
    assert.equal(generated.generated, true);
    assert.equal(generated.translation?.sourceKind, "civic_media");
    assert.equal(generated.translation?.sourceRecordId, "civic-media-center");
    assert.equal(generated.translation?.sourceVersion, source.sourceVersion);

    const display = await resolvePublicTranslatedContent({
      sourceKind: "civic_media",
      sourceRecordId: "civic-media-center",
      preferredReadingLanguage: TARGET,
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(display.presentationMode, "preferred_translation");
    assert.ok(Object.keys(display.content).length > 0);
  });

  it("discussion_comment: approved body only; removed comments ineligible", async () => {
    const comment = createMemoryComment({
      initiativeId: initiative.initiativeId,
      authorUserId: "user-pack08i13",
      authorDisplayName: "Participant",
      body: "This river cleanup needs clearer evidence.",
    });

    const source = await loadTranslatableSource({
      sourceKind: "discussion_comment",
      sourceRecordId: comment.commentId,
    });
    assert.ok(source);
    assert.equal(source.sourceKind, "discussion_comment");
    assert.deepEqual(Object.keys(source.fields), ["body"]);
    assert.equal(source.fields.body, comment.body);

    const generated = await getOrCreateContentTranslation({
      sourceKind: "discussion_comment",
      sourceRecordId: comment.commentId,
      targetLanguage: TARGET,
      generateIfMissing: true,
    });
    assert.equal(generated.generated, true);
    assert.equal(generated.translation?.sourceKind, "discussion_comment");
    assert.equal(generated.translation?.sourceVersion, source.sourceVersion);

    const display = await resolvePublicTranslatedContent({
      sourceKind: "discussion_comment",
      sourceRecordId: comment.commentId,
      preferredReadingLanguage: TARGET,
      translationPreference: "preferred",
      generateIfMissing: false,
    });
    assert.equal(display.presentationMode, "preferred_translation");
    assert.match(String(display.content.body ?? ""), TARGET_PREFIX);
    assert.equal(display.originalContent.body, comment.body);

    const removed = createMemoryComment({
      initiativeId: initiative.initiativeId,
      authorUserId: "user-pack08i13-b",
      authorDisplayName: "Participant",
      body: "Hidden comment should not translate.",
    });
    deleteInitiativeComment({ commentId: removed.commentId, authorUserId: "user-pack08i13-b" });

    const ineligible = await loadTranslatableSource({
      sourceKind: "discussion_comment",
      sourceRecordId: removed.commentId,
    });
    assert.equal(ineligible, null);
  });
});
