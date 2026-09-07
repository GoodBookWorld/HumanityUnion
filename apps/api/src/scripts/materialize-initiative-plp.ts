/**
 * RESET 05B — materialize:initiative-plp (thin one-entity).
 *
 * Dry-run (default):
 *   pnpm --filter @hu/api materialize:initiative-plp -- \
 *     --mongo \
 *     --initiative-id <id> \
 *     --locale uk
 *
 * Execute (staging only; not run in Cursor tasks):
 *   ... --execute
 *
 * Default provider transport: fake_local (set HU_INITIATIVE_PLP_PROVIDER=thin_gemini for Gemini).
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const { printInitiativePlpMaterializeReport, runInitiativePlpMaterialize } =
    await import(
      "../modules/language/initiative-plp-operator/run-materialize.js"
    );

  const result = await runInitiativePlpMaterialize(process.argv);
  if (result.errorMessage && !result.report) {
    console.error(
      JSON.stringify({
        pack: "RESET_05B",
        operation: "materialize_initiative_plp",
        fatal: true,
        message: result.errorMessage,
      }),
    );
    process.exitCode = result.exitCode;
    return;
  }
  if (result.report) {
    printInitiativePlpMaterializeReport(result.report);
  }
  if (result.errorMessage) {
    console.error(
      JSON.stringify({
        pack: "RESET_05B",
        operation: "materialize_initiative_plp",
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
        operation: "materialize_initiative_plp",
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
