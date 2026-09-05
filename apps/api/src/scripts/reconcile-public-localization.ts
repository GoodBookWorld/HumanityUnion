/**
 * Pack 08K.1 / 08K.2.2 / 08K.2.8 — public localization operator entry.
 *
 * Defaults to READ-ONLY dry-run reconciliation (heavy graph, lazy-loaded).
 *
 * Pack 08K.2.8 — residual observation MUST use the thin diagnostic:
 *   pnpm --filter @hu/api diagnose:localization-residuals -- --mongo \
 *     --residual sourceKind:id:locale
 *
 * OPERATOR_DEPRECATED_MEMORY_UNSAFE (do not run on Render):
 *   --explain-residuals / --explain-residuals-only
 *   --snapshot-explicit-residual-state
 * Snapshot delegates to the thin diagnostic WITHOUT importing the heavy graph.
 * Explain refuses with exit 2.
 *
 * Heavy modes (lazy import of reconcile-public-localization-heavy.ts):
 *   (default) dry-run coverage + work-item report
 *   --retry-ready-residuals
 *   --retry-explicit-residuals-after-failure-reason-fix
 *   --execute (staging gates)
 *
 * Cursor must not run --mongo/--execute against staging/prod.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";

loadApiEnvironment();

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

const wantsSnapshot = hasFlag("--snapshot-explicit-residual-state");
const wantsExplain =
  hasFlag("--explain-residuals") || hasFlag("--explain-residuals-only");

async function delegateSnapshotToThinDiagnostic(): Promise<void> {
  console.error(
    JSON.stringify({
      OPERATOR_DEPRECATED_MEMORY_UNSAFE: true,
      flag: "--snapshot-explicit-residual-state",
      reason:
        "Pre-08K.2.8 reconcile entry statically imported ~400+ modules (language-registry→global-search, content-translation.service→Gemini, civic Map stores, corpus helpers) before main(); FULL_CORPUS_HYDRATED=false only describes residual bootstrap, not import RSS. Staging OOM on four --residual identities at commit 417c003.",
      delegatedTo: "diagnose:localization-residuals",
      replacement:
        "pnpm --filter @hu/api diagnose:localization-residuals -- --mongo --residual sourceKind:id:locale",
    }),
  );

  const {
    printThinLocalizationDiagnosticReport,
    runThinLocalizationResidualDiagnostic,
  } = await import(
    "../modules/language/thin-localization-diagnostic/run-thin-diagnostic.js"
  );

  const argv = process.argv.includes("--mongo")
    ? process.argv
    : [...process.argv, "--mongo"];
  const result = await runThinLocalizationResidualDiagnostic(argv);
  if (result.errorMessage) {
    console.error(
      JSON.stringify({
        pack: "08K.2.8",
        operation: "diagnose_localization_residuals",
        fatal: true,
        message: result.errorMessage,
        via: "reconcile_snapshot_delegate",
      }),
    );
    process.exitCode = result.exitCode;
    return;
  }
  if (result.report) {
    printThinLocalizationDiagnosticReport({
      ...result.report,
      note: `${result.report.note} (delegated from deprecated --snapshot-explicit-residual-state)`,
    });
  }
  process.exitCode = result.exitCode;
}

async function refuseDeprecatedExplain(): Promise<void> {
  console.error(
    JSON.stringify({
      OPERATOR_DEPRECATED_MEMORY_UNSAFE: true,
      flag: "--explain-residuals / --explain-residuals-only",
      reason:
        "Even with bounded inner residual queries, loading reconcile-public-localization.ts historically imported the full application/provider graph before main(), exceeding Render staging memory.",
      replacement:
        "pnpm --filter @hu/api diagnose:localization-residuals -- --mongo --residual sourceKind:id:locale",
    }),
  );
  process.exitCode = 2;
}

async function runHeavy(): Promise<void> {
  const {
    disconnectReconcilePublicLocalizationHeavy,
    runReconcilePublicLocalizationHeavy,
  } = await import("./reconcile-public-localization-heavy.js");
  try {
    await runReconcilePublicLocalizationHeavy();
  } finally {
    try {
      await disconnectReconcilePublicLocalizationHeavy();
    } catch {
      // ignore
    }
  }
}

async function boot(): Promise<void> {
  if (wantsSnapshot) {
    await delegateSnapshotToThinDiagnostic();
    return;
  }
  if (wantsExplain) {
    await refuseDeprecatedExplain();
    return;
  }
  await runHeavy();
}

boot()
  .catch(async (error) => {
    try {
      const { StagingContentTranslationDiscoveryFailure } = await import(
        "../modules/language/content-translation-staging-warm-discovery-safety.js"
      );
      if (error instanceof StagingContentTranslationDiscoveryFailure) {
        console.error(
          JSON.stringify({
            pack: "08K.2.2",
            operation: "reconcile_public_localization",
            fatal: true,
            code: error.code,
            message: error.message,
            diagnostics: error.diagnostics,
          }),
        );
      } else {
        console.error(
          JSON.stringify({
            pack: "08K.2.2",
            operation: "reconcile_public_localization",
            fatal: true,
            errorName: error instanceof Error ? error.name : "Error",
            message: error instanceof Error ? error.message : "unknown",
          }),
        );
      }
    } catch {
      console.error(
        JSON.stringify({
          pack: "08K.2.2",
          operation: "reconcile_public_localization",
          fatal: true,
          errorName: error instanceof Error ? error.name : "Error",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
