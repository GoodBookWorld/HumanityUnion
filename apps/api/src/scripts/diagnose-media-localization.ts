/**
 * Pack 08K.3.2 — thin Media localization diagnostic CLI.
 *
 * Usage:
 *   pnpm --filter @hu/api diagnose:media-localization -- --mongo --locale uk
 *
 * READ-ONLY. Cursor must not run this against staging/prod.
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
    printThinMediaLocalizationDiagnosticReport,
    runThinMediaLocalizationDiagnostic,
  } = await import(
    "../modules/language/thin-media-localization-diagnostic/run-media-diagnostic.js"
  );

  const result = await runThinMediaLocalizationDiagnostic(process.argv);
  if (result.errorMessage) {
    console.error(
      JSON.stringify({
        pack: "08K.3.2",
        operation: "diagnose_media_localization",
        fatal: true,
        message: result.errorMessage,
      }),
    );
    process.exitCode = result.exitCode;
    return;
  }
  if (result.report) {
    printThinMediaLocalizationDiagnosticReport(result.report);
  }
  process.exitCode = result.exitCode;
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        pack: "08K.3.2",
        operation: "diagnose_media_localization",
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
