/**
 * Reset 03A — thin Media PLP safety preflight CLI.
 *
 * Usage:
 *   pnpm --filter @hu/api diagnose:media-plp-preflight -- \
 *     --mongo \
 *     --entity-type civic_media_trusted \
 *     --entity-id reuters \
 *     --locale uk
 *
 * READ-ONLY. Cursor must not run this against staging/prod in this task.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { captureMediaPlpPreflightStart } from "../modules/language/media-plp-preflight/memory-phases.js";

captureMediaPlpPreflightStart();
loadApiEnvironment();

async function main(): Promise<void> {
  const { captureMediaPlpPreflightAfterImport } = await import(
    "../modules/language/media-plp-preflight/memory-phases.js"
  );
  captureMediaPlpPreflightAfterImport();

  const { printMediaPlpPreflightReport, runMediaPlpPreflight } = await import(
    "../modules/language/media-plp-preflight/run-preflight.js"
  );

  const result = await runMediaPlpPreflight(process.argv);
  if (result.errorMessage) {
    console.error(
      JSON.stringify({
        pack: "RESET_03A",
        operation: "diagnose_media_plp_preflight",
        fatal: true,
        message: result.errorMessage,
      }),
    );
    process.exitCode = result.exitCode;
    return;
  }
  if (result.report) {
    printMediaPlpPreflightReport(result.report);
  }
  process.exitCode = result.exitCode;
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        pack: "RESET_03A",
        operation: "diagnose_media_plp_preflight",
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
      const { markMediaPlpPreflightMongoClosed } = await import(
        "../modules/language/media-plp-preflight/counters.js"
      );
      markMediaPlpPreflightMongoClosed();
    } catch {
      // ignore
    }
    process.exit(process.exitCode ?? 0);
  });
