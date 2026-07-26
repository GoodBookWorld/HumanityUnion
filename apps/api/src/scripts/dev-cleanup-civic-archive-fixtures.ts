import fs from "node:fs";
import path from "node:path";

import type { Document, Filter } from "mongodb";

import type { PublicCivicArchiveRecord } from "@hu/types";

import { API_ROOT, loadApiEnvironment } from "../config/load-api-environment.js";
import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../infrastructure/mongodb/mongo-database.js";
import { loadRecordMap } from "../infrastructure/mongodb/mongo-snapshot-store.js";
import { isPublicVerificationFixtureRecord } from "../modules/public-civic-archive/public-civic-archive-fixture-guard.js";

loadApiEnvironment();

const DEFAULT_FILE_PATH = path.resolve(API_ROOT, ".runtime/public-civic-archive.json");
const BLOCKED_DATABASES = new Set(["humanity_union", "humanity_union_prod", "production"]);

function assertDevelopmentCleanupAllowed(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run fixture cleanup in production.");
  }

  const database = process.env.MONGODB_DATABASE?.trim();

  if (database && BLOCKED_DATABASES.has(database)) {
    throw new Error(`Refusing to run fixture cleanup against protected database "${database}".`);
  }
}

function cleanupFilePersistence(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    console.log(`File persistence (${path.basename(filePath)}): file not found.`);
    return 0;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
    version?: number;
    records?: Record<string, PublicCivicArchiveRecord>;
  };

  if (!parsed.records) {
    return 0;
  }

  let removed = 0;
  const nextRecords: Record<string, PublicCivicArchiveRecord> = {};

  for (const [archiveRecordId, record] of Object.entries(parsed.records)) {
    if (isPublicVerificationFixtureRecord(record)) {
      removed += 1;
      continue;
    }

    nextRecords[archiveRecordId] = record;
  }

  if (removed > 0) {
    fs.writeFileSync(
      filePath,
      `${JSON.stringify({ version: 1, records: nextRecords }, null, 2)}\n`,
      "utf-8",
    );
  }

  console.log(
    `File persistence (${path.basename(filePath)}): removed ${removed} verification fixture record(s).`,
  );

  return removed;
}

async function cleanupMongoDevFixtures(): Promise<number> {
  if (!isMongoConfigured()) {
    console.log("MongoDB not configured; skipping Mongo cleanup.");
    return 0;
  }

  const database = process.env.MONGODB_DATABASE?.trim();

  if (!database || database !== "humanity_union_dev") {
    console.log(
      `Skipping Mongo cleanup because MONGODB_DATABASE is "${database ?? "unset"}" (expected humanity_union_dev).`,
    );
    return 0;
  }

  await connectMongoClient();
  const records = await loadRecordMap<PublicCivicArchiveRecord>(
    MONGO_COLLECTIONS.publicCivicArchiveRecords,
    "archiveRecordId",
  );

  const fixtureIds = Object.values(records)
    .filter((record) => isPublicVerificationFixtureRecord(record))
    .map((record) => record.archiveRecordId);

  if (fixtureIds.length === 0) {
    await disconnectMongoClient().catch(() => undefined);
    console.log(
      `MongoDB collection "${MONGO_COLLECTIONS.publicCivicArchiveRecords}": removed 0 verification fixture record(s).`,
    );
    return 0;
  }

  const collection = getMongoCollection(MONGO_COLLECTIONS.publicCivicArchiveRecords);
  const deleteResult = await collection.deleteMany({
    archiveRecordId: { $in: fixtureIds },
  } as unknown as Filter<Document>);
  await disconnectMongoClient().catch(() => undefined);

  const removed = deleteResult.deletedCount ?? fixtureIds.length;
  console.log(
    `MongoDB collection "${MONGO_COLLECTIONS.publicCivicArchiveRecords}": removed ${removed} verification fixture record(s).`,
  );

  return removed;
}

async function main(): Promise<void> {
  assertDevelopmentCleanupAllowed();

  const filePath = process.env.PUBLIC_CIVIC_ARCHIVE_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
  const fileRemoved = cleanupFilePersistence(filePath);
  const mongoRemoved = await cleanupMongoDevFixtures();

  const { reloadArchiveRecordsFromPersistence, removePublicVerificationFixtureRecords } =
    await import("../modules/public-civic-archive/public-civic-archive.store.js");

  reloadArchiveRecordsFromPersistence();
  const runtimeRemoved = removePublicVerificationFixtureRecords();
  reloadArchiveRecordsFromPersistence();

  console.log(
    `Runtime archive store reload removed ${runtimeRemoved} in-memory fixture record(s).`,
  );

  if (fileRemoved === 0 && mongoRemoved === 0 && runtimeRemoved === 0) {
    console.log("No TASK-107 verification fixtures were found.");
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
