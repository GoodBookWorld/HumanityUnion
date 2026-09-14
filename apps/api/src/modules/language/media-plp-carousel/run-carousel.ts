/**
 * Reset 03E.9 — thin READ-ONLY Media/Country carousel PLP readiness diagnostic.
 * No provider. No writes. No history hydration. No body text output.
 */

import type {
  LanguageCode,
  LocalizedPresentationUsability,
  LocalizedPresentationUsabilityReason,
  MediaPlpEntityType,
} from "@hu/types";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../../../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../infrastructure/mongodb/mongo-connection.js";
import { collectAutoPaths } from "../published-localized-presentation/presentation-paths.js";
import { classifyUsableLocalizedPresentation } from "../published-localized-presentation/usability.js";
import {
  findCurrentPublishedPresentation,
  requirePublishedLocalizationMongoPersistence,
} from "../published-localized-presentation/persistence/repository.js";
import { loadMediaPlpLiveCanonicalSource } from "../published-localized-presentation/media/live-source.js";
import {
  MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX,
  MEDIA_PLP_CAROUSEL_PACK,
} from "./constants.js";
import {
  discoverMediaPlpCarouselEntities,
  type MediaPlpCarouselEntityRef,
} from "./discover-entities.js";
import { assertMediaPlpCarouselImportIsolation } from "./import-guards.js";
import { parseMediaPlpCarouselArgs } from "./parse-args.js";

export type MediaPlpCarouselRebuildClass =
  | "NONE"
  | "NO_PUBLISHED_SNAPSHOT"
  | "CANONICAL_VERSION_MISMATCH"
  | "SCHEMA_VERSION_MISMATCH"
  | "CONTENT_INTEGRITY_MISSING"
  | "CONTENT_INTEGRITY_FAILED"
  | "STRUCTURAL_INTEGRITY_MISSING"
  | "STRUCTURAL_INTEGRITY_FAILED"
  | "SOURCE_NOT_FOUND"
  | "DOMAIN_NOT_YET_MIGRATED"
  | "STATE_NOT_PUBLISHED"
  | "PRESENTATION_OR_CANONICAL_MISSING"
  | "REBUILD_REQUIRED";

export type MediaPlpCarouselEntityRow = {
  readonly surface: string;
  readonly route: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly canonicalVersion: string | null;
  readonly plpFound: boolean;
  readonly schema: string | null;
  readonly usability: LocalizedPresentationUsability | "DOMAIN_NOT_YET_MIGRATED" | null;
  readonly rebuildReason: MediaPlpCarouselRebuildClass;
  readonly WOULD_REQUIRE_PROVIDER: boolean;
  readonly translatableNodeCount: number | null;
  readonly payloadByteEstimate: number | null;
  readonly inWebBatch: boolean;
  readonly inMaterializerSource: boolean;
};

export type MediaPlpCarouselTotals = {
  readonly TOTAL_ENTITIES: number;
  readonly PUBLISHED_LOCALIZED_READY: number;
  readonly REBUILD_REQUIRED: number;
  readonly MISSING_SNAPSHOT: number;
  readonly STALE_SCHEMA: number;
  readonly INVALID_INTEGRITY: number;
  readonly DOMAIN_NOT_YET_MIGRATED: number;
  readonly SOURCE_NOT_FOUND: number;
};

export type MediaPlpCarouselReport = {
  readonly pack: typeof MEDIA_PLP_CAROUSEL_PACK;
  readonly operation: "diagnose_media_plp_carousel";
  readonly mode: "read-only";
  readonly LOCALE: string;
  readonly COUNTRY_CODE: string | null;
  readonly IMPORT_BOUNDARY_OK: boolean;
  readonly database: string | null;
  readonly rows: readonly MediaPlpCarouselEntityRow[];
  readonly totals: MediaPlpCarouselTotals;
  readonly materializePlan: readonly {
    readonly entityType: string;
    readonly entityId: string;
    readonly rebuildReason: string;
  }[];
  readonly PROVIDER_CALLS: number;
  readonly WRITES_PERFORMED: number;
  readonly RSS_START_MB: number;
  readonly RSS_PEAK_MB: number;
};

function rssMb(): number {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

function mapUsabilityReason(
  reason: LocalizedPresentationUsabilityReason | null | undefined,
): MediaPlpCarouselRebuildClass {
  switch (reason) {
    case "NO_SNAPSHOT":
      return "NO_PUBLISHED_SNAPSHOT";
    case "CANONICAL_VERSION_MISMATCH":
      return "CANONICAL_VERSION_MISMATCH";
    case "SCHEMA_VERSION_MISMATCH":
      return "SCHEMA_VERSION_MISMATCH";
    case "CONTENT_INTEGRITY_MISSING":
      return "CONTENT_INTEGRITY_MISSING";
    case "CONTENT_INTEGRITY_FAILED":
      return "CONTENT_INTEGRITY_FAILED";
    case "STRUCTURAL_INTEGRITY_MISSING":
      return "STRUCTURAL_INTEGRITY_MISSING";
    case "STRUCTURAL_INTEGRITY_FAILED":
      return "STRUCTURAL_INTEGRITY_FAILED";
    case "STATE_NOT_PUBLISHED":
      return "STATE_NOT_PUBLISHED";
    case "PRESENTATION_OR_CANONICAL_MISSING":
      return "PRESENTATION_OR_CANONICAL_MISSING";
    case "OK":
      return "NONE";
    default:
      return "REBUILD_REQUIRED";
  }
}

function initiativeRow(ref: MediaPlpCarouselEntityRef): MediaPlpCarouselEntityRow {
  return {
    surface: ref.surface,
    route: ref.route,
    entityType: ref.entityType,
    entityId: ref.entityId,
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
  };
}

export async function classifyMediaPlpCarouselEntity(input: {
  readonly ref: MediaPlpCarouselEntityRef;
  readonly locale: LanguageCode;
}): Promise<MediaPlpCarouselEntityRow> {
  const { ref, locale } = input;
  if (ref.domain !== "media_plp" || ref.entityType === "initiative") {
    return initiativeRow(ref);
  }

  const entityType = ref.entityType as MediaPlpEntityType;
  const source = await loadMediaPlpLiveCanonicalSource({
    entityType,
    entityId: ref.entityId,
  });

  if (!source.SOURCE_FOUND || !source.canonicalPresentation || !source.CANONICAL_VERSION) {
    return {
      surface: ref.surface,
      route: ref.route,
      entityType,
      entityId: ref.entityId,
      canonicalVersion: null,
      plpFound: false,
      schema: null,
      usability: "REBUILD_REQUIRED",
      rebuildReason: "SOURCE_NOT_FOUND",
      WOULD_REQUIRE_PROVIDER: false,
      translatableNodeCount: null,
      payloadByteEstimate: null,
      inWebBatch: ref.inWebBatch,
      inMaterializerSource: ref.inMaterializerSource,
    };
  }

  const autoPaths = collectAutoPaths(source.canonicalPresentation);
  const payloadByteEstimate = Buffer.byteLength(
    JSON.stringify(source.canonicalPresentation),
    "utf8",
  );

  const current = await findCurrentPublishedPresentation({
    entityType,
    entityId: ref.entityId,
    locale,
  });

  const classification = classifyUsableLocalizedPresentation({
    locale,
    liveCanonicalVersion: source.CANONICAL_VERSION,
    liveLocalizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    canonicalPresentation: source.canonicalPresentation,
    snapshot: current,
  });

  const rebuildReason = classification.rebuildRequired
    ? mapUsabilityReason(classification.reason)
    : "NONE";
  const ready = classification.usability === "USABLE_LOCALIZED" && !classification.rebuildRequired;

  return {
    surface: ref.surface,
    route: ref.route,
    entityType,
    entityId: ref.entityId,
    canonicalVersion: source.CANONICAL_VERSION,
    plpFound: Boolean(current),
    schema: current ? String(current.identity.localizationSchemaVersion) : null,
    usability: classification.usability,
    rebuildReason,
    WOULD_REQUIRE_PROVIDER: !ready,
    translatableNodeCount: autoPaths.length,
    payloadByteEstimate,
    inWebBatch: ref.inWebBatch,
    inMaterializerSource: ref.inMaterializerSource,
  };
}

async function classifyMediaEntity(input: {
  readonly ref: MediaPlpCarouselEntityRef;
  readonly locale: LanguageCode;
}): Promise<MediaPlpCarouselEntityRow> {
  return classifyMediaPlpCarouselEntity(input);
}

export function computeMediaPlpCarouselTotals(
  rows: readonly MediaPlpCarouselEntityRow[],
): MediaPlpCarouselTotals {
  let ready = 0;
  let rebuild = 0;
  let missing = 0;
  let staleSchema = 0;
  let invalidIntegrity = 0;
  let domain = 0;
  let sourceMissing = 0;

  for (const row of rows) {
    if (row.rebuildReason === "DOMAIN_NOT_YET_MIGRATED") {
      domain += 1;
      continue;
    }
    if (row.rebuildReason === "SOURCE_NOT_FOUND") {
      sourceMissing += 1;
      rebuild += 1;
      continue;
    }
    if (row.usability === "USABLE_LOCALIZED" && row.rebuildReason === "NONE") {
      ready += 1;
      continue;
    }
    rebuild += 1;
    if (row.rebuildReason === "NO_PUBLISHED_SNAPSHOT") {
      missing += 1;
    }
    if (row.rebuildReason === "SCHEMA_VERSION_MISMATCH") {
      staleSchema += 1;
    }
    if (
      row.rebuildReason === "CONTENT_INTEGRITY_MISSING" ||
      row.rebuildReason === "CONTENT_INTEGRITY_FAILED" ||
      row.rebuildReason === "STRUCTURAL_INTEGRITY_MISSING" ||
      row.rebuildReason === "STRUCTURAL_INTEGRITY_FAILED"
    ) {
      invalidIntegrity += 1;
    }
  }

  return {
    TOTAL_ENTITIES: rows.length,
    PUBLISHED_LOCALIZED_READY: ready,
    REBUILD_REQUIRED: rebuild,
    MISSING_SNAPSHOT: missing,
    STALE_SCHEMA: staleSchema,
    INVALID_INTEGRITY: invalidIntegrity,
    DOMAIN_NOT_YET_MIGRATED: domain,
    SOURCE_NOT_FOUND: sourceMissing,
  };
}

export function buildMediaPlpCarouselMaterializePlan(
  rows: readonly MediaPlpCarouselEntityRow[],
  max = MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX,
): readonly {
  readonly entityType: string;
  readonly entityId: string;
  readonly rebuildReason: string;
}[] {
  return rows
    .filter(
      (row) =>
        row.rebuildReason !== "DOMAIN_NOT_YET_MIGRATED" &&
        row.rebuildReason !== "NONE" &&
        row.rebuildReason !== "SOURCE_NOT_FOUND" &&
        row.inMaterializerSource &&
        row.entityType !== "initiative",
    )
    .slice(0, max)
    .map((row) => ({
      entityType: row.entityType,
      entityId: row.entityId,
      rebuildReason: row.rebuildReason,
    }));
}

export async function runMediaPlpCarouselDiagnostic(
  argv: readonly string[],
): Promise<{
  readonly exitCode: number;
  readonly report: MediaPlpCarouselReport | null;
  readonly errorMessage: string | null;
}> {
  const rssStart = rssMb();
  let peak = rssStart;
  const bump = () => {
    const now = rssMb();
    if (now > peak) peak = now;
  };

  const importBoundary = assertMediaPlpCarouselImportIsolation();
  const parsed = parseMediaPlpCarouselArgs(argv);
  if (!parsed.ok) {
    return { exitCode: 2, report: null, errorMessage: parsed.errorMessage };
  }

  if (!isMongoConfigured()) {
    return { exitCode: 1, report: null, errorMessage: "MONGODB_URI is not configured." };
  }

  try {
    requirePublishedLocalizationMongoPersistence(
      "diagnose:media-plp-carousel --mongo requires durable PLP persistence",
    );
  } catch (error) {
    return {
      exitCode: 2,
      report: null,
      errorMessage: error instanceof Error ? error.message : "Mongo PLP persistence required",
    };
  }

  let connected = false;
  try {
    await connectMongoClient();
    connected = true;
    bump();

    const refs = await discoverMediaPlpCarouselEntities({
      countryCode: parsed.args.countryCode,
      includeNews: true,
    });
    bump();

    const rows: MediaPlpCarouselEntityRow[] = [];
    for (const ref of refs) {
      rows.push(
        await classifyMediaEntity({
          ref,
          locale: parsed.args.locale,
        }),
      );
      bump();
    }

    const totals = computeMediaPlpCarouselTotals(rows);
    const materializePlan = buildMediaPlpCarouselMaterializePlan(rows);

    const report: MediaPlpCarouselReport = {
      pack: MEDIA_PLP_CAROUSEL_PACK,
      operation: "diagnose_media_plp_carousel",
      mode: "read-only",
      LOCALE: parsed.args.locale,
      COUNTRY_CODE: parsed.args.countryCode,
      IMPORT_BOUNDARY_OK: importBoundary.ok,
      database: resolveMongoConfig().database,
      rows,
      totals,
      materializePlan,
      PROVIDER_CALLS: 0,
      WRITES_PERFORMED: 0,
      RSS_START_MB: rssStart,
      RSS_PEAK_MB: peak,
    };

    return {
      exitCode: importBoundary.ok ? 0 : 1,
      report,
      errorMessage: importBoundary.ok
        ? null
        : `Import boundary violations: ${importBoundary.violations.join(",")}`,
    };
  } catch (error) {
    return {
      exitCode: 1,
      report: null,
      errorMessage: error instanceof Error ? error.message : "carousel diagnostic failed",
    };
  } finally {
    if (connected) {
      try {
        await disconnectMongoClient();
      } catch {
        // ignore
      }
    }
  }
}

export function printMediaPlpCarouselReport(report: MediaPlpCarouselReport): void {
  console.log(
    JSON.stringify(
      {
        pack: report.pack,
        operation: report.operation,
        mode: report.mode,
        LOCALE: report.LOCALE,
        COUNTRY_CODE: report.COUNTRY_CODE,
        IMPORT_BOUNDARY_OK: report.IMPORT_BOUNDARY_OK,
        database: report.database,
        PROVIDER_CALLS: report.PROVIDER_CALLS,
        WRITES_PERFORMED: report.WRITES_PERFORMED,
        RSS_START_MB: report.RSS_START_MB,
        RSS_PEAK_MB: report.RSS_PEAK_MB,
        liveSchema: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
      },
      null,
      2,
    ),
  );

  for (const row of report.rows) {
    console.log(
      [
        row.surface,
        row.entityType,
        row.entityId,
        `cv=${row.canonicalVersion ?? "-"}`,
        `plp=${row.plpFound ? "yes" : "no"}`,
        `schema=${row.schema ?? "-"}`,
        `usability=${row.usability ?? "-"}`,
        `reason=${row.rebuildReason}`,
        `provider=${row.WOULD_REQUIRE_PROVIDER ? "yes" : "no"}`,
        `nodes=${row.translatableNodeCount ?? "-"}`,
        `bytes=${row.payloadByteEstimate ?? "-"}`,
      ].join(" | "),
    );
  }

  console.log("--- TOTALS ---");
  for (const [key, value] of Object.entries(report.totals)) {
    console.log(`${key}=${value}`);
  }

  console.log(
    `--- MATERIALIZE_PLAN (dry-run; max ${MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX}) ---`,
  );
  if (report.materializePlan.length === 0) {
    console.log("(none — all Media PLP carousel entities ready or not materializable)");
  } else {
    for (const step of report.materializePlan) {
      console.log(
        `pnpm --filter @hu/api materialize:media-plp -- --mongo --entity-type ${step.entityType} --entity-id ${step.entityId} --locale ${report.LOCALE}  # ${step.rebuildReason}; add --execute on staging only`,
      );
    }
  }
}
