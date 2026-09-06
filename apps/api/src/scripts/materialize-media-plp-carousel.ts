/**
 * Reset 03E.10 — materialize:media-plp-carousel (bounded sequential).
 *
 * Dry-run (default):
 *   pnpm --filter @hu/api materialize:media-plp-carousel -- --mongo --locale uk
 *
 * Execute (staging only; not run in Cursor tasks):
 *   ... --execute [--country-code UA] [--limit 20]
 *
 * Cursor must not run --execute against staging here.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const {
    printMediaPlpCarouselMaterializeReport,
    runMediaPlpCarouselMaterializer,
  } = await import(
    "../modules/language/media-plp-carousel-materializer/run-carousel-materializer.js"
  );

  const result = await runMediaPlpCarouselMaterializer(process.argv);
  if (result.report) {
    printMediaPlpCarouselMaterializeReport(result.report);
  }
  if (result.errorMessage && !result.report) {
    console.error(
      JSON.stringify({
        pack: "RESET_03E.10",
        operation: "materialize_media_plp_carousel",
        fatal: true,
        message: result.errorMessage,
      }),
    );
  } else if (result.errorMessage) {
    console.error(
      JSON.stringify({
        pack: "RESET_03E.10",
        operation: "materialize_media_plp_carousel",
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
        pack: "RESET_03E.10",
        operation: "materialize_media_plp_carousel",
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
    } catch {
      // ignore
    }
    process.exit(process.exitCode ?? 0);
  });
