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
  postId: string | null;
  status: BlogPostStatus | null;
  phase: ArticleDeliveryPhase;
  createdAt: string;
  updatedAt: string;
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

export async function updateArticleDelivery(record: ArticleDeliveryRecord): Promise<void> {
  if (articleDeliveryUsesMemory()) {
    memoryRows.set(deliveryKey(record.source, record.publicationId), { ...record });
    return;
  }
  await collection().replaceOne(
    { source: record.source, publicationId: record.publicationId },
    record,
    { upsert: false },
  );
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
