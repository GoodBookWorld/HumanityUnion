/**
 * Reset 03E.13 — authoritative public_news ID set for /media PLP.
 *
 * MUST stay identical to Web SSR:
 *   fetchPublicNewsArticles({ limit: MEDIA_PLP_NEWS_BATCH_LIMIT, language: "en" })
 * which calls findActivePublicNewsRecords({ language: "en", limit }) + source balance.
 *
 * Pre-03E.13 carousel discovery used newest-by-publishedAt without language/balance,
 * so materializer USABLE rows did not match the live News rail (≈5/12 overlap).
 */

import type { NewsArticleRecord } from "@hu/types";

import { findActivePublicNewsRecords } from "../../public-news/public-news.repository.js";
import { MEDIA_PLP_CAROUSEL_NEWS_LIMIT } from "./constants.js";

/** Same language Web /media SSR passes to the public news listing. */
export const MEDIA_PLP_NEWS_CONSUMER_LANGUAGE = "en";

/**
 * Articles that belong in the /media PLP batch and carousel materializer inventory.
 */
export async function selectMediaPlpConsumerNewsArticles(input?: {
  readonly limit?: number;
  readonly now?: string;
}): Promise<readonly NewsArticleRecord[]> {
  return findActivePublicNewsRecords({
    limit: input?.limit ?? MEDIA_PLP_CAROUSEL_NEWS_LIMIT,
    language: MEDIA_PLP_NEWS_CONSUMER_LANGUAGE,
    now: input?.now,
  });
}

export async function selectMediaPlpConsumerNewsIds(input?: {
  readonly limit?: number;
  readonly now?: string;
}): Promise<readonly string[]> {
  const records = await selectMediaPlpConsumerNewsArticles(input);
  return records.map((record) => record.id);
}

/**
 * Pre-03E.13 discovery shape (newest N, no language / no source balance).
 * Kept for parity diagnostics and regression proof only — not for materialize.
 */
export async function listNewestActivePublicNewsIdsIgnoringConsumerBalance(input: {
  readonly limit: number;
  readonly now?: string;
  readonly findDocs: (args: {
    readonly filter: Record<string, unknown>;
    readonly sort: Record<string, 1 | -1>;
    readonly limit: number;
  }) => Promise<readonly { readonly id?: unknown }[]>;
}): Promise<readonly string[]> {
  const now = input.now ?? new Date().toISOString();
  const docs = await input.findDocs({
    filter: {
      status: "active",
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
    },
    sort: { publishedAt: -1, id: 1 },
    limit: input.limit,
  });
  const ids: string[] = [];
  for (const doc of docs) {
    const id = typeof doc.id === "string" ? doc.id.trim() : "";
    if (id) {
      ids.push(id);
    }
  }
  return ids;
}
