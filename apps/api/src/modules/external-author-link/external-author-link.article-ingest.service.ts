import { BlockList, isIP } from "node:net";

import {
  parseExternalVideoUrl,
  type BlogExternalCover,
  type BlogExternalVideo,
  type BlogPost,
  type BlogPostStatus,
  type LifecycleSafetyOutcome,
} from "@hu/types";

import { isBlogAuthorAdministrativelyBlocked } from "../blog/admin-publishing.service.js";
import { blogHtmlToPlainText } from "../blog/blog-content-sanitize.js";
import { createBlogDraft, submitBlogPostForReview } from "../blog/blog.service.js";
import { ensureBlogCategoriesSeeded, isActiveBlogCategoryId } from "../blog/blog-categories.js";
import {
  BlogAccessDeniedError,
  BlogSafetyNeedsReviewError,
  BlogSafetyRejectedError,
  BlogValidationError,
} from "../blog/blog.errors.js";
import { resolvePublishWithoutManualReview } from "../blog/blog-permissions.js";
import { validateCreateBlogDraftInput } from "../blog/blog.validators.js";
import { invalidateGlobalSearchIndex } from "../global-search/global-search.index.js";
import { evaluateLifecycleSafety } from "../lifecycle-safety/lifecycle-safety.service.js";
import { notifyPublicPresentationChanged } from "../language/public-presentation-changed.js";
import {
  findBlogPostById,
  updateBlogPostExternalCover,
  updateBlogPostExternalVideo,
  updateSyndicatedBlogArticleContent,
} from "../blog/persistence/blog.repository.js";
import { integrityMediaLinkSignaturesEqual, signIntegrityMediaLinkRedeem } from "./external-author-link.hmac.js";
import {
  articleCoverDigest,
  articlePayloadDigest,
  buildArticleIngestPayload,
  hasArticleIngestSignature,
  noteArticleIngestSignature,
} from "./external-author-link.article-ingest.hmac.js";
import {
  ArticleDeliveryDuplicateError,
  compareAndSetArticleContent,
  compareAndSetArticleCover,
  findArticleDelivery,
  insertArticleDelivery,
  releaseArticleDeliveryWithoutPost,
  updateArticleDeliveryPhase,
  type ArticleDeliveryExternalVideo,
  type ArticleDeliveryRecord,
} from "./external-author-link.article-ingest.repository.js";
import { isOrdinaryIntegrityMediaCollaborationAllowed } from "./external-author-link.collaboration.js";
import { integrityMediaEnvironmentTargetAccepted } from "./external-author-link.environment-target.js";
import {
  INTEGRITY_MEDIA_ARTICLE_CATEGORY_ID_ENV,
  INTEGRITY_MEDIA_ARTICLE_INGEST_HMAC_SECRET_ENV,
  INTEGRITY_MEDIA_AUTHOR_ID_PATTERN,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
  INTEGRITY_MEDIA_SOURCE,
} from "./external-author-link.constants.js";
import { getExternalAuthorLinkStore } from "./external-author-link.store.js";

const ARTICLE_FIELDS = new Set([
  "publicationId",
  "authorId",
  "huMemberId",
  "title",
  "excerpt",
  "content",
  "language",
  "publishedAt",
  "canonicalUrl",
  "target",
]);

const OPTIONAL_ARTICLE_FIELDS = new Set([
  "coverImageUrl",
  "externalVideoUrl",
  "operation",
  "contentRevision",
]);

const blockedCoverDestinations = new BlockList();
blockedCoverDestinations.addSubnet("0.0.0.0", 8, "ipv4");
blockedCoverDestinations.addSubnet("10.0.0.0", 8, "ipv4");
blockedCoverDestinations.addSubnet("127.0.0.0", 8, "ipv4");
blockedCoverDestinations.addSubnet("169.254.0.0", 16, "ipv4");
blockedCoverDestinations.addSubnet("172.16.0.0", 12, "ipv4");
blockedCoverDestinations.addSubnet("192.168.0.0", 16, "ipv4");
blockedCoverDestinations.addAddress("::", "ipv6");
blockedCoverDestinations.addAddress("::1", "ipv6");
blockedCoverDestinations.addSubnet("fc00::", 7, "ipv6");
blockedCoverDestinations.addSubnet("fe80::", 10, "ipv6");

const PUBLICATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const COMPLETE_STATUSES = new Set<BlogPostStatus>(["published", "scheduled", "submitted_for_review"]);

export interface ArticleIngestResult {
  source: typeof INTEGRITY_MEDIA_SOURCE;
  publicationId: string;
  postId: string;
  status: BlogPostStatus;
  idempotent: boolean;
}

export class ArticleIngestError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly delivery: { postId: string; status: BlogPostStatus } | null;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    delivery: { postId: string; status: BlogPostStatus } | null = null,
  ) {
    super(message);
    this.name = "ArticleIngestError";
    this.statusCode = statusCode;
    this.code = code;
    this.delivery = delivery;
  }
}

interface NormalizedArticle {
  publicationId: string;
  authorId: string;
  huMemberId: string;
  title: string;
  excerpt: string;
  content: string;
  language: string;
  publishedAt: string;
  canonicalUrl: string;
  target: string;
  coverImageUrl?: string;
  /** Omitted: leave the stored video unchanged. Null: explicit removal. */
  externalVideo?: ArticleDeliveryExternalVideo | null;
  operation?: "update";
  contentRevision?: number;
}

let afterClaimForTests: (() => Promise<void> | void) | null = null;
let afterCoverAcceptForTests: (() => Promise<void> | void) | null = null;
let afterContentAcceptForTests: (() => Promise<void> | void) | null = null;
const deliveryLocks = new Map<string, Promise<unknown>>();

export function setArticleIngestAfterClaimForTests(
  hook: (() => Promise<void> | void) | null,
): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Article ingest test hooks are available only when NODE_TEST_ENV=true.");
  }
  afterClaimForTests = hook;
}

export function setArticleIngestAfterCoverAcceptForTests(
  hook: (() => Promise<void> | void) | null,
): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Article ingest test hooks are available only when NODE_TEST_ENV=true.");
  }
  afterCoverAcceptForTests = hook;
}

export function setArticleIngestAfterContentAcceptForTests(
  hook: (() => Promise<void> | void) | null,
): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Article ingest test hooks are available only when NODE_TEST_ENV=true.");
  }
  afterContentAcceptForTests = hook;
}

export function resetArticleIngestLocksForTests(): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Article ingest test hooks are available only when NODE_TEST_ENV=true.");
  }
  deliveryLocks.clear();
  afterClaimForTests = null;
  afterCoverAcceptForTests = null;
  afterContentAcceptForTests = null;
}

export async function ingestIntegrityMediaArticle(input: {
  body: unknown;
  timestamp: string;
  signature: string;
  now?: Date;
}): Promise<ArticleIngestResult> {
  const now = input.now ?? new Date();
  const article = normalizeArticle(input.body);
  const secret = process.env[INTEGRITY_MEDIA_ARTICLE_INGEST_HMAC_SECRET_ENV]?.trim() || "";
  if (!secret) {
    throw new ArticleIngestError(
      503,
      "article_ingest_not_configured",
      "Integrity Media article ingestion is not configured.",
    );
  }

  verifySignature({
    article,
    timestamp: input.timestamp,
    signature: input.signature,
    secret,
    now,
  });

  if (!integrityMediaEnvironmentTargetAccepted(article.target)) {
    throw new ArticleIngestError(
      403,
      "target_mismatch",
      "This article delivery is for a different Humanity Union environment.",
    );
  }

  const link = await getExternalAuthorLinkStore().findLinkByAuthor(
    INTEGRITY_MEDIA_SOURCE,
    article.authorId,
  );
  if (!link) {
    throw new ArticleIngestError(
      404,
      "author_not_linked",
      "This Integrity Media author is not linked.",
    );
  }
  if (link.memberId !== article.huMemberId) {
    throw new ArticleIngestError(
      409,
      "author_member_mismatch",
      "The Integrity Media author and Humanity Union member do not match.",
    );
  }
  if (!isOrdinaryIntegrityMediaCollaborationAllowed(link)) {
    throw new ArticleIngestError(
      409,
      "link_not_active",
      "This Integrity Media link is not an active confirmed collaboration.",
    );
  }

  const categoryId = await resolveConfiguredCategoryId();
  let validated: ReturnType<typeof validateCreateBlogDraftInput>;
  try {
    validated = validateCreateBlogDraftInput({
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
      categoryId,
      originalLanguage: article.language,
      publicationDate: article.publishedAt,
      tags: [],
    });
  } catch (error) {
    if (error instanceof BlogValidationError) {
      throw new ArticleIngestError(400, "invalid_article", error.message);
    }
    throw error;
  }

  const digest = articlePayloadDigest({
    publicationId: article.publicationId,
    authorId: article.authorId,
    huMemberId: article.huMemberId,
    target: article.target,
    language: validated.originalLanguage,
    publishedAt: article.publishedAt,
    canonicalUrl: article.canonicalUrl,
    categoryId,
    title: validated.title,
    excerpt: validated.excerpt,
    content: article.content,
    ...(article.externalVideo !== undefined ? { externalVideo: article.externalVideo } : {}),
  });

  return serializeDelivery(article.publicationId, () =>
    deliverClaimedArticle({
      article,
      categoryId,
      validated,
      digest,
      now,
      signedTimestamp: input.timestamp,
    }),
  );
}

interface DeliveryWork {
  article: NormalizedArticle;
  categoryId: string;
  validated: ReturnType<typeof validateCreateBlogDraftInput>;
  digest: string;
  now: Date;
  signedTimestamp: string;
}

async function deliverClaimedArticle(input: DeliveryWork): Promise<ArticleIngestResult> {
  const existing = await findArticleDelivery(input.article.publicationId);
  if (input.article.operation === "update") {
    if (!existing) {
      throw new ArticleIngestError(
        404,
        "publication_not_found",
        "This publication has not been delivered.",
      );
    }
    return applyArticleUpdate(existing, input);
  }
  if (existing) {
    return continueExistingDelivery(existing, input);
  }

  const createdAt = input.now.toISOString();
  const coverUrl = input.article.coverImageUrl ?? null;
  try {
    await insertArticleDelivery({
      source: INTEGRITY_MEDIA_SOURCE,
      publicationId: input.article.publicationId,
      authorId: input.article.authorId,
      payloadDigest: input.digest,
      contentRevision: 0,
      coverUrl,
      coverDigest: articleCoverDigest(coverUrl ?? ""),
      coverTimestamp: coverUrl ? input.signedTimestamp : "",
      ...(input.article.externalVideo !== undefined
        ? { externalVideo: input.article.externalVideo }
        : {}),
      postId: null,
      status: null,
      phase: "creating",
      createdAt,
      updatedAt: createdAt,
    });
  } catch (error) {
    if (error instanceof ArticleDeliveryDuplicateError) {
      const raced = await findArticleDelivery(input.article.publicationId);
      if (!raced) {
        throw new ArticleIngestError(503, "unavailable", "Article delivery could not be claimed.");
      }
      return continueExistingDelivery(raced, input);
    }
    throw error;
  }

  try {
    if (afterClaimForTests) {
      await afterClaimForTests();
    }
  } catch (error) {
    await releaseArticleDeliveryWithoutPost(input.article.publicationId);
    throw error;
  }

  return createAndSubmit(input);
}

async function continueExistingDelivery(
  existing: ArticleDeliveryRecord,
  input: DeliveryWork,
): Promise<ArticleIngestResult> {
  if (existing.payloadDigest !== input.digest) {
    if ((existing.contentRevision ?? 0) > 0 && existing.postId) {
      const post = await findBlogPostById(existing.postId);
      return {
        source: INTEGRITY_MEDIA_SOURCE,
        publicationId: existing.publicationId,
        postId: existing.postId,
        status: post?.status ?? existing.status ?? "draft",
        idempotent: true,
      };
    }
    throw new ArticleIngestError(
      409,
      "publication_conflict",
      "This publication was already delivered with different content.",
    );
  }
  if (existing.phase === "complete" && existing.postId && existing.status) {
    await reconcileCover(existing.postId, input);
    await reconcileStoredExternalVideo(existing.postId, existing);
    const post = await findBlogPostById(existing.postId);
    return {
      source: INTEGRITY_MEDIA_SOURCE,
      publicationId: existing.publicationId,
      postId: existing.postId,
      status: post?.status ?? existing.status,
      idempotent: true,
    };
  }
  if (existing.postId) {
    if (input.article.coverImageUrl) {
      await reconcileCover(existing.postId, input);
    }
    return createAndSubmit(input, existing);
  }
  throw new ArticleIngestError(
    409,
    "delivery_in_progress",
    "This publication delivery is already in progress.",
  );
}

async function applyArticleUpdate(
  existing: ArticleDeliveryRecord,
  input: DeliveryWork,
): Promise<ArticleIngestResult> {
  if (!existing.postId) {
    throw new ArticleIngestError(
      409,
      "delivery_in_progress",
      "This publication delivery is already in progress.",
    );
  }
  if (existing.authorId && existing.authorId !== input.article.authorId) {
    throw new ArticleIngestError(
      409,
      "author_mismatch",
      "Only the linked author of this publication can update it.",
    );
  }

  const post = await findBlogPostById(existing.postId);
  if (!post) {
    throw new ArticleIngestError(503, "unavailable", "Article delivery could not be reconciled.");
  }
  if (post.authorParticipantId !== input.article.huMemberId) {
    throw new ArticleIngestError(
      409,
      "author_mismatch",
      "Only the linked author of this publication can update it.",
    );
  }

  const revision = input.article.contentRevision;
  if (revision === undefined) {
    throw new ArticleIngestError(400, "invalid_article", "contentRevision is not valid.");
  }
  const storedRevision = existing.contentRevision ?? 0;
  if (revision === storedRevision && existing.payloadDigest === input.digest) {
    return repairAcceptedArticleUpdate(post, existing, input);
  }
  if (revision < storedRevision) {
    const current = (await findBlogPostById(post.postId)) ?? post;
    return currentArticleResult(existing, current, true);
  }
  if (revision === storedRevision) {
    throw new ArticleIngestError(
      409,
      "publication_conflict",
      "This publication revision was already delivered with different content.",
      { postId: post.postId, status: post.status },
    );
  }

  await assertSyndicatedUpdateAllowed(post, input);
  const decision = await compareAndSetArticleContent({
    publicationId: input.article.publicationId,
    contentRevision: revision,
    payloadDigest: input.digest,
    authorId: input.article.authorId,
    ...(input.article.coverImageUrl
      ? {
          cover: {
            coverUrl: input.article.coverImageUrl,
            coverDigest: articleCoverDigest(input.article.coverImageUrl),
            coverTimestamp: input.signedTimestamp,
          },
        }
      : {}),
    ...(input.article.externalVideo !== undefined
      ? { externalVideo: input.article.externalVideo }
      : {}),
  });
  if (decision.decision === "stale") {
    const current = (await findBlogPostById(post.postId)) ?? post;
    return currentArticleResult(decision.record, current, true);
  }
  if (decision.decision === "conflict") {
    throw new ArticleIngestError(
      409,
      "publication_conflict",
      "This publication revision was already delivered with different content.",
      { postId: post.postId, status: post.status },
    );
  }
  if (decision.decision === "idempotent") {
    return repairAcceptedArticleUpdate(post, decision.record, input);
  }

  if (afterContentAcceptForTests) {
    const hook = afterContentAcceptForTests;
    afterContentAcceptForTests = null;
    await hook();
  }
  const updated = await writeSyndicatedArticle(post, input);
  return currentArticleResult(decision.record, updated, false);
}

async function repairAcceptedArticleUpdate(
  post: BlogPost,
  delivery: ArticleDeliveryRecord,
  input: DeliveryWork,
): Promise<ArticleIngestResult> {
  if (
    post.administrativelyBlocked === true ||
    (await isBlogAuthorAdministrativelyBlocked(input.article.huMemberId))
  ) {
    if (syndicatedArticleMatches(post, input)) {
      return currentArticleResult(delivery, post, true);
    }
    throw new ArticleIngestError(
      403,
      "author_blocked",
      "This publication is blocked by an administrator and cannot be edited or republished.",
      { postId: post.postId, status: post.status },
    );
  }
  if (syndicatedArticleMatches(post, input)) {
    return currentArticleResult(delivery, post, true);
  }
  const updated = await writeSyndicatedArticle(post, input);
  return currentArticleResult(delivery, updated, true);
}

async function assertSyndicatedUpdateAllowed(post: BlogPost, input: DeliveryWork): Promise<void> {
  if (
    post.administrativelyBlocked === true ||
    (await isBlogAuthorAdministrativelyBlocked(input.article.huMemberId))
  ) {
    throw new ArticleIngestError(
      403,
      "author_blocked",
      "This publication is blocked by an administrator and cannot be edited or republished.",
      { postId: post.postId, status: post.status },
    );
  }
  if (post.status === "archived") {
    throw new ArticleIngestError(
      409,
      "article_not_editable",
      "Archived articles are not updated by synchronization.",
      { postId: post.postId, status: post.status },
    );
  }

  const safety = await evaluateLifecycleSafety({
    surfaceId: "blog_post",
    initiativeId: null,
    actorParticipantId: input.article.huMemberId,
    text: [input.validated.title, input.validated.excerpt, blogHtmlToPlainText(input.validated.content)]
      .filter(Boolean)
      .join("\n\n"),
    fieldName: "blog_post",
  });
  if (safety.outcome === "rejected") {
    throw new ArticleIngestError(
      422,
      "safety_rejected",
      safety.summary ?? "Blog content was rejected by Safety.",
      { postId: post.postId, status: post.status },
    );
  }
  if (safety.outcome === "needs_review") {
    throw new ArticleIngestError(
      422,
      "safety_needs_review",
      safety.summary ?? "Safety requires review before this content can replace the article.",
      { postId: post.postId, status: post.status },
    );
  }

  const automatic = await resolvePublishWithoutManualReview(input.article.huMemberId);
  const publicStatus = post.status === "published" || post.status === "scheduled";
  const inReview = post.status === "submitted_for_review";
  if (!automatic && (publicStatus || inReview)) {
    throw new ArticleIngestError(
      409,
      "automatic_publication_disabled",
      "Automatic publication is disabled for this author. The existing article was left unchanged.",
      { postId: post.postId, status: post.status },
    );
  }
}

async function writeSyndicatedArticle(post: BlogPost, input: DeliveryWork): Promise<BlogPost> {
  const updated = await updateSyndicatedBlogArticleContent({
    postId: post.postId,
    title: input.validated.title,
    excerpt: input.validated.excerpt,
    content: input.validated.content,
    safetyOutcome: "accepted" satisfies LifecycleSafetyOutcome,
    updatedAt: input.now.toISOString(),
    ...(input.article.coverImageUrl
      ? { externalCover: { source: "integrity-media", url: input.article.coverImageUrl } }
      : {}),
    ...(input.article.externalVideo !== undefined
      ? { externalVideo: externalVideoForPost(input.article.externalVideo) }
      : {}),
  });
  if (updated.status === "published") {
    invalidateGlobalSearchIndex();
    notifyPublicPresentationChanged({
      sourceKind: "blog_post",
      sourceRecordId: updated.postId,
      reason: "public_update",
    });
  }
  return updated;
}

function syndicatedArticleMatches(post: BlogPost, input: DeliveryWork): boolean {
  if (
    post.title !== input.validated.title ||
    post.excerpt !== input.validated.excerpt ||
    post.content !== input.validated.content
  ) {
    return false;
  }
  if (input.article.coverImageUrl && post.externalCover?.url !== input.article.coverImageUrl) {
    return false;
  }
  if (input.article.externalVideo !== undefined && !externalVideoMatches(post, input.article.externalVideo)) {
    return false;
  }
  return true;
}

function externalVideoMatches(
  post: BlogPost,
  video: ArticleDeliveryExternalVideo | null,
): boolean {
  if (video === null) {
    return !post.externalVideo;
  }
  return (
    post.externalVideo?.provider === video.provider &&
    post.externalVideo.providerVideoId === video.providerVideoId
  );
}

function externalVideoForPost(video: ArticleDeliveryExternalVideo | null): BlogExternalVideo | null {
  if (video === null) {
    return null;
  }
  return {
    source: "integrity-media",
    provider: video.provider,
    providerVideoId: video.providerVideoId,
  };
}

function currentArticleResult(
  delivery: ArticleDeliveryRecord,
  post: BlogPost,
  idempotent: boolean,
): ArticleIngestResult {
  return {
    source: INTEGRITY_MEDIA_SOURCE,
    publicationId: delivery.publicationId,
    postId: post.postId,
    status: post.status,
    idempotent,
  };
}

async function reconcileCover(postId: string, input: DeliveryWork): Promise<void> {
  const coverUrl = input.article.coverImageUrl;
  let winning: ArticleDeliveryRecord | null = null;
  let accepted = false;
  if (coverUrl) {
    const result = await compareAndSetArticleCover({
      publicationId: input.article.publicationId,
      coverUrl,
      coverDigest: articleCoverDigest(coverUrl),
      coverTimestamp: input.signedTimestamp,
    });
    winning = result.record;
    accepted = result.updated;
  } else {
    winning = await findArticleDelivery(input.article.publicationId);
  }
  if (!winning) {
    throw new ArticleIngestError(503, "unavailable", "Article delivery could not be reconciled.");
  }
  await applyExternalCover(postId, winning, accepted);
}

async function reconcileStoredExternalVideo(
  postId: string,
  delivery: ArticleDeliveryRecord,
): Promise<void> {
  if (delivery.externalVideo === undefined) {
    return;
  }
  await applyExternalVideo(postId, delivery.externalVideo);
}

async function applyExternalVideo(
  postId: string,
  video: ArticleDeliveryExternalVideo | null,
): Promise<void> {
  const post = await findBlogPostById(postId);
  if (!post) {
    throw new ArticleIngestError(503, "unavailable", "Article delivery could not be reconciled.");
  }
  const next = externalVideoForPost(video);
  if (externalVideoMatches(post, video)) {
    return;
  }
  await updateBlogPostExternalVideo(postId, next);
}

async function applyExternalCover(
  postId: string,
  delivery: ArticleDeliveryRecord,
  justAccepted: boolean,
): Promise<void> {
  if (!delivery.coverUrl) {
    return;
  }
  const cover: BlogExternalCover = { source: "integrity-media", url: delivery.coverUrl };
  const post = await findBlogPostById(postId);
  if (!post) {
    throw new ArticleIngestError(503, "unavailable", "Article delivery could not be reconciled.");
  }
  if (post.externalCover?.source === cover.source && post.externalCover.url === cover.url) {
    return;
  }
  if (justAccepted && afterCoverAcceptForTests) {
    const hook = afterCoverAcceptForTests;
    afterCoverAcceptForTests = null;
    await hook();
  }
  await updateBlogPostExternalCover(postId, cover);
}

async function saveDeliveryPhase(input: {
  publicationId: string;
  postId: string | null;
  status: BlogPostStatus | null;
  phase: ArticleDeliveryRecord["phase"];
}): Promise<void> {
  await updateArticleDeliveryPhase(input);
}

async function createAndSubmit(
  input: DeliveryWork,
  claimed?: ArticleDeliveryRecord,
): Promise<ArticleIngestResult> {
  let postId = claimed?.postId ?? null;
  try {
    if (!postId) {
      const draft = await createBlogDraft({
        actorParticipantId: input.article.huMemberId,
        actorDisplayName: "Participant",
        body: {
          title: input.validated.title,
          excerpt: input.validated.excerpt,
          content: input.article.content,
          categoryId: input.categoryId,
          originalLanguage: input.validated.originalLanguage,
          publicationDate: input.article.publishedAt,
          tags: [],
        },
      });
      postId = draft.postId;
      await saveDeliveryPhase({
        publicationId: input.article.publicationId,
        postId,
        status: draft.status,
        phase: "held",
      });
    }

    const recorded = await findArticleDelivery(input.article.publicationId);
    if (recorded) {
      await applyExternalCover(postId, recorded, false);
      if (recorded.externalVideo !== undefined) {
        await applyExternalVideo(postId, recorded.externalVideo);
      }
    }

    const submitted = await submitBlogPostForReview({
      postId,
      actorParticipantId: input.article.huMemberId,
    });
    const status = await actualStatus(postId, submitted.status);
    await saveDeliveryPhase({
      publicationId: input.article.publicationId,
      postId,
      status,
      phase: "complete",
    });
    return {
      source: INTEGRITY_MEDIA_SOURCE,
      publicationId: input.article.publicationId,
      postId,
      status,
      idempotent: false,
    };
  } catch (error) {
    if (!postId) {
      await releaseArticleDeliveryWithoutPost(input.article.publicationId);
      throw mapBlogError(error);
    }

    const stored = await findBlogPostById(postId);
    const status = stored?.status ?? "draft";
    if (COMPLETE_STATUSES.has(status)) {
      await saveDeliveryPhase({
        publicationId: input.article.publicationId,
        postId,
        status,
        phase: "complete",
      });
      return {
        source: INTEGRITY_MEDIA_SOURCE,
        publicationId: input.article.publicationId,
        postId,
        status,
        idempotent: false,
      };
    }

    await saveDeliveryPhase({
      publicationId: input.article.publicationId,
      postId,
      status,
      phase: "held",
    });
    throw mapBlogError(error, { postId, status });
  }
}

async function actualStatus(postId: string, fallback: BlogPostStatus): Promise<BlogPostStatus> {
  const stored = await findBlogPostById(postId);
  return stored?.status ?? fallback;
}

function mapBlogError(
  error: unknown,
  delivery: { postId: string; status: BlogPostStatus } | null = null,
): ArticleIngestError {
  if (error instanceof ArticleIngestError) {
    return error.delivery || !delivery ? error : new ArticleIngestError(error.statusCode, error.code, error.message, delivery);
  }
  if (error instanceof BlogSafetyRejectedError) {
    return new ArticleIngestError(422, "safety_rejected", error.message, delivery);
  }
  if (error instanceof BlogSafetyNeedsReviewError) {
    return new ArticleIngestError(422, "safety_needs_review", error.message, delivery);
  }
  if (error instanceof BlogAccessDeniedError) {
    return new ArticleIngestError(403, "author_blocked", error.message, delivery);
  }
  if (error instanceof BlogValidationError) {
    return new ArticleIngestError(400, "invalid_article", error.message, delivery);
  }
  return new ArticleIngestError(503, "unavailable", "Integrity Media article ingestion is unavailable.", delivery);
}

async function resolveConfiguredCategoryId(): Promise<string> {
  const categoryId = process.env[INTEGRITY_MEDIA_ARTICLE_CATEGORY_ID_ENV]?.trim() ?? "";
  if (!categoryId) {
    throw new ArticleIngestError(
      503,
      "category_not_configured",
      "Integrity Media article category is not configured.",
    );
  }
  await ensureBlogCategoriesSeeded();
  if (!isActiveBlogCategoryId(categoryId)) {
    throw new ArticleIngestError(
      422,
      "category_unavailable",
      "Integrity Media article category is not an active Blog category.",
    );
  }
  return categoryId;
}

function verifySignature(input: {
  article: NormalizedArticle;
  timestamp: string;
  signature: string;
  secret: string;
  now: Date;
}): void {
  if (!/^\d{10}$/.test(input.timestamp)) {
    throw new ArticleIngestError(400, "invalid_timestamp", "The article timestamp is not valid.");
  }

  const payload = buildArticleIngestPayload({
    timestamp: input.timestamp,
    publicationId: input.article.publicationId,
    authorId: input.article.authorId,
    huMemberId: input.article.huMemberId,
    target: input.article.target,
    language: input.article.language,
    publishedAt: input.article.publishedAt,
    canonicalUrl: input.article.canonicalUrl,
    title: input.article.title,
    excerpt: input.article.excerpt,
    content: input.article.content,
    ...(input.article.operation === "update"
      ? { operation: "update" as const, contentRevision: input.article.contentRevision }
      : {}),
    ...(input.article.externalVideo !== undefined
      ? { externalVideo: input.article.externalVideo }
      : {}),
    ...(input.article.coverImageUrl ? { coverImageUrl: input.article.coverImageUrl } : {}),
  });
  const expected = signIntegrityMediaLinkRedeem(input.secret, payload);
  if (!integrityMediaLinkSignaturesEqual(expected, input.signature)) {
    throw new ArticleIngestError(401, "invalid_signature", "The article signature is not valid.");
  }

  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = Math.floor(input.now.getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS) {
    throw new ArticleIngestError(
      401,
      "stale_timestamp",
      "The article timestamp is outside the allowed window.",
    );
  }

  if (hasArticleIngestSignature(input.signature, input.now.getTime())) {
    throw new ArticleIngestError(401, "replayed", "This article delivery request was already used.");
  }
  noteArticleIngestSignature(input.signature, input.now.getTime());
}

function normalizeArticle(body: unknown): NormalizedArticle {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ArticleIngestError(400, "invalid_article", "The article payload is not valid.");
  }
  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ARTICLE_FIELDS.has(key) && !OPTIONAL_ARTICLE_FIELDS.has(key)) {
      throw new ArticleIngestError(400, "unexpected_field", "The article payload is not valid.");
    }
  }
  for (const key of ARTICLE_FIELDS) {
    if (!(key in record)) {
      throw new ArticleIngestError(400, "invalid_article", "The article payload is not valid.");
    }
  }

  const publicationId = requiredToken(record.publicationId, PUBLICATION_ID_PATTERN, "publicationId");
  const authorId = requiredToken(record.authorId, INTEGRITY_MEDIA_AUTHOR_ID_PATTERN, "authorId");
  const huMemberId = requiredToken(record.huMemberId, INTEGRITY_MEDIA_AUTHOR_ID_PATTERN, "huMemberId");
  const title = normalizeArticleText(record.title, "title");
  const excerpt = normalizeArticleText(record.excerpt, "excerpt");
  const content = requiredString(record.content, "content");
  const language = requiredString(record.language, "language").trim().toLowerCase();
  const publishedAt = requiredString(record.publishedAt, "publishedAt").trim();
  const canonicalUrl = normalizeCanonicalUrl(record.canonicalUrl);
  const coverImageUrl = normalizeCoverImageUrl(record.coverImageUrl);
  const externalVideo = normalizeExternalVideo(record);
  const target = requiredString(record.target, "target").trim();
  const updateFields = normalizeUpdateFields(record);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
    throw new ArticleIngestError(400, "invalid_article", "publishedAt must be a YYYY-MM-DD date.");
  }

  return {
    publicationId,
    authorId,
    huMemberId,
    title,
    excerpt,
    content,
    language,
    publishedAt,
    canonicalUrl,
    target,
    ...(coverImageUrl ? { coverImageUrl } : {}),
    ...(externalVideo !== undefined ? { externalVideo } : {}),
    ...updateFields,
  };
}

function normalizeExternalVideo(
  record: Record<string, unknown>,
): ArticleDeliveryExternalVideo | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(record, "externalVideoUrl")) {
    return undefined;
  }
  const value = record.externalVideoUrl;
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ArticleIngestError(400, "invalid_article", "externalVideoUrl is not valid.");
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048 || /[<>]/.test(trimmed) || /\s/.test(trimmed)) {
    throw new ArticleIngestError(400, "invalid_article", "externalVideoUrl is not valid.");
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new ArticleIngestError(400, "invalid_article", "externalVideoUrl is not valid.");
  }
  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
    throw new ArticleIngestError(400, "invalid_article", "externalVideoUrl is not valid.");
  }
  const parsed = parseExternalVideoUrl(trimmed);
  if (!parsed) {
    throw new ArticleIngestError(400, "invalid_article", "externalVideoUrl is not valid.");
  }
  return { provider: parsed.provider, providerVideoId: parsed.providerVideoId };
}

function normalizeUpdateFields(
  record: Record<string, unknown>,
): { operation: "update"; contentRevision: number } | Record<string, never> {
  const hasOperation = "operation" in record;
  const hasRevision = "contentRevision" in record;
  if (!hasOperation && !hasRevision) {
    return {};
  }
  if (!hasOperation || !hasRevision || record.operation !== "update") {
    throw new ArticleIngestError(400, "invalid_article", "operation is not valid.");
  }
  return { operation: "update", contentRevision: normalizeContentRevision(record.contentRevision) };
}

function normalizeContentRevision(value: unknown): number {
  const revision =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^[1-9]\d*$/.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new ArticleIngestError(400, "invalid_article", "contentRevision is not valid.");
  }
  return revision;
}

function normalizeArticleText(value: unknown, field: string): string {
  return requiredString(value, field).trim().replace(/\s+/g, " ");
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new ArticleIngestError(400, "invalid_article", `${field} is not valid.`);
  }
  return value;
}

function requiredToken(value: unknown, pattern: RegExp, field: string): string {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new ArticleIngestError(400, "invalid_article", `${field} is not valid.`);
  }
  return value;
}

function normalizeCoverImageUrl(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > 2048) {
    throw new ArticleIngestError(400, "invalid_article", "coverImageUrl is not valid.");
  }
  return canonicalHttpsUrl(value, "coverImageUrl");
}

function normalizeCanonicalUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > 2048) {
    throw new ArticleIngestError(400, "invalid_article", "canonicalUrl is not valid.");
  }
  return canonicalHttpsUrl(value, "canonicalUrl");
}

function canonicalHttpsUrl(value: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new ArticleIngestError(400, "invalid_article", `${field} is not valid.`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new ArticleIngestError(400, "invalid_article", `${field} is not valid.`);
  }
  if (field === "coverImageUrl" && isDisallowedCoverHost(parsed.hostname)) {
    throw new ArticleIngestError(400, "invalid_article", "coverImageUrl is not valid.");
  }
  return parsed.toString();
}

function isDisallowedCoverHost(hostname: string): boolean {
  const bare = (hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname
  ).toLowerCase();
  if (
    bare === "localhost" ||
    bare.endsWith(".localhost") ||
    bare.endsWith(".local")
  ) {
    return true;
  }

  const mapped = ipv4FromMappedIpv6(bare);
  if (mapped) {
    return blockedCoverDestinations.check(mapped, "ipv4");
  }

  const kind = isIP(bare);
  if (kind === 4) {
    return blockedCoverDestinations.check(bare, "ipv4");
  }
  if (kind === 6) {
    return blockedCoverDestinations.check(bare, "ipv6");
  }
  return false;
}

function ipv4FromMappedIpv6(host: string): string | null {
  const match = /^::ffff:(.+)$/i.exec(host);
  if (!match) {
    return null;
  }
  const rest = match[1]!;
  if (isIP(rest) === 4) {
    return rest;
  }
  const parts = rest.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }
  const high = Number.parseInt(parts[0], 16);
  const low = Number.parseInt(parts[1], 16);
  if (!Number.isFinite(high) || !Number.isFinite(low) || high < 0 || low < 0 || high > 0xffff || low > 0xffff) {
    return null;
  }
  const value = (high << 16) + low;
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");
}

function serializeDelivery<T>(publicationId: string, run: () => Promise<T>): Promise<T> {
  const key = `${INTEGRITY_MEDIA_SOURCE}\n${publicationId}`;
  const previous = deliveryLocks.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(run);
  deliveryLocks.set(
    key,
    current.then(
      () => undefined,
      () => undefined,
    ),
  );
  return current;
}
