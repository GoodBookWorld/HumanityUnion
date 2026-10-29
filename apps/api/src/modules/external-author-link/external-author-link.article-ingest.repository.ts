import type { BlogPostStatus } from "@hu/types";
import type { ClientSession } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { INTEGRITY_MEDIA_SOURCE } from "./external-author-link.constants.js";

export type ArticleDeliveryPhase = "creating" | "complete" | "held";

export interface ArticleDeliveryExternalVideo {
  provider: "youtube" | "vimeo";
  providerVideoId: string;
}

export interface ArticleDeliveryRecord {
  source: typeof INTEGRITY_MEDIA_SOURCE;
  publicationId: string;
  payloadDigest: string;
  /** IM author that created this delivery. Absent on rows stored before updates. */
  authorId?: string;
  /**
   * Monotonic accepted content revision. Absent or 0 is the original create.
   * Independent of the HMAC request timestamp.
   */
  contentRevision?: number;
  /**
   * SHA-256 of the accepted cover URL, or of "" when no cover has been accepted.
   * Independent of payloadDigest. Absent on deliveries stored before covers.
   */
  coverDigest?: string;
  /** Canonical cover URL accepted for this publication. Null or absent means none. */
  coverUrl?: string | null;
  /** Signed timestamp that accepted coverUrl. Empty or absent means no cover decision. */
  coverTimestamp?: string;
  /**
   * Accepted external video. Absent means this delivery has not recorded a video
   * decision. Null means an explicit removal was accepted.
   */
  externalVideo?: ArticleDeliveryExternalVideo | null;
  postId: string | null;
  status: BlogPostStatus | null;
  phase: ArticleDeliveryPhase;
  createdAt: string;
  updatedAt: string;
}

export type ArticleContentDecision = "applied" | "idempotent" | "stale" | "conflict";

export interface ArticleContentWriteResult {
  decision: ArticleContentDecision;
  record: ArticleDeliveryRecord;
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

/**
 * Deliveries whose authorId matches this author ignoring case.
 * Rows with no authorId are not returned and are not deletion candidates.
 */
export async function listArticleDeliveriesForAuthorDeletion(
  authorId: string,
  options?: { session?: ClientSession },
): Promise<ArticleDeliveryRecord[]> {
  if (!options?.session && articleDeliveryUsesMemory()) {
    const lowered = authorId.toLowerCase();
    return [...memoryRows.values()]
      .filter((row) => {
        const author = row.authorId;
        return (
          row.source === INTEGRITY_MEDIA_SOURCE &&
          typeof author === "string" &&
          author.length > 0 &&
          author.toLowerCase() === lowered
        );
      })
      .map((row) => ({ ...row }));
  }

  const documents = await collection()
    .find(
      {
        source: INTEGRITY_MEDIA_SOURCE,
        authorId: { $type: "string", $ne: "" },
        $expr: { $eq: [{ $toLower: "$authorId" }, authorId.toLowerCase()] },
      },
      {
        projection: { _id: 0 },
        ...(options?.session ? { session: options.session } : {}),
      },
    )
    .toArray();
  return documents;
}

export async function deleteArticleDeliveriesByPublicationIds(
  publicationIds: readonly string[],
  options?: { session?: ClientSession },
): Promise<number> {
  if (publicationIds.length === 0) {
    return 0;
  }
  if (!options?.session && articleDeliveryUsesMemory()) {
    let removed = 0;
    for (const publicationId of publicationIds) {
      if (memoryRows.delete(deliveryKey(INTEGRITY_MEDIA_SOURCE, publicationId))) {
        removed += 1;
      }
    }
    return removed;
  }
  const result = await collection().deleteMany(
    { source: INTEGRITY_MEDIA_SOURCE, publicationId: { $in: [...publicationIds] } },
    options?.session ? { session: options.session } : {},
  );
  return result.deletedCount;
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

/**
 * Accept a content revision only when it is greater than the stored revision.
 * An equal revision with the same digest is idempotent. An equal revision with
 * a different digest conflicts. A lower revision is stale and must not write.
 * Cover fields change only when this revision includes a cover.
 * Video fields change only when this revision includes the video field.
 */
export async function compareAndSetArticleContent(input: {
  publicationId: string;
  contentRevision: number;
  payloadDigest: string;
  authorId: string;
  cover?: {
    coverUrl: string;
    coverDigest: string;
    coverTimestamp: string;
  };
  externalVideo?: ArticleDeliveryExternalVideo | null;
}): Promise<ArticleContentWriteResult> {
  if (articleDeliveryUsesMemory()) {
    const key = deliveryKey(INTEGRITY_MEDIA_SOURCE, input.publicationId);
    const current = memoryRows.get(key);
    if (!current) {
      throw new Error("article_delivery_missing");
    }
    const decision = classifyContentRevision(current, input);
    if (decision !== "applied") {
      return { decision, record: { ...current } };
    }
    const next = applyContentRevision(current, input);
    memoryRows.set(key, next);
    return { decision: "applied", record: { ...next } };
  }

  const updated = await collection().findOneAndUpdate(
    {
      source: INTEGRITY_MEDIA_SOURCE,
      publicationId: input.publicationId,
      $expr: {
        $lt: [{ $ifNull: ["$contentRevision", 0] }, input.contentRevision],
      },
    },
    {
      $set: contentRevisionUpdate(input),
    },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (updated) {
    return { decision: "applied", record: updated };
  }

  const current = await findArticleDelivery(input.publicationId);
  if (!current) {
    throw new Error("article_delivery_missing");
  }
  return { decision: classifyContentRevision(current, input), record: current };
}

function classifyContentRevision(
  current: ArticleDeliveryRecord,
  input: {
    contentRevision: number;
    payloadDigest: string;
  },
): ArticleContentDecision {
  const stored = current.contentRevision ?? 0;
  if (input.contentRevision < stored) {
    return "stale";
  }
  if (input.contentRevision === stored) {
    return current.payloadDigest === input.payloadDigest ? "idempotent" : "conflict";
  }
  return "applied";
}

function videoRevisionFields(video: ArticleDeliveryExternalVideo | null | undefined): {
  externalVideo: ArticleDeliveryExternalVideo | null;
} | Record<string, never> {
  if (video === undefined) {
    return {};
  }
  if (video === null) {
    return { externalVideo: null };
  }
  return {
    externalVideo: {
      provider: video.provider,
      providerVideoId: video.providerVideoId,
    },
  };
}

function applyContentRevision(
  current: ArticleDeliveryRecord,
  input: {
    contentRevision: number;
    payloadDigest: string;
    authorId: string;
    cover?: {
      coverUrl: string;
      coverDigest: string;
      coverTimestamp: string;
    };
    externalVideo?: ArticleDeliveryExternalVideo | null;
  },
): ArticleDeliveryRecord {
  return {
    ...current,
    authorId: current.authorId ?? input.authorId,
    payloadDigest: input.payloadDigest,
    contentRevision: input.contentRevision,
    ...(input.cover
      ? {
          coverUrl: input.cover.coverUrl,
          coverDigest: input.cover.coverDigest,
          coverTimestamp: input.cover.coverTimestamp,
        }
      : {}),
    ...videoRevisionFields(input.externalVideo),
    updatedAt: new Date().toISOString(),
  };
}

function contentRevisionUpdate(input: {
  contentRevision: number;
  payloadDigest: string;
  authorId: string;
  cover?: {
    coverUrl: string;
    coverDigest: string;
    coverTimestamp: string;
  };
  externalVideo?: ArticleDeliveryExternalVideo | null;
}): Record<string, unknown> {
  return {
    payloadDigest: input.payloadDigest,
    contentRevision: input.contentRevision,
    authorId: input.authorId,
    updatedAt: new Date().toISOString(),
    ...(input.cover
      ? {
          coverUrl: input.cover.coverUrl,
          coverDigest: input.cover.coverDigest,
          coverTimestamp: input.cover.coverTimestamp,
        }
      : {}),
    ...videoRevisionFields(input.externalVideo),
  };
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
