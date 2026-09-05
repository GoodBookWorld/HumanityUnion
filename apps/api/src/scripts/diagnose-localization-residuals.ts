/**
 * Pack 08K.2.8 — thin localization residual diagnostic CLI.
 *
 * Usage:
 *   pnpm --filter @hu/api diagnose:localization-residuals -- --mongo \
 *     --residual sourceKind:id:locale
 *
 * READ-ONLY. Never routes through reconcile-public-localization.ts.
 * Cursor must not run this against staging/prod.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  captureThinLocalizationProcessStart,
} from "../modules/language/thin-localization-diagnostic/memory-phases.js";

captureThinLocalizationProcessStart();
loadApiEnvironment();

async function main(): Promise<void> {
  const { captureThinLocalizationAfterImports } = await import(
    "../modules/language/thin-localization-diagnostic/memory-phases.js"
  );
  captureThinLocalizationAfterImports();

  const {
    printThinLocalizationDiagnosticReport,
    runThinLocalizationResidualDiagnostic,
  } = await import(
    "../modules/language/thin-localization-diagnostic/run-thin-diagnostic.js"
  );

  const result = await runThinLocalizationResidualDiagnostic(process.argv);
  if (result.errorMessage) {
    console.error(
      JSON.stringify({
        pack: "08K.2.8",
        operation: "diagnose_localization_residuals",
        fatal: true,
        message: result.errorMessage,
      }),
    );
    process.exitCode = result.exitCode;
    return;
  }
  if (result.report) {
    printThinLocalizationDiagnosticReport(result.report);
  }
  process.exitCode = result.exitCode;
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        pack: "08K.2.8",
        operation: "diagnose_localization_residuals",
        fatal: true,
        errorName: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      const { disconnectMongoClient } = await import(
        "../infrastructure/mongodb/mongo-connection.js"
      );
      await disconnectMongoClient();
      const { markThinMongoClosed } = await import(
        "../modules/language/thin-localization-diagnostic/thin-counters.js"
      );
      markThinMongoClosed();
    } catch {
      // ignore
    }
    process.exit(process.exitCode ?? 0);
  });
