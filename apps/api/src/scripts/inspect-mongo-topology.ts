/**
 * READ-ONLY MongoDB collection topology inspector.
 *
 * Lists database names and collection counts only.
 * Never prints URI/credentials, document content, or user data.
 * Never creates, deletes, or drops anything.
 *
 * Usage (RENDER API WEB SHELL or local with staging/dev URI configured):
 *   pnpm --filter @hu/api inspect:mongo-topology
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { MongoClient } from "mongodb";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const CANONICAL_DB_HINTS = new Set([
  "humanity_union_staging",
  "humanity_union_dev",
  "humanity_union_production",
  "humanity_union",
]);

function classifyDatabase(name: string): string {
  if (name.startsWith("hu_test_")) {
    return "TEST_LEAK_OR_ACTIVE_TEST";
  }
  if (name.startsWith("hu_verify_")) {
    return "VERIFY_LEAK_OR_ACTIVE_VERIFY";
  }
  if (CANONICAL_DB_HINTS.has(name)) {
    return "CANONICAL_CANDIDATE";
  }
  if (name === "admin" || name === "local" || name === "config") {
    return "SYSTEM";
  }
  return "UNKNOWN";
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("MONGODB_URI is not configured.");
    process.exitCode = 1;
    return;
  }

  // Never log the URI.
  console.log("Mongo collection topology (read-only)");
  console.log("=====================================");

  const client = new MongoClient(uri, {
    connectTimeoutMS: 15_000,
    serverSelectionTimeoutMS: 15_000,
  });

  try {
    await client.connect();
    const admin = client.db().admin();
    const { databases } = await admin.listDatabases({ nameOnly: false });

    let totalCollections = 0;
    const rows: Array<{
      name: string;
      collections: number;
      classification: string;
    }> = [];

    for (const entry of databases) {
      const name = entry.name;
      const classification = classifyDatabase(name);
      if (classification === "SYSTEM") {
        continue;
      }

      const db = client.db(name);
      const collections = await db.listCollections({}, { nameOnly: true }).toArray();
      const count = collections.length;
      totalCollections += count;
      rows.push({
        name,
        collections: count,
        classification,
      });
    }

    rows.sort((a, b) => b.collections - a.collections || a.name.localeCompare(b.name));

    console.log(`Total non-system databases: ${rows.length}`);
    console.log(`Total collections (sum across listed DBs): ${totalCollections}`);
    console.log("Atlas shared-tier hard limit (typical): 500 collections / cluster");
    console.log("");
    console.log("Database summary:");
    for (const row of rows) {
      console.log(
        `- ${row.name}: ${row.collections} collection(s) [${row.classification}]`,
      );
    }

    const testLike = rows.filter(
      (row) =>
        row.classification === "TEST_LEAK_OR_ACTIVE_TEST" ||
        row.classification === "VERIFY_LEAK_OR_ACTIVE_VERIFY",
    );
    const testCollections = testLike.reduce((sum, row) => sum + row.collections, 0);
    console.log("");
    console.log(`hu_test_*/hu_verify_* databases: ${testLike.length}`);
    console.log(`hu_test_*/hu_verify_* collections: ${testCollections}`);

    for (const canonical of ["humanity_union_staging", "humanity_union_dev"]) {
      const match = rows.find((row) => row.name === canonical);
      if (!match) {
        console.log("");
        console.log(`${canonical}: not present on this cluster`);
        continue;
      }
      console.log("");
      console.log(`${canonical} collection names (${match.collections}):`);
      const names = (
        await client.db(canonical).listCollections({}, { nameOnly: true }).toArray()
      )
        .map((item) => item.name)
        .sort();
      for (const collectionName of names) {
        console.log(`  - ${collectionName}`);
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
