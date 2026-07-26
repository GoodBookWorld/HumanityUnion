import type { MemberPreferences } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { buildDefaultMemberPreferences } from "./preferences.defaults.js";
import { normalizeParticipationGeographyLegacy } from "@hu/geography";
import {
  PreferencesNotFoundError,
  PreferencesPersistenceUnavailableError,
} from "./preferences.errors.js";
import { samplePreferences } from "./preferences.sample.js";

interface MemberPreferencesDocument extends MemberPreferences {
  _id?: string;
}

const memoryStore = new Map<string, MemberPreferences>([
  [samplePreferences.memberId, structuredClone(samplePreferences)],
]);

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new PreferencesPersistenceUnavailableError();
  }

  await connectMongoClient();
}

function stripDocument(document: MemberPreferencesDocument): MemberPreferences {
  const { _id: _ignored, ...record } = document;
  return record;
}

function migrateLegacyPreferences(preferences: MemberPreferences): MemberPreferences {
  const defaults = buildDefaultMemberPreferences({ memberId: preferences.memberId });

  return {
    ...defaults,
    ...preferences,
    experiencePreferences: {
      ...defaults.experiencePreferences,
      ...preferences.experiencePreferences,
    },
    participationPreferences: normalizeParticipationGeographyLegacy({
      ...defaults.participationPreferences,
      ...preferences.participationPreferences,
    }),
    communicationPreferences: {
      ...defaults.communicationPreferences,
      ...preferences.communicationPreferences,
    },
    accessibilityPreferences: {
      ...defaults.accessibilityPreferences,
      ...preferences.accessibilityPreferences,
    },
    workspacePreferences: {
      ...defaults.workspacePreferences,
      ...preferences.workspacePreferences,
    },
    visibilityPreferences: {
      ...defaults.visibilityPreferences,
      ...(preferences.visibilityPreferences ?? {}),
    },
  };
}

export async function findPreferencesByMemberId(
  memberId: string,
): Promise<MemberPreferences | null> {
  if (isMongoConfigured()) {
    await ensureMongoReady();
    const collection = getMongoCollection<MemberPreferencesDocument>(
      MONGO_COLLECTIONS.memberPreferences,
    );
    const document = await collection.findOne({ memberId });
    return document ? migrateLegacyPreferences(stripDocument(document)) : null;
  }

  const stored = memoryStore.get(memberId);
  return stored ? migrateLegacyPreferences(structuredClone(stored)) : null;
}

export async function insertPreferences(
  preferences: MemberPreferences,
): Promise<MemberPreferences> {
  const record = migrateLegacyPreferences(preferences);

  if (isMongoConfigured()) {
    await ensureMongoReady();
    const collection = getMongoCollection<MemberPreferencesDocument>(
      MONGO_COLLECTIONS.memberPreferences,
    );
    await collection.insertOne(record);
    return record;
  }

  memoryStore.set(record.memberId, structuredClone(record));
  return record;
}

export async function updatePreferencesRecord(
  memberId: string,
  preferences: MemberPreferences,
): Promise<MemberPreferences | null> {
  const record = migrateLegacyPreferences(preferences);

  if (isMongoConfigured()) {
    await ensureMongoReady();
    const collection = getMongoCollection<MemberPreferencesDocument>(
      MONGO_COLLECTIONS.memberPreferences,
    );
    const result = await collection.findOneAndUpdate(
      { memberId },
      { $set: record },
      { returnDocument: "after" },
    );

    return result ? migrateLegacyPreferences(stripDocument(result)) : null;
  }

  if (!memoryStore.has(memberId)) {
    return null;
  }

  memoryStore.set(memberId, structuredClone(record));
  return record;
}

export async function listAllPreferencesRecords(): Promise<MemberPreferences[]> {
  if (isMongoConfigured()) {
    await ensureMongoReady();
    const collection = getMongoCollection<MemberPreferencesDocument>(
      MONGO_COLLECTIONS.memberPreferences,
    );
    const documents = await collection.find({}).toArray();
    return documents.map((document) => migrateLegacyPreferences(stripDocument(document)));
  }

  return [...memoryStore.values()].map((record) =>
    migrateLegacyPreferences(structuredClone(record)),
  );
}

export async function getOrCreatePreferencesForMember(input: {
  memberId: string;
  userId?: string;
}): Promise<MemberPreferences> {
  const existing = await findPreferencesByMemberId(input.memberId);

  if (existing) {
    return existing;
  }

  return insertPreferences(
    buildDefaultMemberPreferences({
      memberId: input.memberId,
      userId: input.userId,
    }),
  );
}

export async function requirePreferencesByMemberId(memberId: string): Promise<MemberPreferences> {
  const preferences = await findPreferencesByMemberId(memberId);

  if (!preferences) {
    throw new PreferencesNotFoundError();
  }

  return preferences;
}
