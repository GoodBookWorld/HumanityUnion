/**
 * Reset 03E.10 — bounded carousel materializer (no live ops).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEDIA_PLP_ENTITY_TYPE,
} from "@hu/types";

import {
  MEDIA_PLP_CAROUSEL_MATERIALIZE_DEFAULT_LIMIT,
  MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX,
  classifyMediaPlpCarouselEntity,
  discoverMediaPlpCarouselStaticEntities,
  type MediaPlpCarouselEntityRow,
} from "../../../src/modules/language/media-plp-carousel/index.js";
import {
  assertMediaPlpCarouselMaterializerImportIsolation,
  parseMediaPlpCarouselMaterializerArgs,
  runMediaPlpCarouselMaterializer,
  selectMediaPlpCarouselMaterializeEntities,
} from "../../../src/modules/language/media-plp-carousel-materializer/index.js";
import type { MediaPlpMaterializerReport } from "../../../src/modules/language/media-plp-materializer/index.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalPrinciplePresentation,
  fingerprintMediaPlpCanonicalVersion,
  forcePublishedLocalizationPersistenceUnboundForTests,
  publishMediaPlpEntity,
  resetPublishedLocalizationPersistenceForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import { CIVIC_MEDIA_SELECTION_PRINCIPLES } from "../../../src/modules/civic-media-center/content/sections.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../..");

function row(
  partial: Partial<MediaPlpCarouselEntityRow> &
    Pick<MediaPlpCarouselEntityRow, "entityType" | "entityId" | "rebuildReason">,
): MediaPlpCarouselEntityRow {
  return {
    surface: "media_principle",
    route: "/media",
    canonicalVersion: "v1",
    plpFound: false,
    schema: null,
    usability: "REBUILD_REQUIRED",
    WOULD_REQUIRE_PROVIDER: true,
    translatableNodeCount: 3,
    payloadByteEstimate: 100,
    inWebBatch: true,
    inMaterializerSource: true,
    ...partial,
  };
}

function fakeMaterializerReport(
  overrides: Partial<MediaPlpMaterializerReport> = {},
): MediaPlpMaterializerReport {
  return {
    pack: "RESET_03B",
    operation: "materialize_media_plp",
    OPERATOR_MODE: "EXECUTE",
    ENTITY_TYPE: "civic_media_principle",
    ENTITY_ID: "x",
    LOCALE: "uk",
    CANONICAL_VERSION: "v1",
    SOURCE_FOUND: true,
    SOURCE_PUBLIC: true,
    PLP_CURRENT_FOUND: false,
    EXISTING_PLP_USABILITY: "REBUILD_REQUIRED",
    EXISTING_PLP_USABILITY_REASON: "NO_SNAPSHOT",
    CONTENT_INTEGRITY_STATUS: null,
    STRUCTURAL_INTEGRITY_STATUS: null,
    REBUILD_REQUIRED: true,
    EXISTING_TRANSLATION_STATE: "MISSING",
    EXISTING_TRANSLATION_COMPLETE: false,
    WOULD_REUSE_EXISTING_TRANSLATION: false,
    WOULD_CALL_PROVIDER: true,
    WOULD_PUBLISH_PLP: true,
    LOCALIZATION_SOURCE: "PROVIDER",
    PROVIDER_IMPORTED: true,
    PROVIDER_CALL_COUNT: 1,
    PROVIDER_EXECUTION_BOUNDARY: "THIN",
    PROVIDER_TRANSPORT: "fake_local",
    AUTO_NODE_COUNT: 3,
    PROVIDER_INPUT_BYTES: 40,
    PLP_WRITES: 1,
    CONTENT_TRANSLATION_WRITES: 0,
    SOURCE_WRITES: 0,
    PLP_OUTCOME: "PUBLISHED",
    PLP_PERSISTENCE_MODE: "MONGO",
    PLP_CURRENT_COLLECTION: "published_localized_presentations_current",
    PLP_HISTORY_COLLECTION: "published_localized_presentations_history",
    PLP_READ_DATABASE: "humanity_union_staging",
    PLP_WRITE_DATABASE: "humanity_union_staging",
    PLP_DURABILITY_VERIFIED: true,
    IMPORT_BOUNDARY_OK: true,
    RSS_GUARD_MB: 400,
    PRE_PROVIDER_RSS_GUARD_MB: 220,
    PROVIDER_INPUT_LIMIT_BYTES: 8192,
    HU_MEDIA_PLP_ENABLED: "true",
    database: "humanity_union_staging",
    MONGO_CLOSED: false,
    memory: {} as MediaPlpMaterializerReport["memory"],
    abortReason: null,
    ...overrides,
  };
}

describe("Reset 03E.10 — materialize:media-plp-carousel", () => {
  it("max 20 hard cap and default limit 20", () => {
    assert.equal(MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX, 20);
    assert.equal(MEDIA_PLP_CAROUSEL_MATERIALIZE_DEFAULT_LIMIT, 20);
    const many = Array.from({ length: 25 }, (_, i) =>
      row({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: `p-${i}`,
        rebuildReason: "NO_PUBLISHED_SNAPSHOT",
      }),
    );
    const selected = selectMediaPlpCarouselMaterializeEntities(many, 20);
    assert.equal(selected.ELIGIBLE, 25);
    assert.equal(selected.SELECTED_BY_LIMIT, 20);
    assert.equal(
      selected.skipped.filter((s) => s.reason === "LIMIT_EXCEEDED").length,
      5,
    );

    const over = parseMediaPlpCarouselMaterializerArgs([
      "node",
      "x",
      "--mongo",
      "--locale",
      "uk",
      "--limit",
      "21",
    ]);
    assert.equal(over.ok, false);
  });

  it("default dry-run; execute required", () => {
    const dry = parseMediaPlpCarouselMaterializerArgs([
      "node",
      "x",
      "--mongo",
      "--locale",
      "uk",
    ]);
    assert.equal(dry.ok, true);
    if (dry.ok) {
      assert.equal(dry.args.execute, false);
      assert.equal(dry.args.limit, 20);
    }
    const exec = parseMediaPlpCarouselMaterializerArgs([
      "node",
      "x",
      "--mongo",
      "--locale",
      "uk",
      "--execute",
    ]);
    assert.equal(exec.ok, true);
    if (exec.ok) {
      assert.equal(exec.args.execute, true);
    }
    assert.equal(
      parseMediaPlpCarouselMaterializerArgs([
        "node",
        "x",
        "--mongo",
        "--locale",
        "uk",
        "--continue-on-error",
      ]).ok,
      false,
    );
  });

  it("skips usable editorial-transparency, nodes=0, and Initiative sentinel", () => {
    const rows = [
      row({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: "editorial-transparency",
        rebuildReason: "NONE",
        usability: "USABLE_LOCALIZED",
        WOULD_REQUIRE_PROVIDER: false,
        plpFound: true,
      }),
      row({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        entityId: "zero-nodes",
        rebuildReason: "NO_PUBLISHED_SNAPSHOT",
        translatableNodeCount: 0,
      }),
      row({
        entityType: "initiative",
        entityId: "(rendered-initiative-id)",
        rebuildReason: "DOMAIN_NOT_YET_MIGRATED",
        usability: "DOMAIN_NOT_YET_MIGRATED",
        inMaterializerSource: false,
        translatableNodeCount: null,
      }),
      row({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
        entityId: "snopes",
        rebuildReason: "NO_PUBLISHED_SNAPSHOT",
      }),
    ];
    const selection = selectMediaPlpCarouselMaterializeEntities(rows, 20);
    assert.equal(selection.SKIPPED_USABLE, 1);
    assert.equal(selection.SKIPPED_ZERO_NODES, 1);
    assert.equal(selection.SKIPPED_DOMAIN, 1);
    assert.equal(selection.SELECTED_BY_LIMIT, 1);
    assert.equal(selection.selected[0]?.entityId, "snopes");
    assert.ok(
      selection.skipped.some(
        (s) => s.entityId === "editorial-transparency" && s.reason === "USABLE_LOCALIZED",
      ),
    );
    assert.ok(
      selection.skipped.some(
        (s) => s.reason === "ZERO_TRANSLATABLE_NODES",
      ),
    );
    assert.ok(
      selection.skipped.some((s) => s.reason === "DOMAIN_NOT_YET_MIGRATED"),
    );
  });

  it("dry-run: zero provider/writes; does not call materializeOne", async () => {
    let materializeCalls = 0;
    const result = await runMediaPlpCarouselMaterializer(
      ["node", "x", "--mongo", "--locale", "uk"],
      {
        skipImportBoundaryCheck: true,
        skipMongoPersistenceRequire: true,
        platformMode: "staging",
        resolveDatabase: () => "humanity_union_staging",
        isMongoConfigured: () => true,
        discoverRows: async () => [
          row({
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
            entityId: "correction-policy",
            rebuildReason: "NO_PUBLISHED_SNAPSHOT",
          }),
        ],
        materializeOne: async () => {
          materializeCalls += 1;
          return { exitCode: 0, report: null, errorMessage: "should not run" };
        },
      },
    );
    assert.equal(result.exitCode, 0);
    assert.equal(materializeCalls, 0);
    assert.equal(result.report?.OPERATOR_MODE, "DRY_RUN");
    assert.equal(result.report?.PROVIDER_CALLS_TOTAL, 0);
    assert.equal(result.report?.PLP_WRITES_TOTAL, 0);
    assert.equal(result.report?.SELECTED, 1);
    assert.equal(result.report?.selection.selected[0]?.wouldCallProvider, true);
  });

  it("sequential provider execution; no Promise.all fanout", async () => {
    const order: string[] = [];
    let concurrent = 0;
    let maxConcurrent = 0;
    const result = await runMediaPlpCarouselMaterializer(
      ["node", "x", "--mongo", "--locale", "uk", "--execute", "--limit", "3"],
      {
        skipImportBoundaryCheck: true,
        skipMongoPersistenceRequire: true,
        platformMode: "staging",
        resolveDatabase: () => "humanity_union_staging",
        isMongoConfigured: () => true,
        discoverRows: async () => [
          row({
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
            entityId: "a",
            rebuildReason: "NO_PUBLISHED_SNAPSHOT",
          }),
          row({
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
            entityId: "b",
            rebuildReason: "NO_PUBLISHED_SNAPSHOT",
          }),
          row({
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
            entityId: "c",
            rebuildReason: "NO_PUBLISHED_SNAPSHOT",
          }),
        ],
        materializeOne: async (input) => {
          concurrent += 1;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          order.push(input.entityId);
          await new Promise((r) => setTimeout(r, 5));
          concurrent -= 1;
          return {
            exitCode: 0,
            report: fakeMaterializerReport({
              ENTITY_ID: input.entityId,
              PLP_WRITES: 1,
              PROVIDER_CALL_COUNT: 1,
            }),
            errorMessage: null,
          };
        },
      },
    );
    assert.deepEqual(order, ["a", "b", "c"]);
    assert.equal(maxConcurrent, 1);
    assert.equal(result.report?.PUBLISHED, 3);
    assert.equal(result.report?.PROVIDER_CALLS_TOTAL, 3);
    assert.equal(result.report?.SOURCE_WRITES_TOTAL, 0);
    assert.equal(result.report?.CONTENT_TRANSLATION_WRITES_TOTAL, 0);
  });

  it("one failure stops later execution; prior publishes survive", async () => {
    const called: string[] = [];
    const result = await runMediaPlpCarouselMaterializer(
      ["node", "x", "--mongo", "--locale", "uk", "--execute"],
      {
        skipImportBoundaryCheck: true,
        skipMongoPersistenceRequire: true,
        platformMode: "staging",
        resolveDatabase: () => "humanity_union_staging",
        isMongoConfigured: () => true,
        discoverRows: async () => [
          row({
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
            entityId: "ok-first",
            rebuildReason: "NO_PUBLISHED_SNAPSHOT",
          }),
          row({
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
            entityId: "fail-mid",
            rebuildReason: "NO_PUBLISHED_SNAPSHOT",
          }),
          row({
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
            entityId: "never",
            rebuildReason: "NO_PUBLISHED_SNAPSHOT",
          }),
        ],
        materializeOne: async (input) => {
          called.push(input.entityId);
          if (input.entityId === "fail-mid") {
            return {
              exitCode: 1,
              report: fakeMaterializerReport({
                ENTITY_ID: input.entityId,
                PLP_WRITES: 0,
                PROVIDER_CALL_COUNT: 1,
                PLP_OUTCOME: null,
                abortReason: "PROVIDER_ERROR",
              }),
              errorMessage: "PROVIDER_ERROR",
            };
          }
          return {
            exitCode: 0,
            report: fakeMaterializerReport({
              ENTITY_ID: input.entityId,
              PLP_WRITES: 1,
              PROVIDER_CALL_COUNT: 1,
            }),
            errorMessage: null,
          };
        },
      },
    );
    assert.deepEqual(called, ["ok-first", "fail-mid"]);
    assert.equal(result.report?.PUBLISHED, 1);
    assert.equal(result.report?.FAILED, 1);
    assert.equal(result.report?.ABORT_REASON, "PROVIDER_ERROR");
    const never = result.report?.entities.find((e) => e.ENTITY_ID === "never");
    assert.equal(never?.OUTCOME, "SKIPPED_NOT_RUN");
    assert.equal(never?.PROVIDER_CALLS, 0);
  });

  it("durability failure aborts later entities", async () => {
    const called: string[] = [];
    const result = await runMediaPlpCarouselMaterializer(
      ["node", "x", "--mongo", "--locale", "uk", "--execute"],
      {
        skipImportBoundaryCheck: true,
        skipMongoPersistenceRequire: true,
        platformMode: "staging",
        resolveDatabase: () => "humanity_union_staging",
        isMongoConfigured: () => true,
        discoverRows: async () => [
          row({
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
            entityId: "dur-fail",
            rebuildReason: "NO_PUBLISHED_SNAPSHOT",
          }),
          row({
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
            entityId: "after",
            rebuildReason: "NO_PUBLISHED_SNAPSHOT",
          }),
        ],
        materializeOne: async (input) => {
          called.push(input.entityId);
          return {
            exitCode: 1,
            report: fakeMaterializerReport({
              ENTITY_ID: input.entityId,
              PLP_WRITES: 1,
              PROVIDER_CALL_COUNT: 1,
              PLP_DURABILITY_VERIFIED: false,
              PLP_OUTCOME: "DURABILITY_VERIFICATION_FAILED",
              abortReason: "DURABILITY_VERIFICATION_FAILED",
            }),
            errorMessage: "DURABILITY_VERIFICATION_FAILED",
          };
        },
      },
    );
    assert.deepEqual(called, ["dur-fail"]);
    assert.equal(result.report?.ABORT_REASON, "DURABILITY_VERIFICATION_FAILED");
    assert.equal(
      result.report?.entities.find((e) => e.ENTITY_ID === "after")?.OUTCOME,
      "SKIPPED_NOT_RUN",
    );
  });

  it("memory guard aborts before provider", async () => {
    let materializeCalls = 0;
    const result = await runMediaPlpCarouselMaterializer(
      ["node", "x", "--mongo", "--locale", "uk", "--execute"],
      {
        skipImportBoundaryCheck: true,
        skipMongoPersistenceRequire: true,
        platformMode: "staging",
        resolveDatabase: () => "humanity_union_staging",
        isMongoConfigured: () => true,
        preProviderMaxRssMb: 100,
        maxRssMb: 100,
        currentRssMb: () => 250,
        discoverRows: async () => [
          row({
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
            entityId: "too-big",
            rebuildReason: "NO_PUBLISHED_SNAPSHOT",
          }),
        ],
        materializeOne: async () => {
          materializeCalls += 1;
          return { exitCode: 0, report: fakeMaterializerReport(), errorMessage: null };
        },
      },
    );
    assert.equal(materializeCalls, 0);
    assert.match(result.report?.ABORT_REASON ?? "", /RSS_GUARD_EXCEEDED/);
    assert.equal(result.report?.entities[0]?.OUTCOME, "SKIPPED_NOT_RUN");
  });

  it("thin import graph remains clean; package script registered", () => {
    const isolation = assertMediaPlpCarouselMaterializerImportIsolation();
    assert.equal(isolation.ok, true, isolation.violations.join(","));
    const pkg = readFileSync(path.join(apiRoot, "package.json"), "utf8");
    assert.match(pkg, /materialize:media-plp-carousel/);
    const runner = readFileSync(
      path.join(
        apiRoot,
        "src/modules/language/media-plp-carousel-materializer/run-carousel-materializer.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(runner, /Promise\.all/);
    assert.match(runner, /await materializeOne/);
    assert.match(runner, /requireMediaPlpMaterializerMongoPersistence/);
  });
});

describe("Reset 03E.10.1 — batch Mongo PLP bootstrap parity", () => {
  beforeEach(() => {
    forcePublishedLocalizationPersistenceUnboundForTests();
  });

  afterEach(() => {
    resetPublishedLocalizationPersistenceForTests();
  });

  it("--mongo binds MONGO before carousel discovery", async () => {
    const events: string[] = [];
    const result = await runMediaPlpCarouselMaterializer(
      ["node", "x", "--mongo", "--locale", "uk"],
      {
        skipImportBoundaryCheck: true,
        platformMode: "staging",
        resolveDatabase: () => "humanity_union_staging",
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
        discoverRows: async () => {
          events.push("discover");
          return [
            row({
              entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
              entityId: "editorial-transparency",
              rebuildReason: "NONE",
              usability: "USABLE_LOCALIZED",
              WOULD_REQUIRE_PROVIDER: false,
              plpFound: true,
            }),
          ];
        },
      },
    );
    assert.deepEqual(events, ["require", "discover"]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.report?.PLP_PERSISTENCE_MODE, "MONGO");
    assert.equal(result.report?.PROVIDER_CALLS_TOTAL, 0);
    assert.equal(result.report?.PLP_WRITES_TOTAL, 0);
  });

  it("discovery can read an existing published PLP after bootstrap bind", async () => {
    // Fresh process starts UNBOUND; bind durable facade then classify existing snapshot.
    setPublishedLocalizationPersistenceModeForTests("memory");
    const principle = CIVIC_MEDIA_SELECTION_PRINCIPLES.find(
      (p) => p.id === "editorial-transparency",
    )!;
    const presentation = asMediaPlpPresentationNode(
      buildCanonicalPrinciplePresentation(principle),
    );
    const version = fingerprintMediaPlpCanonicalVersion(presentation);
    const published = await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
      entityId: principle.id,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: presentation,
      includeDeterministicMachine: true,
    });
    assert.equal(published.ok, true);

    const result = await runMediaPlpCarouselMaterializer(
      ["node", "x", "--mongo", "--locale", "uk"],
      {
        skipImportBoundaryCheck: true,
        skipMongoPersistenceRequire: true,
        platformMode: "staging",
        resolveDatabase: () => "humanity_union_staging",
        isMongoConfigured: () => true,
        requirePersistence: () => ({
          PLP_PERSISTENCE_MODE: "MONGO",
          PLP_CURRENT_COLLECTION: "published_localized_presentations_current",
          PLP_HISTORY_COLLECTION: "published_localized_presentations_history",
          PLP_READ_DATABASE: "humanity_union_staging",
          PLP_WRITE_DATABASE: "humanity_union_staging",
        }),
        discoverRows: async () => {
          const ref = discoverMediaPlpCarouselStaticEntities().find(
            (r) => r.entityId === "editorial-transparency",
          )!;
          return [await classifyMediaPlpCarouselEntity({ ref, locale: "uk" })];
        },
      },
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.report?.selection.SKIPPED_USABLE, 1);
    assert.equal(result.report?.SELECTED, 0);
    assert.equal(result.report?.PROVIDER_CALLS_TOTAL, 0);
    assert.equal(result.report?.PLP_WRITES_TOTAL, 0);
  });

  it("missing Mongo binding fails closed before discovery; no memory fallback", async () => {
    let discovered = false;
    const result = await runMediaPlpCarouselMaterializer(
      ["node", "x", "--mongo", "--locale", "uk"],
      {
        skipImportBoundaryCheck: true,
        platformMode: "staging",
        resolveDatabase: () => "humanity_union_staging",
        isMongoConfigured: () => true,
        requirePersistence: () => {
          throw new Error(
            "PLP persistence still on memory while MONGODB_URI is configured (bootstrap missing)",
          );
        },
        discoverRows: async () => {
          discovered = true;
          return [];
        },
      },
    );
    assert.equal(discovered, false);
    assert.equal(result.exitCode, 1);
    assert.equal(result.report, null);
    assert.match(result.errorMessage ?? "", /bootstrap missing|memory/i);
  });

  it("refuses non-MONGO persistence mode without skip (no silent MEMORY)", async () => {
    let discovered = false;
    const result = await runMediaPlpCarouselMaterializer(
      ["node", "x", "--mongo", "--locale", "uk"],
      {
        skipImportBoundaryCheck: true,
        platformMode: "staging",
        resolveDatabase: () => "humanity_union_staging",
        isMongoConfigured: () => true,
        requirePersistence: () => ({
          PLP_PERSISTENCE_MODE: "MEMORY",
          PLP_CURRENT_COLLECTION: "x",
          PLP_HISTORY_COLLECTION: "y",
          PLP_READ_DATABASE: null,
          PLP_WRITE_DATABASE: null,
        }),
        discoverRows: async () => {
          discovered = true;
          return [];
        },
      },
    );
    assert.equal(discovered, false);
    assert.equal(result.report, null);
    assert.match(result.errorMessage ?? "", /not MONGO/);
    assert.ok(result.exitCode !== 0);
  });

  it("execute path still sequential and max 20 after bootstrap", async () => {
    const order: string[] = [];
    const result = await runMediaPlpCarouselMaterializer(
      ["node", "x", "--mongo", "--locale", "uk", "--execute", "--limit", "2"],
      {
        skipImportBoundaryCheck: true,
        platformMode: "staging",
        resolveDatabase: () => "humanity_union_staging",
        isMongoConfigured: () => true,
        requirePersistence: () => ({
          PLP_PERSISTENCE_MODE: "MONGO",
          PLP_CURRENT_COLLECTION: "published_localized_presentations_current",
          PLP_HISTORY_COLLECTION: "published_localized_presentations_history",
          PLP_READ_DATABASE: "humanity_union_staging",
          PLP_WRITE_DATABASE: "humanity_union_staging",
        }),
        discoverRows: async () =>
          Array.from({ length: 5 }, (_, i) =>
            row({
              entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
              entityId: `p-${i}`,
              rebuildReason: "NO_PUBLISHED_SNAPSHOT",
            }),
          ),
        materializeOne: async (input) => {
          order.push(input.entityId);
          return {
            exitCode: 0,
            report: fakeMaterializerReport({
              ENTITY_ID: input.entityId,
              PLP_WRITES: 1,
              PROVIDER_CALL_COUNT: 1,
            }),
            errorMessage: null,
          };
        },
      },
    );
    assert.deepEqual(order, ["p-0", "p-1"]);
    assert.equal(result.report?.SELECTED, 2);
    assert.equal(result.report?.PLP_PERSISTENCE_MODE, "MONGO");
  });
});
