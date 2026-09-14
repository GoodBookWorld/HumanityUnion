/**
 * Reset 03B — thin single-entity Media PLP materializer CLI.
 *
 * Dry-run (default):
 *   pnpm --filter @hu/api materialize:media-plp -- \
 *     --mongo \
 *     --entity-type civic_media_trusted \
 *     --entity-id reuters \
 *     --locale uk
 *
 * Execute (staging only; not run in Cursor tasks):
 *   ... --execute
 *
 * READ-only by default. Cursor must not run --execute against staging here.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { captureMaterializerStart } from "../modules/language/media-plp-materializer/memory-phases.js";

captureMaterializerStart();
loadApiEnvironment();

async function main(): Promise<void> {
  const { captureMaterializerAfterImport } = await import(
    "../modules/language/media-plp-materializer/memory-phases.js"
  );
  captureMaterializerAfterImport();

  const { printMediaPlpMaterializerReport, runMediaPlpMaterializer } = await import(
    "../modules/language/media-plp-materializer/run-materializer.js"
  );

  const result = await runMediaPlpMaterializer(process.argv);
  if (result.errorMessage && !result.report) {
    console.error(
      JSON.stringify({
        pack: "RESET_03B",
        operation: "materialize_media_plp",
        fatal: true,
        message: result.errorMessage,
      }),
    );
    process.exitCode = result.exitCode;
    return;
  }
  if (result.report) {
    printMediaPlpMaterializerReport(result.report);
  }
  if (result.errorMessage) {
    console.error(
      JSON.stringify({
        pack: "RESET_03B",
        operation: "materialize_media_plp",
        fatal: false,
        message: result.errorMessage,
      }),
    );
  }
  process.exitCode = result.exitCode;
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        pack: "RESET_03B",
        operation: "materialize_media_plp",
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
      const { markMaterializerMongoClosed } = await import(
        "../modules/language/media-plp-materializer/counters.js"
      );
      markMaterializerMongoClosed();
    } catch {
      // ignore
    }
    process.exit(process.exitCode ?? 0);
  });
