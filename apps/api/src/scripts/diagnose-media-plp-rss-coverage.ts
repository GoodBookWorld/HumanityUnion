/**
 * RESET 05C — diagnose:media-plp-rss-coverage (READ-ONLY).
 *
 * Usage:
 *   pnpm --filter @hu/api diagnose:media-plp-rss-coverage -- --mongo --locale uk
 *
 * Do not run against staging from Cursor automation unless explicitly requested.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const {
    parseMediaPlpRssCoverageArgs,
    printMediaPlpRssCoverageReport,
    runMediaPlpRssCoverageDiagnostic,
  } = await import(
    "../modules/language/media-plp-carousel/rss-coverage-diagnostic.js"
  );

  const args = parseMediaPlpRssCoverageArgs(process.argv.slice(2));
  if (!args.mongo) {
    console.error(
      JSON.stringify({
        pack: "RESET_05C",
        ok: false,
        errorMessage: "--mongo required (read-only durable PLP + public_news)",
      }),
    );
    process.exit(1);
  }

  const result = await runMediaPlpRssCoverageDiagnostic({ locale: args.locale });
  if (result.report) {
    printMediaPlpRssCoverageReport(result.report);
  }
  if (result.errorMessage) {
    console.error(
      JSON.stringify({
        pack: "RESET_05C",
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
      pack: "RESET_05C",
      ok: false,
      errorMessage: error instanceof Error ? error.message : "unknown",
    }),
  );
  process.exit(1);
});
