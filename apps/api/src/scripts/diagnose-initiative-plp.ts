/**
 * RESET 05B / 05B.1 — diagnose:initiative-plp (READ-ONLY).
 *
 * Identity:
 *   pnpm --filter @hu/api diagnose:initiative-plp -- \
 *     --mongo \
 *     --initiative-id <id> \
 *     --locale uk
 *
 * PUBLIC_CHOICE discovery (bounded):
 *   pnpm --filter @hu/api diagnose:initiative-plp -- \
 *     --mongo \
 *     --list-public-choice
 *
 * Zero provider calls. Zero PLP writes. Zero Mongo writes.
 * Cursor must not run this against staging/prod in implementation tasks.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const { printInitiativePlpDiagnoseReport, runInitiativePlpDiagnose } =
    await import("../modules/language/initiative-plp-operator/run-diagnose.js");

  const result = await runInitiativePlpDiagnose(process.argv);
  if (result.errorMessage && !result.report) {
    console.error(
      JSON.stringify({
        pack: "RESET_05B",
        operation: "diagnose_initiative_plp",
        fatal: true,
        message: result.errorMessage,
      }),
    );
    process.exitCode = result.exitCode;
    return;
  }
  if (result.report) {
    printInitiativePlpDiagnoseReport(result.report);
  }
  if (result.errorMessage) {
    console.error(
      JSON.stringify({
        pack: "RESET_05B",
        operation: "diagnose_initiative_plp",
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
        pack: "RESET_05B",
        operation: "diagnose_initiative_plp",
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
