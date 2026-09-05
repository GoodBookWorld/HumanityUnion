/**
 * Pack 08K / 08K.1 — READ-ONLY public localization coverage diagnostic.
 *
 * Does NOT translate or mutate. Defaults to --dry-run + fixture mode.
 * Reports by-family counts only (identities/counts — never private content).
 *
 * Counter semantics (Pack 08K.1):
 * - SOURCE_PRESENTATION_COUNT: discovered public presentation identities
 *   (formerly IDENTITY_COUNT).
 * - MISSING_TARGET_TRANSLATION_IDENTITIES: presentation × target-locale slots
 *   lacking CURRENT translation for live sourceVersion
 *   (formerly MISSING_TRANSLATION_IDENTITIES).
 * - PRESENTATIONS_WITH_ANY_FALLBACK: presentations with ≥1 canonical fallback.
 *
 * Modes:
 *   (default / --dry-run)  fixture-mode report; exit 0
 *   --fixture              force Pack 08K fixture trees (no Mongo)
 *   --mongo                when MONGODB_URI configured — shared corpus discovery
 *
 * Usage (from apps/api):
 *   pnpm diagnose:public-localization
 *   pnpm diagnose:public-localization -- --dry-run
 *   pnpm diagnose:public-localization -- --fixture
 *   pnpm diagnose:public-localization -- --mongo --target-language=uk
 *
 * Never prints MONGODB_URI / passwords / API keys / translated bodies / private prose.
 * Do NOT run --mongo against production. Prefer fixture mode for local checks.
 */

import {
  PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  protectedIdentity,
  protectedTechnical,
  type PublicPresentationIdentity,
  type PublicPresentationNode,
} from "@hu/types";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { bootstrapContentTranslationOperatorPersistence } from "../infrastructure/mongodb/bootstrap-content-translation-operator-persistence.js";
import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../infrastructure/mongodb/mongo-config.js";
import { disconnectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";
import {
  auditPublicLocalizationCorpus,
  type PublicLocalizationCorpusFamilyCounts,
} from "../modules/language/public-localization-corpus.js";
import {
  collectAutoTranslatableNodes,
  localizePublicPresentation,
} from "../modules/language/public-localized-presentation.js";

loadApiEnvironment();

interface FixtureFamilyCoverageCounts {
  readonly family: string;
  readonly SOURCE_PRESENTATION_COUNT: number;
  readonly PRESENTATIONS_WITH_ANY_FALLBACK: number;
  readonly TOTAL_SEMANTIC_NODES: number;
  readonly CURRENT_LOCALIZED_NODES: number;
  readonly CANONICAL_FALLBACK_NODES: number;
  readonly PROTECTED_NODES: number;
  readonly MISSING_TARGET_TRANSLATION_IDENTITIES: number;
  /** @deprecated Pack 08K.1 alias */
  readonly IDENTITY_COUNT: number;
  /** @deprecated Pack 08K.1 alias */
  readonly MISSING_TRANSLATION_IDENTITIES: number;
  /** @deprecated Pack 08K.1 alias of CURRENT_LOCALIZED_NODES */
  readonly LOCALIZED: number;
  /** @deprecated Pack 08K.1 alias of CANONICAL_FALLBACK_NODES */
  readonly CANONICAL_FALLBACK: number;
  /** @deprecated Pack 08K.1 alias of PROTECTED_NODES */
  readonly PROTECTED: number;
}

function parseTargetLanguage(): string {
  const match = process.argv.find((entry) => entry.startsWith("--target-language="));
  if (!match) {
    return "uk";
  }
  return match.slice("--target-language=".length).trim() || "uk";
}

function emptyFamily(family: string): FixtureFamilyCoverageCounts {
  return {
    family,
    SOURCE_PRESENTATION_COUNT: 0,
    PRESENTATIONS_WITH_ANY_FALLBACK: 0,
    TOTAL_SEMANTIC_NODES: 0,
    CURRENT_LOCALIZED_NODES: 0,
    CANONICAL_FALLBACK_NODES: 0,
    PROTECTED_NODES: 0,
    MISSING_TARGET_TRANSLATION_IDENTITIES: 0,
    IDENTITY_COUNT: 0,
    MISSING_TRANSLATION_IDENTITIES: 0,
    LOCALIZED: 0,
    CANONICAL_FALLBACK: 0,
    PROTECTED: 0,
  };
}

function withFixtureAliases(
  row: Omit<
    FixtureFamilyCoverageCounts,
    | "IDENTITY_COUNT"
    | "MISSING_TRANSLATION_IDENTITIES"
    | "LOCALIZED"
    | "CANONICAL_FALLBACK"
    | "PROTECTED"
  >,
): FixtureFamilyCoverageCounts {
  return {
    ...row,
    IDENTITY_COUNT: row.SOURCE_PRESENTATION_COUNT,
    MISSING_TRANSLATION_IDENTITIES: row.MISSING_TARGET_TRANSLATION_IDENTITIES,
    LOCALIZED: row.CURRENT_LOCALIZED_NODES,
    CANONICAL_FALLBACK: row.CANONICAL_FALLBACK_NODES,
    PROTECTED: row.PROTECTED_NODES,
  };
}

function mergeFamily(
  acc: FixtureFamilyCoverageCounts,
  next: Omit<FixtureFamilyCoverageCounts, "family">,
): FixtureFamilyCoverageCounts {
  return withFixtureAliases({
    family: acc.family,
    SOURCE_PRESENTATION_COUNT:
      acc.SOURCE_PRESENTATION_COUNT + next.SOURCE_PRESENTATION_COUNT,
    PRESENTATIONS_WITH_ANY_FALLBACK:
      acc.PRESENTATIONS_WITH_ANY_FALLBACK + next.PRESENTATIONS_WITH_ANY_FALLBACK,
    TOTAL_SEMANTIC_NODES: acc.TOTAL_SEMANTIC_NODES + next.TOTAL_SEMANTIC_NODES,
    CURRENT_LOCALIZED_NODES:
      acc.CURRENT_LOCALIZED_NODES + next.CURRENT_LOCALIZED_NODES,
    CANONICAL_FALLBACK_NODES:
      acc.CANONICAL_FALLBACK_NODES + next.CANONICAL_FALLBACK_NODES,
    PROTECTED_NODES: acc.PROTECTED_NODES + next.PROTECTED_NODES,
    MISSING_TARGET_TRANSLATION_IDENTITIES:
      acc.MISSING_TARGET_TRANSLATION_IDENTITIES +
      next.MISSING_TARGET_TRANSLATION_IDENTITIES,
  });
}

function sumFamilies(
  byFamily: readonly FixtureFamilyCoverageCounts[],
): Omit<FixtureFamilyCoverageCounts, "family"> {
  return byFamily.reduce(
    (acc, row) => mergeFamily({ ...acc, family: "*" }, row),
    emptyFamily("*"),
  );
}

function identity(sourceKind: string, sourceRecordId: string): PublicPresentationIdentity {
  return {
    sourceKind,
    sourceRecordId,
    presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  };
}

/** Minimal Pack 08K fixture trees for fixture-mode diagnostics (identities only in output). */
function buildFixtureTrees(): readonly {
  readonly identity: PublicPresentationIdentity;
  readonly presentation: PublicPresentationNode;
}[] {
  return [
    {
      identity: identity("blog_post", "diagnose-fixture-blog-01"),
      presentation: {
        title: "Fixture blog title",
        excerpt: "Fixture blog excerpt",
        body: "Fixture blog body",
        authorName: protectedIdentity("Fixture Author"),
      },
    },
    {
      identity: identity("initiative_lifecycle", "diagnose-fixture-lifecycle-01"),
      presentation: {
        title: "Fixture lifecycle title",
        petition: {
          paragraphs: [
            "Petition paragraph one",
            "Petition paragraph two",
            "Petition paragraph three",
            "Petition paragraph four",
            "Petition paragraph five",
          ],
        },
        initiativeId: protectedTechnical("fixture-initiative-01"),
      },
    },
    {
      identity: identity("civic_media", "diagnose-fixture-media-01"),
      presentation: {
        principles: [{ title: "Fixture principle", body: "Fixture principle body" }],
        trustedCards: [
          {
            outletName: protectedIdentity("Fixture Outlet"),
            websiteUrl: protectedTechnical("https://example.org/fixture"),
            explanation: "Fixture trusted explanation",
          },
        ],
      },
    },
  ];
}

function buildFullTranslations(
  tree: PublicPresentationNode,
  localeTag: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of collectAutoTranslatableNodes(tree)) {
    out[node.path] = `[${localeTag}] ${node.value}`;
  }
  return out;
}

function familyFromAuditRow(
  row: PublicLocalizationCorpusFamilyCounts,
): FixtureFamilyCoverageCounts {
  return withFixtureAliases({
    family: row.family,
    SOURCE_PRESENTATION_COUNT: row.SOURCE_PRESENTATION_COUNT,
    PRESENTATIONS_WITH_ANY_FALLBACK: row.PRESENTATIONS_WITH_ANY_FALLBACK,
    TOTAL_SEMANTIC_NODES: row.TOTAL_SEMANTIC_NODES,
    CURRENT_LOCALIZED_NODES: row.CURRENT_LOCALIZED_NODES,
    CANONICAL_FALLBACK_NODES: row.CANONICAL_FALLBACK_NODES,
    PROTECTED_NODES: row.PROTECTED_NODES,
    MISSING_TARGET_TRANSLATION_IDENTITIES: row.MISSING_TARGET_TRANSLATION_IDENTITIES,
  });
}

function runFixtureMode(targetLanguage: string): {
  readonly mode: "fixture";
  readonly DISCOVERY_STATUS: "COMPLETE";
  readonly byFamily: FixtureFamilyCoverageCounts[];
  readonly totals: Omit<FixtureFamilyCoverageCounts, "family">;
} {
  const byFamilyMap = new Map<string, FixtureFamilyCoverageCounts>();

  for (const fixture of buildFixtureTrees()) {
    const family = fixture.identity.sourceKind;
    const translations = buildFullTranslations(fixture.presentation, targetLanguage);
    const localized = localizePublicPresentation({
      identity: fixture.identity,
      sourceLanguage: "en",
      targetLanguage,
      presentation: fixture.presentation,
      translations,
    });
    const prev = byFamilyMap.get(family) ?? emptyFamily(family);
    byFamilyMap.set(
      family,
      mergeFamily(prev, {
        SOURCE_PRESENTATION_COUNT: 1,
        PRESENTATIONS_WITH_ANY_FALLBACK:
          localized.coverage.canonicalFallbackNodeCount > 0 ? 1 : 0,
        TOTAL_SEMANTIC_NODES: localized.coverage.semanticNodeCount,
        CURRENT_LOCALIZED_NODES: localized.coverage.localizedNodeCount,
        CANONICAL_FALLBACK_NODES: localized.coverage.canonicalFallbackNodeCount,
        PROTECTED_NODES: localized.coverage.protectedNodeCount,
        MISSING_TARGET_TRANSLATION_IDENTITIES: 0,
        IDENTITY_COUNT: 1,
        MISSING_TRANSLATION_IDENTITIES: 0,
        LOCALIZED: localized.coverage.localizedNodeCount,
        CANONICAL_FALLBACK: localized.coverage.canonicalFallbackNodeCount,
        PROTECTED: localized.coverage.protectedNodeCount,
      }),
    );
  }

  const byFamily = [...byFamilyMap.values()].sort((a, b) => a.family.localeCompare(b.family));
  return {
    mode: "fixture",
    DISCOVERY_STATUS: "COMPLETE",
    byFamily,
    totals: sumFamilies(byFamily),
  };
}

async function runMongoMode(): Promise<{
  readonly mode: "mongo";
  readonly database: string;
  readonly DISCOVERY_STATUS: string;
  readonly discoveryHint: string | null;
  readonly discoveryByKind: readonly {
    readonly family: string;
    readonly SOURCE_RECORDS_DISCOVERED: number;
    readonly PUBLIC_RECORDS: number;
  }[];
  readonly targetLocales: readonly string[];
  readonly byFamily: FixtureFamilyCoverageCounts[];
  readonly byLocale: unknown;
  readonly totals: Omit<FixtureFamilyCoverageCounts, "family"> & {
    readonly TARGET_TRANSLATION_IDENTITIES: number;
    readonly STALE_TARGET_TRANSLATION_IDENTITIES: number;
    readonly FAILED_TARGET_TRANSLATION_IDENTITIES: number;
    readonly WORK_ITEMS_REQUIRED: number;
  };
}> {
  const mongo = resolveMongoConfig();
  await bootstrapContentTranslationOperatorPersistence();

  // Shared discovery/coverage with reconcile:public-localization.
  const audit = await auditPublicLocalizationCorpus();

  const byFamily = audit.byFamily.map(familyFromAuditRow);
  return {
    mode: "mongo",
    database: mongo.database,
    DISCOVERY_STATUS: audit.discoveryStatus,
    discoveryHint: audit.discoveryHint,
    discoveryByKind: audit.discoveryByKind.map((row) => ({
      family: row.sourceKind,
      SOURCE_RECORDS_DISCOVERED: row.sourceRecordsDiscovered,
      PUBLIC_RECORDS: row.publicRecords,
    })),
    targetLocales: audit.targetLocales,
    byFamily,
    byLocale: audit.byLocale,
    totals: {
      ...familyFromAuditRow({ ...audit.totals, family: "*" }),
      TARGET_TRANSLATION_IDENTITIES: audit.totals.TARGET_TRANSLATION_IDENTITIES,
      STALE_TARGET_TRANSLATION_IDENTITIES:
        audit.totals.STALE_TARGET_TRANSLATION_IDENTITIES,
      FAILED_TARGET_TRANSLATION_IDENTITIES:
        audit.totals.FAILED_TARGET_TRANSLATION_IDENTITIES,
      WORK_ITEMS_REQUIRED: audit.totals.WORK_ITEMS_REQUIRED,
    },
  };
}

async function main(): Promise<void> {
  const targetLanguage = parseTargetLanguage();
  const wantMongo = process.argv.includes("--mongo");
  const forceFixture = process.argv.includes("--fixture") || !wantMongo;

  if (process.argv.includes("--execute")) {
    console.log(
      JSON.stringify({
        pack: "08K.1",
        operation: "diagnose_public_localization_coverage",
        refused: "execute_not_supported",
        note: "This script is READ ONLY. Omit --execute; --dry-run is the default.",
      }),
    );
    process.exitCode = 1;
    return;
  }

  let report:
    | Awaited<ReturnType<typeof runMongoMode>>
    | ReturnType<typeof runFixtureMode>;

  if (!forceFixture && wantMongo && isMongoConfigured()) {
    try {
      report = await runMongoMode();
    } catch {
      console.log(
        JSON.stringify({
          pack: "08K.1",
          operation: "diagnose_public_localization_coverage",
          mode: "fixture_fallback",
          note: "Mongo requested but discovery failed; falling back to fixture mode.",
        }),
      );
      report = runFixtureMode(targetLanguage);
    }
  } else {
    if (wantMongo && !isMongoConfigured()) {
      console.log(
        JSON.stringify({
          pack: "08K.1",
          operation: "diagnose_public_localization_coverage",
          mode: "fixture_fallback",
          note: "--mongo requested but MONGODB_URI not configured; using fixture mode.",
        }),
      );
    }
    report = runFixtureMode(targetLanguage);
  }

  const universalCorpusSuccessClaimed =
    report.mode === "mongo" &&
    report.DISCOVERY_STATUS === "COMPLETE" &&
    report.totals.CANONICAL_FALLBACK_NODES === 0;

  console.log(
    JSON.stringify(
      {
        pack: "08K.1",
        operation: "diagnose_public_localization_coverage",
        dryRun: true,
        targetLanguage,
        schemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
        mode: report.mode,
        database: "database" in report ? report.database : null,
        DISCOVERY_STATUS: report.DISCOVERY_STATUS,
        discoveryHint: "discoveryHint" in report ? report.discoveryHint : null,
        discoveryByKind: "discoveryByKind" in report ? report.discoveryByKind : null,
        targetLocales: "targetLocales" in report ? report.targetLocales : [targetLanguage],
        note:
          report.mode === "fixture"
            ? "FIXTURE MODE — Pack 08K fixture trees only (default, or --fixture). Pass --mongo to use live shared corpus. NOT site_translation_coverage."
            : "MONGO MODE — read-only shared discovery + content_translations lookups (same as reconcile:public-localization). Identities/counts only.",
        SOURCE_PRESENTATION_COUNT: report.totals.SOURCE_PRESENTATION_COUNT,
        PRESENTATIONS_WITH_ANY_FALLBACK: report.totals.PRESENTATIONS_WITH_ANY_FALLBACK,
        MISSING_TARGET_TRANSLATION_IDENTITIES:
          report.totals.MISSING_TARGET_TRANSLATION_IDENTITIES,
        totals: report.totals,
        byFamily: report.byFamily,
        byLocale: "byLocale" in report ? report.byLocale : null,
        universalCorpusSuccessClaimed,
      },
      null,
      2,
    ),
  );

  if (report.mode === "mongo" && report.DISCOVERY_STATUS === "FAILED") {
    process.exitCode = 1;
  } else if (report.mode === "mongo" && report.DISCOVERY_STATUS === "PARTIAL") {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        pack: "08K.1",
        operation: "diagnose_public_localization_coverage",
        fatal: true,
        errorName: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await disconnectMongoClient();
    } catch {
      // ignore disconnect errors
    }
    process.exit(process.exitCode ?? 0);
  });
