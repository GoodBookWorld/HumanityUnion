/**
 * WEB_UI message pack repository — Mongo + memory (Brand Localization pattern).
 */

import type { WebUiMessagePackRecord, WebUiMessagePackUpsertInput } from "@hu/types";
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
  WebUiMessagePackValidationError,
} from "./web-ui-message-pack.errors.js";
import {
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

let forceMemoryForTests = false;

export function setWebUiMessagePackForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetWebUiMessagePackStoreForTests(): void {
  resetWebUiMessagePackMemoryForTests();
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

  const validation = validateWebUiMessageTreeAgainstEnglish(input.messages);
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
  };

  if (shouldUseMemoryAdapter()) {
    upsertWebUiMessagePackMemory(record, localeKey);
    return record;
  }

  await ensureMongoReady();
  await collection().updateOne(
    { localeKey },
    { $set: toWebUiMessagePackMongoDocument(record, localeKey) },
    { upsert: true },
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
