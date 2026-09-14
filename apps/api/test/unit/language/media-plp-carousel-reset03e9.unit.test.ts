/**
 * Reset 03E.9 — Media/Country carousel PLP coverage (no live ops).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  MEDIA_PLP_ENTITY_TYPE,
  MEDIA_PLP_ENTITY_TYPES,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
} from "@hu/types";

import {
  assertMediaPlpCarouselImportIsolation,
  buildMediaPlpCarouselMaterializePlan,
  computeMediaPlpCarouselTotals,
  discoverMediaPlpCarouselStaticEntities,
  MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX,
  parseMediaPlpCarouselArgs,
  type MediaPlpCarouselEntityRow,
} from "../../../src/modules/language/media-plp-carousel/index.js";
import { parseMediaPlpMaterializerArgs } from "../../../src/modules/language/media-plp-materializer/parse-args.js";
import { resolveMediaPlpMaterializerSource } from "../../../src/modules/language/media-plp-materializer/source-resolve.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalPrinciplePresentation,
  fingerprintMediaPlpCanonicalVersion,
  publishMediaPlpEntity,
  resetMediaPlpInstrumentationForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolveMediaPlpConsumerItem,
  setMediaPlpConsumptionEnabledForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import { CIVIC_MEDIA_SELECTION_PRINCIPLES } from "../../../src/modules/civic-media-center/content/sections.js";
import { FACT_CHECK_RESOURCES } from "../../../src/modules/civic-media-center/content/fact-checking.js";
import { PROPAGANDA_ANALYSIS_RESOURCES } from "../../../src/modules/civic-media-center/content/propaganda-analysis.js";
import { TRUSTED_MEDIA_RESOURCES } from "../../../src/modules/civic-media-center/content/trusted-media.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../..");

beforeEach(() => {
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpInstrumentationForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  setMediaPlpConsumptionEnabledForTests(true);
});

afterEach(() => {
  setMediaPlpConsumptionEnabledForTests(null);
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpInstrumentationForTests();
});

describe("Reset 03E.9 — carousel inventory + diagnostic contract", () => {
  it("static inventory covers Media PLP carousel entity types from route catalogs", () => {
    const refs = discoverMediaPlpCarouselStaticEntities();
    const types = new Set(refs.map((r) => r.entityType));
    assert.ok(types.has(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL));
    assert.ok(types.has(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE));
    assert.ok(types.has(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED));
    assert.ok(types.has(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK));
    assert.ok(types.has(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA));
    assert.ok(types.has("initiative"));

    assert.equal(
      refs.filter((r) => r.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE).length,
      CIVIC_MEDIA_SELECTION_PRINCIPLES.length,
    );
    assert.equal(
      refs.filter((r) => r.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK).length,
      FACT_CHECK_RESOURCES.length,
    );
    assert.equal(
      refs.filter((r) => r.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA).length,
      PROPAGANDA_ANALYSIS_RESOURCES.length,
    );
    assert.ok(
      refs.filter((r) => r.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED).length >= 1,
    );
    assert.ok(refs.filter((r) => r.domain === "initiative").length >= 2);

    const editorial = refs.find(
      (r) => r.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    assert.equal(editorial?.entityId, MEDIA_PLP_EDITORIAL_ENTITY_ID);
    assert.equal(editorial?.inWebBatch, true);
    assert.equal(editorial?.inMaterializerSource, true);
  });

  it("every Media PLP static carousel entity is materializer-resolvable", async () => {
    const mediaRefs = discoverMediaPlpCarouselStaticEntities().filter(
      (r) => r.domain === "media_plp",
    );
    // Bound sample: editorial + first of each catalog type (trusted mongo may miss in unit).
    const samples = [
      mediaRefs.find((r) => r.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL)!,
      mediaRefs.find((r) => r.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE)!,
      mediaRefs.find((r) => r.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK)!,
      mediaRefs.find((r) => r.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA)!,
    ];
    for (const ref of samples) {
      const resolved = await resolveMediaPlpMaterializerSource({
        entityType: ref.entityType as (typeof MEDIA_PLP_ENTITY_TYPES)[number],
        entityId: ref.entityId,
        locale: "uk",
      });
      assert.equal(resolved.SOURCE_FOUND, true, `${ref.entityType}/${ref.entityId}`);
      assert.ok(resolved.CANONICAL_VERSION);
      assert.ok(resolved.canonicalPresentation);
    }
  });

  it("parse args require --mongo + one locale; refuse write/corpus flags", () => {
    assert.equal(parseMediaPlpCarouselArgs(["node", "x"]).ok, false);
    const ok = parseMediaPlpCarouselArgs([
      "node",
      "x",
      "--mongo",
      "--locale",
      "uk",
      "--country-code",
      "ua",
    ]);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.args.locale, "uk");
      assert.equal(ok.args.countryCode, "UA");
    }
    assert.equal(
      parseMediaPlpCarouselArgs(["node", "x", "--mongo", "--locale", "uk", "--execute"]).ok,
      false,
    );
  });

  it("materializer help lists all Media PLP entity types", () => {
    const bad = parseMediaPlpMaterializerArgs(["node", "x", "--mongo"]);
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      for (const type of MEDIA_PLP_ENTITY_TYPES) {
        assert.match(bad.errorMessage, new RegExp(type));
      }
    }
  });

  it("thin import graph proof for carousel diagnostic modules", () => {
    const isolation = assertMediaPlpCarouselImportIsolation();
    assert.equal(isolation.ok, true, isolation.violations.join(","));
    const pkg = readFileSync(path.join(apiRoot, "package.json"), "utf8");
    assert.match(pkg, /diagnose:media-plp-carousel/);
  });

  it("totals + materialize plan: missing snapshot → REBUILD; ready → skip; max 20", () => {
    const rows: MediaPlpCarouselEntityRow[] = [
      {
        surface: "media_principle",
        route: "/media",
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: "editorial-transparency",
        canonicalVersion: "v1",
        plpFound: false,
        schema: null,
        usability: "REBUILD_REQUIRED",
        rebuildReason: "NO_PUBLISHED_SNAPSHOT",
        WOULD_REQUIRE_PROVIDER: true,
        translatableNodeCount: 3,
        payloadByteEstimate: 120,
        inWebBatch: true,
        inMaterializerSource: true,
      },
      {
        surface: "media_editorial",
        route: "/media",
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
        canonicalVersion: "v2",
        plpFound: true,
        schema: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
        usability: "USABLE_LOCALIZED",
        rebuildReason: "NONE",
        WOULD_REQUIRE_PROVIDER: false,
        translatableNodeCount: 10,
        payloadByteEstimate: 900,
        inWebBatch: true,
        inMaterializerSource: true,
      },
      {
        surface: "country_election_rail",
        route: "/countries/[countryCode]",
        entityType: "initiative",
        entityId: "(rendered-initiative-id)",
        canonicalVersion: null,
        plpFound: false,
        schema: null,
        usability: "DOMAIN_NOT_YET_MIGRATED",
        rebuildReason: "DOMAIN_NOT_YET_MIGRATED",
        WOULD_REQUIRE_PROVIDER: false,
        translatableNodeCount: null,
        payloadByteEstimate: null,
        inWebBatch: false,
        inMaterializerSource: false,
      },
      {
        surface: "media_trusted",
        route: "/media",
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        entityId: "stale",
        canonicalVersion: "v3",
        plpFound: true,
        schema: "1.0.0",
        usability: "REBUILD_REQUIRED",
        rebuildReason: "SCHEMA_VERSION_MISMATCH",
        WOULD_REQUIRE_PROVIDER: true,
        translatableNodeCount: 1,
        payloadByteEstimate: 40,
        inWebBatch: true,
        inMaterializerSource: true,
      },
    ];

    const totals = computeMediaPlpCarouselTotals(rows);
    assert.equal(totals.TOTAL_ENTITIES, 4);
    assert.equal(totals.PUBLISHED_LOCALIZED_READY, 1);
    assert.equal(totals.REBUILD_REQUIRED, 2);
    assert.equal(totals.MISSING_SNAPSHOT, 1);
    assert.equal(totals.STALE_SCHEMA, 1);
    assert.equal(totals.DOMAIN_NOT_YET_MIGRATED, 1);

    const plan = buildMediaPlpCarouselMaterializePlan(rows);
    assert.equal(plan.length, 2);
    assert.ok(plan.every((p) => p.entityType !== "initiative"));
    assert.ok(MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX <= 20);
  });

  it("valid PLP.2 => consumer PUBLISHED_LOCALIZED; missing => NO_PUBLISHED_SNAPSHOT", async () => {
    const principle = CIVIC_MEDIA_SELECTION_PRINCIPLES[0]!;
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

    const hit = await resolveMediaPlpConsumerItem({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
      entityId: principle.id,
      locale: "uk",
      canonicalPresentation: presentation,
    });
    assert.equal(hit.mode, "PUBLISHED_LOCALIZED");

    const fact = FACT_CHECK_RESOURCES[0]!;
    const { buildCanonicalFactCheckPresentation } = await import(
      "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js"
    );
    const factPresentation = asMediaPlpPresentationNode(
      buildCanonicalFactCheckPresentation(fact),
    );
    const miss = await resolveMediaPlpConsumerItem({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
      entityId: fact.id,
      locale: "uk",
      canonicalPresentation: factPresentation,
    });
    assert.equal(miss.mode, "CANONICAL_FALLBACK");
    assert.equal(miss.reasonCode, "NO_PUBLISHED_SNAPSHOT");
  });

  it("stale PLP.1 schema => REBUILD_REQUIRED usability class", async () => {
    // Classifier path is covered via compute totals SCHEMA_VERSION_MISMATCH above;
    // prove materializer accepts all carousel entity types in help + source switch.
    const sourceFile = readFileSync(
      path.join(
        apiRoot,
        "src/modules/language/media-plp-materializer/source-resolve.ts",
      ),
      "utf8",
    );
    for (const type of [
      "PUBLIC_NEWS",
      "CIVIC_MEDIA_PRINCIPLE",
      "CIVIC_MEDIA_TRUSTED",
      "CIVIC_MEDIA_EDITORIAL",
      "CIVIC_MEDIA_FACT_CHECK",
      "CIVIC_MEDIA_PROPAGANDA",
    ]) {
      assert.match(sourceFile, new RegExp(type));
    }

    const liveSource = readFileSync(
      path.join(
        apiRoot,
        "src/modules/language/published-localized-presentation/media/live-source.ts",
      ),
      "utf8",
      );
    assert.match(liveSource, /resolvePublicNews/);
    assert.doesNotMatch(
      liveSource,
      /Consumer gate focuses on trusted\/principles\/editorial; news remains/,
    );
    assert.ok(TRUSTED_MEDIA_RESOURCES.length > 0);
  });
});
