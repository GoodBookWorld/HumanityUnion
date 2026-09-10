/**
 * Localization Authority Closure 08 — bounded localization integrity diagnostic.
 *
 * Usage:
 *   pnpm localization:check -- --locale uk --kind initiative
 *   pnpm localization:check -- --locale uk --kind civic_media_editorial
 *   pnpm localization:check -- --help
 *
 * Read-only. No provider. No writes. No enqueue.
 * Exactly one locale. Explicit kind scope (never all).
 */

export {};

function isHelp(argv: readonly string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function parseFlag(argv: readonly string[], name: string): string | null {
  const eq = `--${name}=`;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === `--${name}` && argv[i + 1]) {
      return argv[i + 1]!.trim();
    }
    if (arg.startsWith(eq)) {
      return arg.slice(eq.length).trim();
    }
  }
  return null;
}

function parseKinds(argv: readonly string[]): string[] {
  const single = parseFlag(argv, "kind");
  const multi = parseFlag(argv, "kinds");
  const raw = multi ?? single;
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatHelp(): string {
  return [
    "Localization Authority Closure 08 — localization:check",
    "",
    "Usage:",
    "  pnpm localization:check -- --locale <locale> --kind <kind>",
    "  pnpm localization:check -- --locale <locale> --kinds a,b",
    "",
    "Flags:",
    "  --locale <code>     Required. Exactly one Registry locale.",
    "  --kind / --kinds    Required. Explicit CT/PLP/no-owner/protected kind(s).",
    "  --page-size=N       Optional bound for catalog/entity checks (default 50, max 100).",
    "  --help | -h         Print help.",
    "",
    "Read-only. No provider. No writes. No enqueue.",
    "Refuses unbounded --kind=all.",
    "Exit 2 when integrity report.blocking === true.",
  ].join("\n");
}

if (isHelp(process.argv)) {
  console.log(formatHelp());
  process.exit(0);
}

const locale = parseFlag(process.argv, "locale");
const kinds = parseKinds(process.argv);
const pageSizeRaw = parseFlag(process.argv, "page-size");
const pageSize = pageSizeRaw ? Number.parseInt(pageSizeRaw, 10) : undefined;

if (!locale) {
  console.error(JSON.stringify({ success: false, error: "Missing --locale" }));
  process.exit(1);
}
if (kinds.length === 0) {
  console.error(JSON.stringify({ success: false, error: "Missing --kind/--kinds" }));
  process.exit(1);
}

const { loadApiEnvironment } = await import("../config/load-api-environment.js");
loadApiEnvironment();

const { bootstrapContentTranslationOperatorPersistence } = await import(
  "../infrastructure/mongodb/bootstrap-content-translation-operator-persistence.js"
);
const { resolveContentTranslationOperatorHydrateScopes } = await import(
  "../modules/language/content-translation-staging-warm-operator-scope.js"
);
const { disconnectMongoClient } = await import(
  "../infrastructure/mongodb/mongo-connection.js"
);
const { runLocalizationIntegrityCheck } = await import(
  "../modules/language/localization-integrity-check.js"
);

let exitCode = 0;
try {
  // Same hydrate contract as warm:staging — do not hand-maintain a second map.
  // collaborative_analysis (and other initiative-scoped kinds) must hydrate
  // Initiative so published CA artifacts are discoverable.
  const hydrateScopes = resolveContentTranslationOperatorHydrateScopes(
    kinds as never,
  );
  await bootstrapContentTranslationOperatorPersistence({
    hydrateScopes,
  });

  const report = await runLocalizationIntegrityCheck({
    locale,
    kinds,
    pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        pack: report.pack,
        locale: report.locale,
        kindScope: report.kindScope,
        overallStatus: report.overallStatus,
        blocking: report.blocking,
        historicalBackfillRequired: report.historicalBackfillRequired,
        seoReady: report.seoReady,
        searchReady: report.searchReady,
        safety: report.safety,
        ownershipPolicy: {
          mediaCarouselDecision: report.ownershipPolicy.mediaCarouselDecision,
          mediaCarouselNote: report.ownershipPolicy.mediaCarouselNote,
          noOwner: report.ownershipPolicy.noOwner,
          protectedExcluded: report.ownershipPolicy.protectedExcluded,
        },
        artifacts: report.artifacts,
        gaps: report.gaps,
        readiness: {
          state: report.readiness.state,
          engineReady: report.readiness.engineReady,
          languageDataReady: report.readiness.languageDataReady,
          webUi: report.readiness.webUi,
          controlledVocabulary: {
            presentationReady: report.readiness.controlledVocabulary.presentationReady,
            conceptsMissingLocalizedLabel:
              report.readiness.controlledVocabulary.conceptsMissingLocalizedLabel,
            conceptsWithWebUiFallbackOnly:
              report.readiness.controlledVocabulary.conceptsWithWebUiFallbackOnly,
          },
          ct: report.readiness.ct,
          plpMedia: report.readiness.plpMedia,
        },
      },
      null,
      2,
    ),
  );

  if (report.blocking) {
    exitCode = 2;
  }
} catch (error) {
  exitCode = 1;
  console.error(
    JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
} finally {
  try {
    await disconnectMongoClient();
  } catch {
    // ignore
  }
}

process.exit(exitCode);
