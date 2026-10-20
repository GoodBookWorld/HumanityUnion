import type { BlogPostStatus } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";

export type ArticleDeliveryPhase = "creating" | "complete" | "held";

export interface ArticleDeliveryRecord {
  source: typeof INTEGRITY_MEDIA_SOURCE;
  publicationId: string;
  payloadDigest: string;
  /**
   * SHA-256 of the accepted cover URL, or of "" when no cover has been accepted.
   * Independent of payloadDigest. Absent on deliveries stored before covers.
   */
  coverDigest?: string;
  /** Canonical cover URL accepted for this publication. Null or absent means none. */
  coverUrl?: string | null;
  /** Signed timestamp that accepted coverUrl. Empty or absent means no cover decision. */
  coverTimestamp?: string;
  postId: string | null;
  status: BlogPostStatus | null;
  phase: ArticleDeliveryPhase;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleCoverWriteResult {
  record: ArticleDeliveryRecord;
  /** True when this call stored a new cover. False when the stored cover wins. */
  updated: boolean;
}

export class ArticleDeliveryDuplicateError extends Error {
  constructor() {
    super("article_delivery_duplicate");
    this.name = "ArticleDeliveryDuplicateError";
  }
}

const memoryRows = new Map<string, ArticleDeliveryRecord>();
let memoryForced = false;

function deliveryKey(source: string, publicationId: string): string {
  return `${source}\n${publicationId}`;
}

export function enableArticleDeliveryMemoryForTests(): void {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Article delivery memory is available only when NODE_TEST_ENV=true.");
  }
  memoryForced = true;
  memoryRows.clear();
}

export function resetArticleDeliveriesForTests(): void {
  enableArticleDeliveryMemoryForTests();
}

export function listArticleDeliveriesForTests(): readonly ArticleDeliveryRecord[] {
  if (process.env.NODE_TEST_ENV !== "true") {
    throw new Error("Article delivery memory is available only when NODE_TEST_ENV=true.");
  }
  return [...memoryRows.values()];
}

function articleDeliveryUsesMemory(): boolean {
  return memoryForced || !isMongoConfigured();
}

function collection() {
  return getMongoCollection<ArticleDeliveryRecord>(MONGO_COLLECTIONS.integrityMediaArticleDeliveries);
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

export async function findArticleDelivery(
  publicationId: string,
): Promise<ArticleDeliveryRecord | null> {
  if (articleDeliveryUsesMemory()) {
    return memoryRows.get(deliveryKey(INTEGRITY_MEDIA_SOURCE, publicationId)) ?? null;
  }
  return collection().findOne(
    { source: INTEGRITY_MEDIA_SOURCE, publicationId },
    { projection: { _id: 0 } },
  );
}

export async function insertArticleDelivery(record: ArticleDeliveryRecord): Promise<void> {
  if (articleDeliveryUsesMemory()) {
    const key = deliveryKey(record.source, record.publicationId);
    if (memoryRows.has(key)) {
      throw new ArticleDeliveryDuplicateError();
    }
    memoryRows.set(key, { ...record });
    return;
  }

  try {
    await collection().insertOne({ ...record });
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new ArticleDeliveryDuplicateError();
    }
    throw error;
  }
}

/**
 * Accept a cover only when it is newer than the stored cover timestamp.
 * An equal timestamp keeps the cover already stored. A matching digest does
 * not rewrite the row. The returned record is the cover the post must show.
 */
export async function compareAndSetArticleCover(input: {
  publicationId: string;
  coverUrl: string;
  coverDigest: string;
  coverTimestamp: string;
}): Promise<ArticleCoverWriteResult> {
  const incomingTimestamp = Number(input.coverTimestamp);
  if (articleDeliveryUsesMemory()) {
    const key = deliveryKey(INTEGRITY_MEDIA_SOURCE, input.publicationId);
    const current = memoryRows.get(key);
    if (!current) {
      throw new Error("article_delivery_missing");
    }
    const storedDigest = current.coverDigest ?? "";
    const storedTimestamp = current.coverTimestamp ? Number(current.coverTimestamp) : 0;
    if (storedDigest === input.coverDigest || storedTimestamp >= incomingTimestamp) {
      return { record: { ...current }, updated: false };
    }
    const next: ArticleDeliveryRecord = {
      ...current,
      coverUrl: input.coverUrl,
      coverDigest: input.coverDigest,
      coverTimestamp: input.coverTimestamp,
      updatedAt: new Date().toISOString(),
    };
    memoryRows.set(key, next);
    return { record: { ...next }, updated: true };
  }

  const updated = await collection().findOneAndUpdate(
    {
      source: INTEGRITY_MEDIA_SOURCE,
      publicationId: input.publicationId,
      $expr: {
        $and: [
          { $ne: [{ $ifNull: ["$coverDigest", ""] }, input.coverDigest] },
          {
            $lt: [
              {
                $convert: {
                  input: { $ifNull: ["$coverTimestamp", "0"] },
                  to: "long",
                  onError: 0,
                  onNull: 0,
                },
              },
              incomingTimestamp,
            ],
          },
        ],
      },
    },
    {
      $set: {
        coverUrl: input.coverUrl,
        coverDigest: input.coverDigest,
        coverTimestamp: input.coverTimestamp,
        updatedAt: new Date().toISOString(),
      },
    },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (updated) {
    return { record: updated, updated: true };
  }

  const current = await findArticleDelivery(input.publicationId);
  if (!current) {
    throw new Error("article_delivery_missing");
  }
  return { record: current, updated: false };
}

/** Updates delivery progress without replacing the accepted cover fields. */
export async function updateArticleDeliveryPhase(input: {
  publicationId: string;
  postId: string | null;
  status: BlogPostStatus | null;
  phase: ArticleDeliveryPhase;
}): Promise<void> {
  const updatedAt = new Date().toISOString();
  if (articleDeliveryUsesMemory()) {
    const key = deliveryKey(INTEGRITY_MEDIA_SOURCE, input.publicationId);
    const current = memoryRows.get(key);
    if (!current) {
      throw new Error("article_delivery_missing");
    }
    memoryRows.set(key, {
      ...current,
      postId: input.postId,
      status: input.status,
      phase: input.phase,
      updatedAt,
    });
    return;
  }

  const result = await collection().updateOne(
    { source: INTEGRITY_MEDIA_SOURCE, publicationId: input.publicationId },
    {
      $set: {
        postId: input.postId,
        status: input.status,
        phase: input.phase,
        updatedAt,
      },
    },
  );
  if (result.matchedCount === 0) {
    throw new Error("article_delivery_missing");
  }
}

/** Removes a claim that never stored a Blog post so a later attempt can insert. */
export async function releaseArticleDeliveryWithoutPost(publicationId: string): Promise<void> {
  if (articleDeliveryUsesMemory()) {
    const key = deliveryKey(INTEGRITY_MEDIA_SOURCE, publicationId);
    const current = memoryRows.get(key);
    if (current && current.postId === null) {
      memoryRows.delete(key);
    }
    return;
  }
  await collection().deleteOne({
    source: INTEGRITY_MEDIA_SOURCE,
    publicationId,
    postId: null,
  });
}
