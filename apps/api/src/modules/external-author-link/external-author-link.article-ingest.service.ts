import type { BlogPostStatus } from "@hu/types";

import { createBlogDraft, submitBlogPostForReview } from "../blog/blog.service.js";
import { ensureBlogCategoriesSeeded, isActiveBlogCategoryId } from "../blog/blog-categories.js";
import {
  BlogAccessDeniedError,
  BlogSafetyNeedsReviewError,
  BlogSafetyRejectedError,
  BlogValidationError,
} from "../blog/blog.errors.js";
import { validateCreateBlogDraftInput } from "../blog/blog.validators.js";
import { findBlogPostById } from "../blog/persistence/blog.repository.js";
import { integrityMediaLinkSignaturesEqual, signIntegrityMediaLinkRedeem } from "./external-author-link.hmac.js";
import {
  articlePayloadDigest,
  buildArticleIngestPayload,
  hasArticleIngestSignature,
  noteArticleIngestSignature,
} from "./external-author-link.article-ingest.hmac.js";
import {
  ArticleDeliveryDuplicateError,
  findArticleDelivery,
  insertArticleDelivery,
  releaseArticleDeliveryWithoutPost,
  updateArticleDelivery,
  type ArticleDeliveryRecord,
} from "./external-author-link.article-ingest.repository.js";
import { isOrdinaryIntegrityMediaCollaborationAllowed } from "./external-author-link.collaboration.js";
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
}

let afterClaimForTests: (() => Promise<void> | void) | null = null;
const deliveryLocks = new Map<string, Promise<unknown>>();

export function setArticleIngestAfterClaimForTests(
  hook: (() => Promise<void> | void) | null,
): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Article ingest test hooks are available only when NODE_TEST_ENV=true.");
  }
  afterClaimForTests = hook;
}

export function resetArticleIngestLocksForTests(): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Article ingest test hooks are available only when NODE_TEST_ENV=true.");
  }
  deliveryLocks.clear();
  afterClaimForTests = null;
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

  const rawPlatformMode = process.env.PLATFORM_MODE?.trim() ?? "";
  if (article.target !== "staging" || article.target !== rawPlatformMode) {
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
  });

  return serializeDelivery(article.publicationId, () =>
    deliverClaimedArticle({
      article,
      categoryId,
      validated,
      digest,
      now,
    }),
  );
}

async function deliverClaimedArticle(input: {
  article: NormalizedArticle;
  categoryId: string;
  validated: ReturnType<typeof validateCreateBlogDraftInput>;
  digest: string;
  now: Date;
}): Promise<ArticleIngestResult> {
  const existing = await findArticleDelivery(input.article.publicationId);
  if (existing) {
    return continueExistingDelivery(existing, input);
  }

  const createdAt = input.now.toISOString();
  try {
    await insertArticleDelivery({
      source: INTEGRITY_MEDIA_SOURCE,
      publicationId: input.article.publicationId,
      payloadDigest: input.digest,
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
  input: {
    article: NormalizedArticle;
    categoryId: string;
    validated: ReturnType<typeof validateCreateBlogDraftInput>;
    digest: string;
    now: Date;
  },
): Promise<ArticleIngestResult> {
  if (existing.payloadDigest !== input.digest) {
    throw new ArticleIngestError(
      409,
      "publication_conflict",
      "This publication was already delivered with different content.",
    );
  }
  if (existing.phase === "complete" && existing.postId && existing.status) {
    return {
      source: INTEGRITY_MEDIA_SOURCE,
      publicationId: existing.publicationId,
      postId: existing.postId,
      status: existing.status,
      idempotent: true,
    };
  }
  if (existing.postId) {
    return createAndSubmit(input, existing);
  }
  throw new ArticleIngestError(
    409,
    "delivery_in_progress",
    "This publication delivery is already in progress.",
  );
}

async function createAndSubmit(
  input: {
    article: NormalizedArticle;
    categoryId: string;
    validated: ReturnType<typeof validateCreateBlogDraftInput>;
    digest: string;
    now: Date;
  },
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
      await updateArticleDelivery({
        source: INTEGRITY_MEDIA_SOURCE,
        publicationId: input.article.publicationId,
        payloadDigest: input.digest,
        postId,
        status: draft.status,
        phase: "held",
        createdAt: claimed?.createdAt ?? input.now.toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const submitted = await submitBlogPostForReview({
      postId,
      actorParticipantId: input.article.huMemberId,
    });
    const status = await actualStatus(postId, submitted.status);
    await updateArticleDelivery({
      source: INTEGRITY_MEDIA_SOURCE,
      publicationId: input.article.publicationId,
      payloadDigest: input.digest,
      postId,
      status,
      phase: "complete",
      createdAt: claimed?.createdAt ?? input.now.toISOString(),
      updatedAt: new Date().toISOString(),
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
      await updateArticleDelivery({
        source: INTEGRITY_MEDIA_SOURCE,
        publicationId: input.article.publicationId,
        payloadDigest: input.digest,
        postId,
        status,
        phase: "complete",
        createdAt: claimed?.createdAt ?? input.now.toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return {
        source: INTEGRITY_MEDIA_SOURCE,
        publicationId: input.article.publicationId,
        postId,
        status,
        idempotent: false,
      };
    }

    await updateArticleDelivery({
      source: INTEGRITY_MEDIA_SOURCE,
      publicationId: input.article.publicationId,
      payloadDigest: input.digest,
      postId,
      status,
      phase: "held",
      createdAt: claimed?.createdAt ?? input.now.toISOString(),
      updatedAt: new Date().toISOString(),
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
    if (!ARTICLE_FIELDS.has(key)) {
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
  const target = requiredString(record.target, "target").trim();

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
  };
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

function normalizeCanonicalUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > 2048) {
    throw new ArticleIngestError(400, "invalid_article", "canonicalUrl is not valid.");
  }
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new ArticleIngestError(400, "invalid_article", "canonicalUrl is not valid.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new ArticleIngestError(400, "invalid_article", "canonicalUrl is not valid.");
  }
  return parsed.toString();
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
