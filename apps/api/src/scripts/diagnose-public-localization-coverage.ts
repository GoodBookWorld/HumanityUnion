/**
 * Pack 08K — READ-ONLY public localization coverage diagnostic.
 *
 * Does NOT translate or mutate. Defaults to --dry-run + fixture mode.
 * Reports by-family counts only (identities/counts — never private content).
 *
 * Modes:
 *   (default / --dry-run)  fixture-mode report; exit 0
 *   --fixture              force Pack 08K fixture trees (no Mongo)
 *   --mongo                when MONGODB_URI configured — discover + content_translations
 *                          lookups via PublicLocalizedPresentation collect
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
  type LanguageCode,
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
  CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS,
  discoverStagingInitiativePathWarmSources,
  type StagingWarmSourceKind,
} from "../modules/language/content-translation-staging-warm-backfill.js";
import { loadTranslatableSource } from "../modules/language/content-translation.service.js";
import { listAutomaticContentTranslationTargetLocales } from "../modules/language/content-translation-warm-targets.js";
import { listContentTranslationsForSource } from "../modules/language/persistence/content-translation.repository.js";
import {
  collectAutoTranslatableNodes,
  localizePublicPresentation,
} from "../modules/language/public-localized-presentation.js";

loadApiEnvironment();

interface FamilyCoverageCounts {
  readonly family: string;
  readonly TOTAL_SEMANTIC_NODES: number;
  readonly LOCALIZED: number;
  readonly CANONICAL_FALLBACK: number;
  readonly PROTECTED: number;
  readonly MISSING_TRANSLATION_IDENTITIES: number;
  readonly IDENTITY_COUNT: number;
}

function parseTargetLanguage(): string {
  const match = process.argv.find((entry) => entry.startsWith("--target-language="));
  if (!match) {
    return "uk";
  }
  return match.slice("--target-language=".length).trim() || "uk";
}

function emptyFamily(family: string): FamilyCoverageCounts {
  return {
    family,
    TOTAL_SEMANTIC_NODES: 0,
    LOCALIZED: 0,
    CANONICAL_FALLBACK: 0,
    PROTECTED: 0,
    MISSING_TRANSLATION_IDENTITIES: 0,
    IDENTITY_COUNT: 0,
  };
}

function mergeFamily(
  acc: FamilyCoverageCounts,
  next: Omit<FamilyCoverageCounts, "family">,
): FamilyCoverageCounts {
  return {
    family: acc.family,
    TOTAL_SEMANTIC_NODES: acc.TOTAL_SEMANTIC_NODES + next.TOTAL_SEMANTIC_NODES,
    LOCALIZED: acc.LOCALIZED + next.LOCALIZED,
    CANONICAL_FALLBACK: acc.CANONICAL_FALLBACK + next.CANONICAL_FALLBACK,
    PROTECTED: acc.PROTECTED + next.PROTECTED,
    MISSING_TRANSLATION_IDENTITIES:
      acc.MISSING_TRANSLATION_IDENTITIES + next.MISSING_TRANSLATION_IDENTITIES,
    IDENTITY_COUNT: acc.IDENTITY_COUNT + next.IDENTITY_COUNT,
  };
}

function sumFamilies(
  byFamily: readonly FamilyCoverageCounts[],
): Omit<FamilyCoverageCounts, "family"> {
  return byFamily.reduce(
    (acc, row) => ({
      TOTAL_SEMANTIC_NODES: acc.TOTAL_SEMANTIC_NODES + row.TOTAL_SEMANTIC_NODES,
      LOCALIZED: acc.LOCALIZED + row.LOCALIZED,
      CANONICAL_FALLBACK: acc.CANONICAL_FALLBACK + row.CANONICAL_FALLBACK,
      PROTECTED: acc.PROTECTED + row.PROTECTED,
      MISSING_TRANSLATION_IDENTITIES:
        acc.MISSING_TRANSLATION_IDENTITIES + row.MISSING_TRANSLATION_IDENTITIES,
      IDENTITY_COUNT: acc.IDENTITY_COUNT + row.IDENTITY_COUNT,
    }),
    {
      TOTAL_SEMANTIC_NODES: 0,
      LOCALIZED: 0,
      CANONICAL_FALLBACK: 0,
      PROTECTED: 0,
      MISSING_TRANSLATION_IDENTITIES: 0,
      IDENTITY_COUNT: 0,
    },
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

function fieldsAsPresentation(fields: Record<string, string>): PublicPresentationNode {
  return { ...fields };
}

function translatedFieldsFromRecord(
  translatedContent: Record<string, unknown> | string,
): Record<string, string> {
  if (typeof translatedContent === "string") {
    return { text: translatedContent };
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(translatedContent)) {
    if (typeof value === "string" && value.trim()) {
      out[key] = value;
    }
  }
  return out;
}

function runFixtureMode(targetLanguage: string): {
  readonly mode: "fixture";
  readonly byFamily: FamilyCoverageCounts[];
  readonly totals: Omit<FamilyCoverageCounts, "family">;
} {
  const byFamilyMap = new Map<string, FamilyCoverageCounts>();

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
        TOTAL_SEMANTIC_NODES: localized.coverage.semanticNodeCount,
        LOCALIZED: localized.coverage.localizedNodeCount,
        CANONICAL_FALLBACK: localized.coverage.canonicalFallbackNodeCount,
        PROTECTED: localized.coverage.protectedNodeCount,
        MISSING_TRANSLATION_IDENTITIES: 0,
        IDENTITY_COUNT: 1,
      }),
    );
  }

  const byFamily = [...byFamilyMap.values()].sort((a, b) => a.family.localeCompare(b.family));
  return { mode: "fixture", byFamily, totals: sumFamilies(byFamily) };
}

async function runMongoMode(targetLanguage: string): Promise<{
  readonly mode: "mongo";
  readonly database: string;
  readonly byFamily: FamilyCoverageCounts[];
  readonly totals: Omit<FamilyCoverageCounts, "family">;
}> {
  const mongo = resolveMongoConfig();
  await bootstrapContentTranslationOperatorPersistence();

  const discovered = await discoverStagingInitiativePathWarmSources({
    kinds: [...CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS],
  });

  let targetLocales: readonly LanguageCode[] = [targetLanguage as LanguageCode];
  try {
    const warmLocales = await listAutomaticContentTranslationTargetLocales();
    if (warmLocales.length > 0) {
      targetLocales = warmLocales;
    }
  } catch {
    // Registry unavailable — fall back to CLI target language only.
  }

  const byFamilyMap = new Map<string, FamilyCoverageCounts>();

  for (const candidate of discovered.candidates) {
    const family = candidate.sourceKind as StagingWarmSourceKind;
    const source = await loadTranslatableSource({
      sourceKind: candidate.sourceKind,
      sourceRecordId: candidate.sourceRecordId,
    });
    if (!source) {
      const prev = byFamilyMap.get(family) ?? emptyFamily(family);
      byFamilyMap.set(
        family,
        mergeFamily(prev, {
          TOTAL_SEMANTIC_NODES: 0,
          LOCALIZED: 0,
          CANONICAL_FALLBACK: 0,
          PROTECTED: 0,
          MISSING_TRANSLATION_IDENTITIES: 1,
          IDENTITY_COUNT: 1,
        }),
      );
      continue;
    }

    const presentation = fieldsAsPresentation(source.fields);
    const autoNodes = collectAutoTranslatableNodes(presentation);
    const localizedProbe = localizePublicPresentation({
      identity: {
        sourceKind: candidate.sourceKind,
        sourceRecordId: candidate.sourceRecordId,
        presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
      },
      sourceLanguage: source.sourceLanguage,
      targetLanguage,
      presentation,
      translations: {},
    });

    const rows = await listContentTranslationsForSource({
      sourceKind: candidate.sourceKind,
      sourceRecordId: candidate.sourceRecordId,
    });

    let localized = 0;
    let fallback = 0;
    let missingIdentity = 0;

    for (const locale of targetLocales) {
      const current = rows.find(
        (row) =>
          row.targetLanguage === locale &&
          row.sourceVersion === source.sourceVersion &&
          row.freshness === "current" &&
          row.stale !== true,
      );
      if (!current) {
        missingIdentity += 1;
        fallback += autoNodes.length;
        continue;
      }
      const translatedFields = translatedFieldsFromRecord(current.translatedContent);
      for (const node of autoNodes) {
        const leaf = node.path.split(".").pop() ?? node.path;
        if (
          (typeof translatedFields[node.path] === "string" &&
            translatedFields[node.path]!.trim()) ||
          (typeof translatedFields[leaf] === "string" && translatedFields[leaf]!.trim())
        ) {
          localized += 1;
        } else {
          fallback += 1;
        }
      }
    }

    const prev = byFamilyMap.get(family) ?? emptyFamily(family);
    byFamilyMap.set(
      family,
      mergeFamily(prev, {
        TOTAL_SEMANTIC_NODES: autoNodes.length * targetLocales.length,
        LOCALIZED: localized,
        CANONICAL_FALLBACK: fallback,
        PROTECTED: localizedProbe.coverage.protectedNodeCount,
        MISSING_TRANSLATION_IDENTITIES: missingIdentity,
        IDENTITY_COUNT: 1,
      }),
    );
  }

  const byFamily = [...byFamilyMap.values()].sort((a, b) => a.family.localeCompare(b.family));
  return {
    mode: "mongo",
    database: mongo.database,
    byFamily,
    totals: sumFamilies(byFamily),
  };
}

async function main(): Promise<void> {
  const targetLanguage = parseTargetLanguage();
  const wantMongo = process.argv.includes("--mongo");
  const forceFixture = process.argv.includes("--fixture") || !wantMongo;

  if (process.argv.includes("--execute")) {
    console.log(
      JSON.stringify({
        pack: "08K",
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
      report = await runMongoMode(targetLanguage);
    } catch {
      console.log(
        JSON.stringify({
          pack: "08K",
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
          pack: "08K",
          operation: "diagnose_public_localization_coverage",
          mode: "fixture_fallback",
          note: "--mongo requested but MONGODB_URI not configured; using fixture mode.",
        }),
      );
    }
    report = runFixtureMode(targetLanguage);
  }

  console.log(
    JSON.stringify(
      {
        pack: "08K",
        operation: "diagnose_public_localization_coverage",
        dryRun: true,
        targetLanguage,
        schemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
        mode: report.mode,
        database: "database" in report ? report.database : null,
        note:
          report.mode === "fixture"
            ? "FIXTURE MODE — Pack 08K fixture trees only (default, or --fixture). Pass --mongo to use live content_translations lookups. NOT site_translation_coverage."
            : "MONGO MODE — read-only discovery + content_translations lookups. Identities/counts only. NOT site_translation_coverage.",
        totals: report.totals,
        byFamily: report.byFamily,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        pack: "08K",
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
