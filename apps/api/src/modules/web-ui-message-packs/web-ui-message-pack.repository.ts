/**
 * WEB_UI message pack repository — Mongo + memory (Brand Localization pattern).
 */

import type {
  WebUiMessagePackExpectedRevision,
  WebUiMessagePackRecord,
  WebUiMessagePackUpsertInput,
  WebUiMessageTree,
} from "@hu/types";
import {
  isWebUiMessagePackStatus,
  normalizeLanguageRegistryLocaleKey,
} from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import {
  WebUiMessagePackNotFoundError,
  WebUiMessagePackPersistenceError,
  WebUiMessagePackRevisionConflictError,
  WebUiMessagePackValidationError,
} from "./web-ui-message-pack.errors.js";
import {
  compareAndSetWebUiMessagePackMemory,
  getWebUiMessagePackByLocaleMemory,
  listWebUiMessagePackMemory,
  resetWebUiMessagePackMemoryForTests,
  upsertWebUiMessagePackMemory,
} from "./web-ui-message-pack.memory.store.js";
import {
  fromWebUiMessagePackMongoDocument,
  toWebUiMessagePackMongoDocument,
  type WebUiMessagePackMongoDocument,
} from "./web-ui-message-pack.mongo-document.js";
import { validateWebUiMessageTreeAgainstEnglish } from "./web-ui-message-pack.validate.js";
import {
  getCachedPublishedWebUiRuntime,
  invalidatePublishedWebUiRuntimeCache,
  rememberPublishedWebUiRuntime,
  resetPublishedWebUiRuntimeCacheForTests,
  type PublishedWebUiRuntimePayload,
} from "./published-web-ui-runtime-cache.js";

/**
 * Public runtime miss projection. Omits sourceFingerprintsByPath and other
 * persistence-only fields. Admin/preparation reads do not use this projection.
 */
export const PUBLISHED_WEB_UI_RUNTIME_PROJECTION = {
  _id: 0,
  locale: 1,
  localeKey: 1,
  status: 1,
  revision: 1,
  messages: 1,
} as const;

type PublishedWebUiRuntimeMongoSlice = {
  locale: string;
  localeKey: string;
  status: WebUiMessagePackRecord["status"];
  revision: number;
  messages: WebUiMessageTree;
};

let publishedRuntimeStoreReads = 0;
let publishedRuntimeStoreReaderOverride: ((
  localeKey: string,
) => Promise<PublishedWebUiRuntimePayload | null>) | null = null;

let forceMemoryForTests = false;

export function setWebUiMessagePackForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetWebUiMessagePackStoreForTests(): void {
  resetWebUiMessagePackMemoryForTests();
  resetPublishedWebUiRuntimeCacheForTests();
  publishedRuntimeStoreReads = 0;
  publishedRuntimeStoreReaderOverride = null;
}

export function setPublishedWebUiRuntimeStoreReaderForTests(
  reader: ((localeKey: string) => Promise<PublishedWebUiRuntimePayload | null>) | null,
): void {
  publishedRuntimeStoreReaderOverride = reader;
}

export function getPublishedWebUiRuntimeStoreReadCountForTests(): number {
  return publishedRuntimeStoreReads;
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new WebUiMessagePackPersistenceError("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<WebUiMessagePackMongoDocument>(
    MONGO_COLLECTIONS.webUiMessagePacks,
  );
}

function packIdForLocale(locale: string): string {
  return `web-ui-pack-${normalizeLanguageRegistryLocaleKey(locale)}`;
}

export async function listWebUiMessagePacks(): Promise<readonly WebUiMessagePackRecord[]> {
  if (shouldUseMemoryAdapter()) {
    return listWebUiMessagePackMemory().sort((a, b) => a.locale.localeCompare(b.locale));
  }
  await ensureMongoReady();
  const docs = await collection().find({}).toArray();
  return docs
    .map((doc) => fromWebUiMessagePackMongoDocument(doc))
    .sort((a, b) => a.locale.localeCompare(b.locale));
}

export async function getWebUiMessagePackByLocale(
  locale: string,
): Promise<WebUiMessagePackRecord | null> {
  const localeKey = normalizeLanguageRegistryLocaleKey(locale);
  if (!localeKey) {
    return null;
  }
  if (shouldUseMemoryAdapter()) {
    return getWebUiMessagePackByLocaleMemory(localeKey);
  }
  await ensureMongoReady();
  const doc = await collection().findOne({ localeKey });
  return doc ? fromWebUiMessagePackMongoDocument(doc) : null;
}

export async function getPublishedWebUiMessagePackByLocale(
  locale: string,
): Promise<WebUiMessagePackRecord | null> {
  const pack = await getWebUiMessagePackByLocale(locale);
  if (!pack || pack.status !== "published") {
    return null;
  }
  return pack;
}

function toPublishedRuntimePayload(input: {
  readonly locale: string;
  readonly revision: number;
  readonly status: WebUiMessagePackRecord["status"];
  readonly messages: WebUiMessageTree;
}): PublishedWebUiRuntimePayload | null {
  if (input.status !== "published") {
    return null;
  }
  return {
    locale: input.locale,
    revision: input.revision,
    messages: input.messages,
    source: "remote",
  };
}

async function readPublishedWebUiRuntimeFromMongo(
  localeKey: string,
): Promise<PublishedWebUiRuntimePayload | null> {
  await ensureMongoReady();
  const doc = await collection().findOne({ localeKey }, {
    projection: PUBLISHED_WEB_UI_RUNTIME_PROJECTION,
  });
  if (!doc) {
    return null;
  }
  const slice = doc as PublishedWebUiRuntimeMongoSlice;
  return toPublishedRuntimePayload(slice);
}

async function readPublishedWebUiRuntimeFromStore(
  localeKey: string,
): Promise<PublishedWebUiRuntimePayload | null> {
  publishedRuntimeStoreReads += 1;
  if (publishedRuntimeStoreReaderOverride) {
    return publishedRuntimeStoreReaderOverride(localeKey);
  }
  if (shouldUseMemoryAdapter()) {
    const pack = getWebUiMessagePackByLocaleMemory(localeKey);
    if (!pack) {
      return null;
    }
    return toPublishedRuntimePayload(pack);
  }
  return readPublishedWebUiRuntimeFromMongo(localeKey);
}

/**
 * Public SSR/runtime read. Cache hit skips Mongo. Miss uses the public projection.
 * Full-document reads used by Admin and preparation stay on getWebUiMessagePackByLocale.
 */
export async function getPublishedWebUiRuntimePayload(
  locale: string,
): Promise<PublishedWebUiRuntimePayload | null> {
  const localeKey = normalizeLanguageRegistryLocaleKey(locale);
  if (!localeKey) {
    return null;
  }
  const cached = getCachedPublishedWebUiRuntime(localeKey);
  if (cached) {
    return cached;
  }
  const loaded = await readPublishedWebUiRuntimeFromStore(localeKey);
  if (!loaded) {
    return null;
  }
  rememberPublishedWebUiRuntime(localeKey, loaded);
  return loaded;
}

function assertWebUiMessageTreeForUpsert(messages: WebUiMessageTree): void {
  const validation = validateWebUiMessageTreeAgainstEnglish(messages);
  if (validation.rejectedUnknownPaths.length > 0) {
    throw new WebUiMessagePackValidationError(
      `Unknown WEB_UI paths (not in English catalog): ${validation.rejectedUnknownPaths
        .slice(0, 8)
        .join(", ")}`,
    );
  }
  if (validation.rejectedNonStringPaths.length > 0) {
    throw new WebUiMessagePackValidationError(
      `Non-string WEB_UI leaves: ${validation.rejectedNonStringPaths.slice(0, 8).join(", ")}`,
    );
  }
  if (validation.placeholderMismatchPaths.length > 0) {
    throw new WebUiMessagePackValidationError(
      `Placeholder or message structure mismatch: ${validation.placeholderMismatchPaths
        .slice(0, 8)
        .join("; ")}`,
    );
  }
}

function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/**
 * Trusted internal upsert (activation / packaged adoption / tests).
 * Unconditional — not exposed through Admin HTTP.
 */
export async function upsertWebUiMessagePack(
  input: WebUiMessagePackUpsertInput,
): Promise<WebUiMessagePackRecord> {
  const locale = input.locale.trim();
  const localeKey = normalizeLanguageRegistryLocaleKey(locale);
  if (!localeKey) {
    throw new WebUiMessagePackValidationError("locale is required.");
  }

  const status = input.status ?? "published";
  if (!isWebUiMessagePackStatus(status)) {
    throw new WebUiMessagePackValidationError("status must be draft or published.");
  }

  assertWebUiMessageTreeForUpsert(input.messages);

  const now = new Date().toISOString();
  const existing = await getWebUiMessagePackByLocale(locale);
  const record: WebUiMessagePackRecord = {
    packId: existing?.packId ?? packIdForLocale(locale),
    locale: existing?.locale ?? locale,
    revision: (existing?.revision ?? 0) + 1,
    status,
    messages: input.messages,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    updatedByParticipantId: input.updatedByParticipantId ?? null,
    sourceNote: input.sourceNote ?? null,
    sourceFingerprintsByPath:
      input.sourceFingerprintsByPath === undefined
        ? existing?.sourceFingerprintsByPath ?? null
        : input.sourceFingerprintsByPath,
  };

  if (shouldUseMemoryAdapter()) {
    upsertWebUiMessagePackMemory(record, localeKey);
    invalidatePublishedWebUiRuntimeCache(localeKey);
    return record;
  }

  await ensureMongoReady();
  await collection().updateOne(
    { localeKey },
    { $set: toWebUiMessagePackMongoDocument(record, localeKey) },
    { upsert: true },
  );
  invalidatePublishedWebUiRuntimeCache(localeKey);
  return record;
}

export type CompareAndSetWebUiMessagePackInput = {
  readonly locale: string;
  readonly messages: WebUiMessageTree;
  readonly status?: WebUiMessagePackUpsertInput["status"];
  readonly sourceNote?: string | null;
  readonly updatedByParticipantId?: string | null;
  readonly sourceFingerprintsByPath?: WebUiMessagePackUpsertInput["sourceFingerprintsByPath"];
  /** number = update at revision; null = create only. */
  readonly expectedRevision: WebUiMessagePackExpectedRevision;
};

/**
 * Admin optimistic concurrency: atomic compare-and-set by localeKey + revision.
 * Never uses GET-then-PUT as the concurrency mechanism.
 */
export async function compareAndSetWebUiMessagePack(
  input: CompareAndSetWebUiMessagePackInput,
): Promise<WebUiMessagePackRecord> {
  const locale = input.locale.trim();
  const localeKey = normalizeLanguageRegistryLocaleKey(locale);
  if (!localeKey) {
    throw new WebUiMessagePackValidationError("locale is required.");
  }

  const status = input.status ?? "published";
  if (!isWebUiMessagePackStatus(status)) {
    throw new WebUiMessagePackValidationError("status must be draft or published.");
  }

  if (
    input.expectedRevision !== null &&
    (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1)
  ) {
    throw new WebUiMessagePackValidationError(
      "expectedRevision must be a positive integer or null.",
    );
  }

  assertWebUiMessageTreeForUpsert(input.messages);

  const now = new Date().toISOString();
  const conflictMessage =
    input.expectedRevision === null
      ? `WEB_UI message pack already exists for locale ${locale}.`
      : `WEB_UI message pack revision conflict for locale ${locale} (expected ${input.expectedRevision}).`;

  if (input.expectedRevision === null) {
    const record: WebUiMessagePackRecord = {
      packId: packIdForLocale(locale),
      locale,
      revision: 1,
      status,
      messages: input.messages,
      createdAt: now,
      updatedAt: now,
      updatedByParticipantId: input.updatedByParticipantId ?? null,
      sourceNote: input.sourceNote ?? null,
      sourceFingerprintsByPath: input.sourceFingerprintsByPath ?? null,
    };

    if (shouldUseMemoryAdapter()) {
      const ok = compareAndSetWebUiMessagePackMemory({
        localeKey,
        expectedRevision: null,
        next: record,
      });
      if (!ok) {
        throw new WebUiMessagePackRevisionConflictError(conflictMessage);
      }
      invalidatePublishedWebUiRuntimeCache(localeKey);
      return record;
    }

    await ensureMongoReady();
    try {
      await collection().insertOne(toWebUiMessagePackMongoDocument(record, localeKey));
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw new WebUiMessagePackRevisionConflictError(conflictMessage);
      }
      throw error;
    }
    invalidatePublishedWebUiRuntimeCache(localeKey);
    return record;
  }

  const expectedRevision = input.expectedRevision;
  const nextRevision = expectedRevision + 1;

  if (shouldUseMemoryAdapter()) {
    const existing = getWebUiMessagePackByLocaleMemory(localeKey);
    if (!existing || existing.revision !== expectedRevision) {
      throw new WebUiMessagePackRevisionConflictError(conflictMessage);
    }
    const record: WebUiMessagePackRecord = {
      packId: existing.packId,
      locale: existing.locale,
      revision: nextRevision,
      status,
      messages: input.messages,
      createdAt: existing.createdAt,
      updatedAt: now,
      updatedByParticipantId: input.updatedByParticipantId ?? null,
      sourceNote: input.sourceNote ?? null,
      sourceFingerprintsByPath:
        input.sourceFingerprintsByPath === undefined
          ? existing.sourceFingerprintsByPath ?? null
          : input.sourceFingerprintsByPath,
    };
    const ok = compareAndSetWebUiMessagePackMemory({
      localeKey,
      expectedRevision,
      next: record,
    });
    if (!ok) {
      throw new WebUiMessagePackRevisionConflictError(conflictMessage);
    }
    invalidatePublishedWebUiRuntimeCache(localeKey);
    return record;
  }

  await ensureMongoReady();
  const setFields: Record<string, unknown> = {
    revision: nextRevision,
    status,
    messages: input.messages,
    updatedAt: now,
    updatedByParticipantId: input.updatedByParticipantId ?? null,
    sourceNote: input.sourceNote ?? null,
  };
  if (input.sourceFingerprintsByPath !== undefined) {
    setFields.sourceFingerprintsByPath = input.sourceFingerprintsByPath;
  }

  const doc = await collection().findOneAndUpdate(
    { localeKey, revision: expectedRevision },
    { $set: setFields },
    { returnDocument: "after" },
  );

  if (!doc) {
    throw new WebUiMessagePackRevisionConflictError(conflictMessage);
  }

  invalidatePublishedWebUiRuntimeCache(localeKey);
  return fromWebUiMessagePackMongoDocument(doc);
}

/**
 * Persist leaf fingerprints on an existing published pack.
 * Does not change messages, revision, or sourceNote, and does not validate again.
 */
export async function writePublishedWebUiSourceFingerprints(input: {
  readonly locale: string;
  readonly sourceFingerprintsByPath: Readonly<Record<string, string>>;
  readonly updatedAt: string;
}): Promise<WebUiMessagePackRecord | null> {
  const existing = await getPublishedWebUiMessagePackByLocale(input.locale);
  if (!existing) {
    return null;
  }
  const localeKey = normalizeLanguageRegistryLocaleKey(existing.locale);
  const record: WebUiMessagePackRecord = {
    ...existing,
    sourceFingerprintsByPath: input.sourceFingerprintsByPath,
    updatedAt: input.updatedAt,
  };
  if (shouldUseMemoryAdapter()) {
    upsertWebUiMessagePackMemory(record, localeKey);
    return record;
  }
  await ensureMongoReady();
  await collection().updateOne(
    { localeKey },
    {
      $set: {
        sourceFingerprintsByPath: input.sourceFingerprintsByPath,
        updatedAt: input.updatedAt,
      },
    },
  );
  return record;
}

export async function requireWebUiMessagePackByLocale(
  locale: string,
): Promise<WebUiMessagePackRecord> {
  const pack = await getWebUiMessagePackByLocale(locale);
  if (!pack) {
    throw new WebUiMessagePackNotFoundError(`WEB_UI message pack not found: ${locale}`);
  }
  return pack;
}
