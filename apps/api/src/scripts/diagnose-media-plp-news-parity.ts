/**
 * Reset 03E.13 / 03E.13.1 — diagnose:media-plp-news-parity (READ-ONLY).
 *
 * Usage:
 *   pnpm --filter @hu/api diagnose:media-plp-news-parity -- --mongo --locale uk
 *
 * Cursor must not run this against staging in this task (no live ops).
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const {
    parseMediaPlpNewsParityArgs,
    printMediaPlpNewsParityReport,
    runMediaPlpNewsParityDiagnostic,
  } = await import(
    "../modules/language/media-plp-carousel/news-parity-diagnostic.js"
  );

  const args = parseMediaPlpNewsParityArgs(process.argv.slice(2));
  if (!args.mongo) {
    console.error(
      JSON.stringify({
        pack: "RESET_03E.13",
        ok: false,
        errorMessage: "--mongo required (read-only durable PLP + public_news)",
      }),
    );
    process.exit(1);
  }

  const result = await runMediaPlpNewsParityDiagnostic({ locale: args.locale });
  if (result.report) {
    printMediaPlpNewsParityReport(result.report);
  }
  if (result.errorMessage) {
    console.error(
      JSON.stringify({
        pack: "RESET_03E.13",
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
      pack: "RESET_03E.13",
      ok: false,
      errorMessage: error instanceof Error ? error.message : "unknown",
    }),
  );
  process.exit(1);
});
