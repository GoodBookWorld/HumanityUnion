import { createHash } from "node:crypto";

import { isIntegrityMediaVideoId, type BlogExternalVideoProvider } from "@hu/types";

import { INTEGRITY_MEDIA_ARTICLE_INGEST_PURPOSE } from "./external-author-link.constants.js";
import { INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS } from "./external-author-link.constants.js";

const seenArticleSignatures = new Map<string, number>();

export function hashArticleField(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * UTF-8, joined by newline, no trailing newline.
 * Title and excerpt are the normalized Blog strings. Content is the exact
 * request string. Field hashes keep the article body out of the signed lines'
 * logs while still binding it.
 *
 * Create: twelve lines.
 * Update: the same twelve lines, then the literal `update`, then the decimal
 * contentRevision.
 * Video, only when the JSON field is present: `video:v1:<provider>:<id>` or
 * `video:v1:remove`. Absence of this line is not a removal.
 * A cover URL, when present, is the last line. Omitting the update and video
 * lines keeps every previously signed create and cover payload valid.
 */
export interface ArticleIngestVideoIdentity {
  provider: BlogExternalVideoProvider;
  providerVideoId: string;
}

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_VIDEO_ID = /^\d+$/;

/** Canonical video line. `null` is the explicit removal token. */
export function externalVideoIngestLine(video: ArticleIngestVideoIdentity | null): string {
  if (video === null) {
    return "video:v1:remove";
  }
  const valid =
    (video.provider === "youtube" && YOUTUBE_VIDEO_ID.test(video.providerVideoId)) ||
    (video.provider === "vimeo" && VIMEO_VIDEO_ID.test(video.providerVideoId)) ||
    (video.provider === "integrity-media" && isIntegrityMediaVideoId(video.providerVideoId));
  if (!valid) {
    throw new Error("external video identity is not valid.");
  }
  return `video:v1:${video.provider}:${video.providerVideoId}`;
}

export function buildArticleIngestPayload(input: {
  timestamp: string;
  publicationId: string;
  authorId: string;
  huMemberId: string;
  target: string;
  language: string;
  publishedAt: string;
  canonicalUrl: string;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl?: string;
  operation?: "update";
  contentRevision?: number;
  /** Omitted: leave video unchanged. Null: explicit removal. */
  externalVideo?: ArticleIngestVideoIdentity | null;
}): string {
  const lines = [
    INTEGRITY_MEDIA_ARTICLE_INGEST_PURPOSE,
    input.timestamp,
    input.publicationId,
    input.authorId,
    input.huMemberId,
    input.target,
    input.language,
    input.publishedAt,
    input.canonicalUrl,
    hashArticleField(input.title),
    hashArticleField(input.excerpt),
    hashArticleField(input.content),
  ];
  if (input.operation === "update") {
    if (
      input.contentRevision === undefined ||
      !Number.isSafeInteger(input.contentRevision) ||
      input.contentRevision < 1
    ) {
      throw new Error("contentRevision is required for an article update signature.");
    }
    lines.push("update", String(input.contentRevision));
  }
  if (input.externalVideo !== undefined) {
    lines.push(externalVideoIngestLine(input.externalVideo));
  }
  if (input.coverImageUrl !== undefined) {
    lines.push(input.coverImageUrl);
  }
  return lines.join("\n");
}

/** Separate from the content digest so a cover change is not a content conflict. */
export function articleCoverDigest(url: string): string {
  return hashArticleField(url);
}

export function articlePayloadDigest(input: {
  publicationId: string;
  authorId: string;
  huMemberId: string;
  target: string;
  language: string;
  publishedAt: string;
  canonicalUrl: string;
  categoryId: string;
  title: string;
  excerpt: string;
  content: string;
  /**
   * Included only when the request carries the video field, so a legacy body
   * keeps the digest already stored for that text article.
   */
  externalVideo?: ArticleIngestVideoIdentity | null;
}): string {
  const lines = [
    input.publicationId,
    input.authorId,
    input.huMemberId,
    input.target,
    input.language,
    input.publishedAt,
    input.canonicalUrl,
    input.categoryId,
    hashArticleField(input.title),
    hashArticleField(input.excerpt),
    hashArticleField(input.content),
  ];
  if (input.externalVideo !== undefined) {
    lines.push(externalVideoIngestLine(input.externalVideo));
  }
  return hashArticleField(lines.join("\n"));
}

export function resetArticleIngestReplayCacheForTests(): void {
  seenArticleSignatures.clear();
}

export function hasArticleIngestSignature(signature: string, nowMs: number): boolean {
  const seenAt = seenArticleSignatures.get(signature);
  if (seenAt === undefined) {
    return false;
  }
  if (nowMs - seenAt > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000) {
    seenArticleSignatures.delete(signature);
    return false;
  }
  return true;
}

export function noteArticleIngestSignature(signature: string, nowMs: number): void {
  const cutoff = nowMs - INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000;
  for (const [key, seenAt] of seenArticleSignatures) {
    if (seenAt < cutoff) {
      seenArticleSignatures.delete(key);
    }
  }
  seenArticleSignatures.set(signature, nowMs);
}
