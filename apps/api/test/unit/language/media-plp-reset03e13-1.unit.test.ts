/**
 * Reset 03E.13.1 — news parity diagnostic Mongo bootstrap parity.
 * No Gemini / materialize / Mongo writes / live ops.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  runMediaPlpNewsParityDiagnostic,
  type MediaPlpNewsParityReport,
} from "../../../src/modules/language/media-plp-carousel/news-parity-diagnostic.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function emptyReport(
  mode: "MONGO" | "MEMORY" | "UNSET" = "MONGO",
): MediaPlpNewsParityReport {
  return {
    pack: "RESET_03E.13",
    locale: "uk",
    PLP_PERSISTENCE_MODE: mode,
    CONSUMER_NEWS_COUNT: 0,
    LEGACY_NEWEST_COUNT: 0,
    OVERLAP_WITH_LEGACY_NEWEST: 0,
    FOUND_AND_MATCHING: 0,
    CANONICAL_FALLBACK: 0,
    PROVIDER_CALLS: 0,
    PLP_WRITES: 0,
    MONGO_WRITES: 0,
    rows: [],
  };
}

describe("Reset 03E.13.1 — news parity Mongo bootstrap", () => {
  it("--mongo binds MONGO then connects before first Mongo-backed read", async () => {
    const events: string[] = [];
    const result = await runMediaPlpNewsParityDiagnostic(
      { locale: "uk" },
      {
        isMongoConfigured: () => true,
        requirePersistence: () => {
          events.push("require");
          return {
            PLP_PERSISTENCE_MODE: "MONGO",
            PLP_CURRENT_COLLECTION: "published_localized_presentations_current",
            PLP_HISTORY_COLLECTION: "published_localized_presentations_history",
            PLP_READ_DATABASE: "humanity_union_staging",
            PLP_WRITE_DATABASE: "humanity_union_staging",
          };
        },
        connect: async () => {
          events.push("connect");
        },
        disconnect: async () => {
          events.push("disconnect");
        },
        executeReads: async () => {
          events.push("read");
          return emptyReport("MONGO");
        },
      },
    );
    assert.deepEqual(events, ["require", "connect", "read", "disconnect"]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.report?.PLP_PERSISTENCE_MODE, "MONGO");
    assert.equal(result.report?.PROVIDER_CALLS, 0);
    assert.equal(result.report?.PLP_WRITES, 0);
    assert.equal(result.report?.MONGO_WRITES, 0);
  });

  it("refuses MEMORY persistence; never connects or reads", async () => {
    const events: string[] = [];
    const result = await runMediaPlpNewsParityDiagnostic(
      { locale: "uk" },
      {
        isMongoConfigured: () => true,
        requirePersistence: () => {
          events.push("require");
          return {
            PLP_PERSISTENCE_MODE: "MEMORY",
            PLP_CURRENT_COLLECTION: "x",
            PLP_HISTORY_COLLECTION: "y",
            PLP_READ_DATABASE: null,
            PLP_WRITE_DATABASE: null,
          };
        },
        connect: async () => {
          events.push("connect");
        },
        disconnect: async () => {
          events.push("disconnect");
        },
        executeReads: async () => {
          events.push("read");
          return emptyReport("MEMORY");
        },
      },
    );
    assert.deepEqual(events, ["require"]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.report, null);
    assert.match(result.errorMessage ?? "", /not MONGO|memory/i);
  });

  it("missing persistence bind fails closed before connect/read", async () => {
    const events: string[] = [];
    const result = await runMediaPlpNewsParityDiagnostic(
      { locale: "uk" },
      {
        isMongoConfigured: () => true,
        requirePersistence: () => {
          events.push("require");
          throw new Error(
            "PLP persistence still on memory while MONGODB_URI is configured (bootstrap missing)",
          );
        },
        connect: async () => {
          events.push("connect");
        },
        executeReads: async () => {
          events.push("read");
          return emptyReport();
        },
      },
    );
    assert.deepEqual(events, ["require"]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.report, null);
    assert.match(result.errorMessage ?? "", /bootstrap missing|memory/i);
  });

  it("disconnect runs after read failure", async () => {
    const events: string[] = [];
    const result = await runMediaPlpNewsParityDiagnostic(
      { locale: "uk" },
      {
        isMongoConfigured: () => true,
        requirePersistence: () => {
          events.push("require");
          return {
            PLP_PERSISTENCE_MODE: "MONGO",
            PLP_CURRENT_COLLECTION: "published_localized_presentations_current",
            PLP_HISTORY_COLLECTION: "published_localized_presentations_history",
            PLP_READ_DATABASE: "humanity_union_staging",
            PLP_WRITE_DATABASE: "humanity_union_staging",
          };
        },
        connect: async () => {
          events.push("connect");
        },
        disconnect: async () => {
          events.push("disconnect");
        },
        executeReads: async () => {
          events.push("read");
          throw new Error("simulated read failure");
        },
      },
    );
    assert.deepEqual(events, ["require", "connect", "read", "disconnect"]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.report, null);
    assert.match(result.errorMessage ?? "", /simulated read failure/);
  });

  it("source wiring: connect before getMongoCollection / select; disconnect in finally", () => {
    const diag = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-carousel/news-parity-diagnostic.ts",
      ),
      "utf8",
    );
    const script = readFileSync(
      join(apiRoot, "src/scripts/diagnose-media-plp-news-parity.ts"),
      "utf8",
    );
    assert.match(diag, /connectMongoClient/);
    assert.match(diag, /disconnectMongoClient/);
    assert.match(diag, /requireMediaPlpMaterializerMongoPersistence/);
    assert.match(diag, /03E\.13\.1/);
    assert.match(diag, /Refusing silent memory fallback/);
    assert.doesNotMatch(diag, /gemini|thin-gemini|GEMINI_API_KEY|materializeMediaPlp/);
    assert.match(script, /runMediaPlpNewsParityDiagnostic/);
    assert.match(script, /result\.exitCode/);
  });
});
