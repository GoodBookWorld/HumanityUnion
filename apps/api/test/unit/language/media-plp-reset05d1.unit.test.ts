/**
 * RESET 05D.1 — live-closure diagnostic thin Mongo bootstrap.
 * No Gemini / materialize / Mongo writes / live ops.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  runMediaLiveClosureDiagnostic,
  type MediaLiveClosureReport,
} from "../../../src/modules/language/media-plp-carousel/media-live-closure-diagnostic.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function emptyReport(
  mode: "MONGO" | "MEMORY" | "UNSET" = "MONGO",
): MediaLiveClosureReport {
  return {
    pack: "RESET_05D",
    operation: "diagnose_media_live_closure",
    readOnly: true,
    PROVIDER_CALLS_FROM_READ: 0,
    PLP_WRITES_FROM_READ: 0,
    MONGO_WRITES_FROM_READ: 0,
    PLP_PERSISTENCE_MODE: mode,
    locale: "uk",
    countryCode: "UA",
    MEDIA_RSS_TOTAL: 0,
    MEDIA_RSS_LOCALIZED: 0,
    MEDIA_RSS_FALLBACK: 0,
    COUNTRY_RSS_TOTAL: 0,
    COUNTRY_AFFILIATED_SOURCE_COUNT: 0,
    COUNTRY_AFFILIATED_SOURCE_IDS: [],
    COUNTRY_AFFILIATED_CURRENT_NEWS: 0,
    COUNTRY_RELEVANT_COUNT: 0,
    COUNTRY_RELEVANT_INCLUDED: 0,
    COUNTRY_RELEVANT_EXCLUDED: 0,
    COUNTRY_GLOBAL_SUPPLEMENT_COUNT: 0,
    COUNTRY_SOURCE_COVERAGE_GAP: false,
    EDITORIAL_MODE: "CANONICAL_FALLBACK",
    EDITORIAL_CANONICAL_LEAVES: 0,
    EDITORIAL_CURRENT_CANONICAL_VERSION: "",
    EDITORIAL_WORK_ROW_FOUND: false,
    EDITORIAL_WORK_STATUS: null,
    EDITORIAL_FAILURE_CODE: null,
    EDITORIAL_FAILURE_STAGE: null,
    EDITORIAL_FAILURE_REASON_SAFE: null,
    EDITORIAL_WORK_CANONICAL_VERSION: null,
    EDITORIAL_ATTEMPT_COUNT: null,
    EDITORIAL_MAX_ATTEMPTS: null,
    EDITORIAL_RETRYABLE: null,
    EDITORIAL_SNAPSHOT_FOUND: false,
    EDITORIAL_SNAPSHOT_CANONICAL_VERSION: null,
    EDITORIAL_SNAPSHOT_SCHEMA_VERSION: null,
    EDITORIAL_SNAPSHOT_USABLE: false,
    EDITORIAL_RESOLVER_MODE: "CANONICAL_FALLBACK",
    EDITORIAL_RESOLVER_FALLBACK_REASON: null,
    EDITORIAL_WORK_TRIGGER: null,
    EDITORIAL_PARTIAL_AUTO_PATHS: [],
    EDITORIAL_CANONICAL_IDENTICAL_TRANSLATABLE_PATHS: [],
    EDITORIAL_INTEGRITY_FAILED_PATHS: [],
    FAQ_MACHINE_LEAVES: 0,
    FAQ_MACHINE_LOCALIZED: 0,
    FAQ_CANONICAL_MACHINE_LEAVES: 0,
    FAQ_BRAND_TOKENS: 0,
    FAQ_BRAND_RESOLVED: 0,
    MIXED_SEMANTIC_OWNERSHIP: 0,
    IDENTITY_MISMATCHES: 0,
    CONSUMER_BYPASSES: 0,
    ok: false,
    mediaRssRows: [],
    leaves: [],
  };
}

describe("RESET 05D.1 — media-live-closure Mongo bootstrap", () => {
  it("--mongo binds MONGO then connects before first repository read", async () => {
    const events: string[] = [];
    const result = await runMediaLiveClosureDiagnostic(
      {
        locale: "uk",
        countryCode: "UA",
        countryName: "Ukraine",
        regionName: "",
      },
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
    assert.equal(result.exitCode, 2);
    assert.equal(result.report?.PLP_PERSISTENCE_MODE, "MONGO");
    assert.equal(result.report?.PROVIDER_CALLS_FROM_READ, 0);
    assert.equal(result.report?.PLP_WRITES_FROM_READ, 0);
    assert.equal(result.report?.MONGO_WRITES_FROM_READ, 0);
    assert.equal(result.report?.readOnly, true);
  });

  it("refuses MEMORY persistence; never connects or reads", async () => {
    const events: string[] = [];
    const result = await runMediaLiveClosureDiagnostic(
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

  it("disconnect runs after read failure", async () => {
    const events: string[] = [];
    const result = await runMediaLiveClosureDiagnostic(
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
    assert.match(result.errorMessage ?? "", /simulated read failure/);
  });

  it("CLI script wires runMediaLiveClosureDiagnostic after --mongo; no heavy bootstrapMongoPersistence", () => {
    const script = readFileSync(
      join(apiRoot, "src/scripts/diagnose-media-live-closure.ts"),
      "utf8",
    );
    const diag = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-carousel/media-live-closure-diagnostic.ts",
      ),
      "utf8",
    );
    assert.match(script, /runMediaLiveClosureDiagnostic/);
    assert.match(script, /--mongo/);
    assert.doesNotMatch(script, /bootstrapMongoPersistence/);
    assert.match(diag, /connectMongoClient/);
    assert.match(diag, /requireMediaPlpMaterializerMongoPersistence/);
    assert.match(diag, /disconnectMongoClient/);
    assert.doesNotMatch(diag, /bootstrapMongoPersistence/);
    assert.doesNotMatch(diag, /gemini|thin-gemini|TranslationProvider/);
    assert.doesNotMatch(diag, /enqueuePlpBuildRequest|markPlpAutoBuildWorkFailed/);
    assert.doesNotMatch(diag, /materializeMediaPlp|materialize:media-plp/);
  });
});
