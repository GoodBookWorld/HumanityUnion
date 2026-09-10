/**
 * Closure 07 — language localization activation operator.
 *
 * Default DRY RUN. One locale only. Registry eligibility validated.
 * Execute delegates to existing bounded CT residual retry + Media PLP editorial enqueue.
 *
 * Usage (from apps/api):
 *   pnpm localization:activate-language -- --locale fr
 *   pnpm localization:activate-language -- --locale fr --execute
 *   pnpm localization:activate-language -- --help
 *
 * Do NOT run --execute against production without operator review.
 * Provider concurrency remains existing worker policy (≤1 default).
 */

export {};

function isHelp(argv: readonly string[]): boolean {
  return argv.includes("--help") || argv.includes("-h");
}

function parseLocale(argv: readonly string[]): string | null {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--locale" && argv[i + 1]) {
      return argv[i + 1]!.trim();
    }
    if (arg.startsWith("--locale=")) {
      return arg.slice("--locale=".length).trim();
    }
  }
  return null;
}

function formatHelp(): string {
  return [
    "Localization Authority Closure 07 — activate-language",
    "",
    "Usage:",
    "  pnpm localization:activate-language -- --locale <locale>",
    "  pnpm localization:activate-language -- --locale <locale> --execute",
    "",
    "Flags:",
    "  --locale <code>   Required. Exactly one Registry locale (e.g. fr, uk).",
    "  --execute         Enqueue bounded CT residual retry + PLP editorial when needed.",
    "  (default)         Dry-run readiness + historical plan (no writes, no provider).",
    "  --help | -h       Print help and exit.",
    "",
    "Notes:",
    "  - searchEnabled / seoIndexingEnabled are NOT mutated.",
    "  - public_news / RSS is excluded.",
    "  - Knowledge remains NO_TRANSLATION_OWNER (reported, does not block owned content).",
    "  - Provider concurrency stays on existing CT/PLP workers (default ≤1).",
  ].join("\n");
}

if (isHelp(process.argv)) {
  console.log(formatHelp());
  process.exit(0);
}

const locale = parseLocale(process.argv);
if (!locale) {
  console.error(
    JSON.stringify({
      success: false,
      error: "Missing required --locale <code>",
    }),
  );
  process.exit(1);
}

const execute = process.argv.includes("--execute");

const { loadApiEnvironment } = await import("../config/load-api-environment.js");
loadApiEnvironment();

const { bootstrapContentTranslationOperatorPersistence } = await import(
  "../infrastructure/mongodb/bootstrap-content-translation-operator-persistence.js"
);
const { disconnectMongoClient } = await import(
  "../infrastructure/mongodb/mongo-connection.js"
);
const { activateLanguageLocalization } = await import(
  "../modules/language/language-localization-activation/index.js"
);

let exitCode = 0;
try {
  await bootstrapContentTranslationOperatorPersistence({
    hydrateScopes: {
      initiative: true,
      collaborativeAnalysis: true,
      collectiveDecision: true,
    },
  });

  const result = await activateLanguageLocalization({
    locale,
    execute,
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        pack: result.pack,
        locale: result.locale,
        mode: result.mode,
        state: result.readiness.state,
        engineReady: result.readiness.engineReady,
        languageDataReady: result.readiness.languageDataReady,
        seoReady: result.readiness.seoReady,
        seoIndexingEnabledUnchanged: result.seoIndexingEnabledUnchanged,
        registry: result.readiness.registry,
        planSummary: result.plan.summary,
        excluded: result.plan.excluded,
        execute: result.execute,
        PROVIDER_CALLS: result.PROVIDER_CALLS,
        WRITES_PERFORMED: result.WRITES_PERFORMED,
        gaps: result.readiness.gaps,
      },
      null,
      2,
    ),
  );
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
