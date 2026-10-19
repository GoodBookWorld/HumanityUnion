import { createHash } from "node:crypto";

import { INTEGRITY_MEDIA_ARTICLE_INGEST_PURPOSE } from "./external-author-link.constants.js";
import { INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS } from "./external-author-link.constants.js";

const seenArticleSignatures = new Map<string, number>();

export function hashArticleField(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Twelve lines, UTF-8, joined by newline, no trailing newline.
 * Title and excerpt are the normalized Blog strings. Content is the exact
 * request string. Field hashes keep the article body out of the signed lines'
 * logs while still binding it.
 */
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
}): string {
  return [
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
  ].join("\n");
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
}): string {
  return hashArticleField(
    [
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
    ].join("\n"),
  );
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
