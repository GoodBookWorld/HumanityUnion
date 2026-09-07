/**
 * RESET 05D — diagnose:media-live-closure (READ-ONLY).
 *
 * Usage:
 *   pnpm --filter @hu/api diagnose:media-live-closure -- \
 *     --mongo --locale uk --country-code CA --country-name Canada --region-name Americas
 *
 * Do not run against staging from Cursor automation unless explicitly requested.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const {
    parseMediaLiveClosureArgs,
    printMediaLiveClosureReport,
    runMediaLiveClosureDiagnostic,
  } = await import(
    "../modules/language/media-plp-carousel/media-live-closure-diagnostic.js"
  );

  const args = parseMediaLiveClosureArgs(process.argv.slice(2));
  if (!args.mongo) {
    console.error(
      JSON.stringify({
        pack: "RESET_05D",
        ok: false,
        errorMessage: "--mongo required (read-only durable PLP + public_news)",
      }),
    );
    process.exit(1);
  }

  const report = await runMediaLiveClosureDiagnostic({
    locale: args.locale,
    countryCode: args.countryCode,
    countryName: args.countryName ?? args.countryCode,
    regionName: args.regionName,
  });
  printMediaLiveClosureReport(report);
  process.exit(report.ok ? 0 : 2);
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      pack: "RESET_05D",
      ok: false,
      errorMessage: error instanceof Error ? error.message : "unknown",
    }),
  );
  process.exit(1);
});
