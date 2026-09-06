/**
 * Reset 03C — diagnose:media-plp-consumer (READ-ONLY).
 *
 * Usage:
 *   pnpm --filter @hu/api diagnose:media-plp-consumer -- \
 *     --mongo \
 *     --entity-type civic_media_trusted \
 *     --entity-id reuters \
 *     --locale uk
 *
 * Cursor must not run this against staging in this task.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const {
    printMediaPlpConsumerAcceptanceReport,
    runMediaPlpConsumerAcceptance,
  } = await import(
    "../modules/language/media-plp-consumer-acceptance/run-acceptance.js"
  );

  const result = await runMediaPlpConsumerAcceptance(process.argv);
  if (result.report) {
    printMediaPlpConsumerAcceptanceReport(result.report);
  }
  if (result.errorMessage) {
    console.error(
      JSON.stringify({
        pack: "RESET_03C",
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
      pack: "RESET_03C",
      ok: false,
      errorMessage: error instanceof Error ? error.message : "unknown",
    }),
  );
  process.exit(1);
});
