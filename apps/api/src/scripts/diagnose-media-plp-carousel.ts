/**
 * Reset 03E.9 — diagnose:media-plp-carousel (READ-ONLY).
 *
 * Usage:
 *   pnpm --filter @hu/api diagnose:media-plp-carousel -- --mongo --locale uk
 *   pnpm --filter @hu/api diagnose:media-plp-carousel -- --mongo --locale uk --country-code UA
 *
 * Cursor must not run this against staging in this task (no live ops).
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const {
    printMediaPlpCarouselReport,
    runMediaPlpCarouselDiagnostic,
  } = await import("../modules/language/media-plp-carousel/run-carousel.js");

  const result = await runMediaPlpCarouselDiagnostic(process.argv);
  if (result.report) {
    printMediaPlpCarouselReport(result.report);
  }
  if (result.errorMessage) {
    console.error(
      JSON.stringify({
        pack: "RESET_03E.9",
        ok: false,
        errorMessage: result.errorMessage,
      }),
    );
  }
  process.exit(result.exitCode);
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      pack: "RESET_03E.9",
      ok: false,
      errorMessage: error instanceof Error ? error.message : "unknown",
    }),
  );
  process.exit(1);
});
