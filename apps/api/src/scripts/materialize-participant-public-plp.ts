/**
 * Bounded materialize:participant-public-plp (identity, page, or historical).
 *
 * Dry-run (default):
 *   pnpm materialize:participant-public-plp -- --mongo --profile-id <id>
 *   pnpm materialize:participant-public-plp -- --mongo --public-name <name>
 *   pnpm materialize:participant-public-plp -- --mongo --limit 5
 *   pnpm materialize:participant-public-plp -- --mongo --historical
 *
 * Resume historical / paged limit:
 *   ... --historical --after-profile-id <resumeAfterProfileId from prior report>
 *
 * Execute (staging only; not run from Cursor tasks):
 *   ... --execute
 *
 * Optional: --locale <code> (otherwise Registry targets excluding source en)
 * Optional: --page-size <1..25> (historical default 10)
 * Optional: --max-pages <n> (historical safety cap per invocation)
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const {
    printParticipantPublicPlpMaterializeReport,
    runParticipantPublicPlpMaterialize,
  } = await import(
    "../modules/language/published-localized-presentation/universal/participant-public-plp-operator.js"
  );

  const result = await runParticipantPublicPlpMaterialize(process.argv);
  if (result.errorMessage && !result.report) {
    console.error(
      JSON.stringify({
        pack: "PARTICIPANT_PUBLIC_PLP",
        operation: "materialize_participant_public_plp",
        fatal: true,
        message: result.errorMessage,
      }),
    );
    process.exitCode = result.exitCode;
    return;
  }
  if (result.report) {
    printParticipantPublicPlpMaterializeReport(result.report);
  }
  if (result.errorMessage) {
    console.error(
      JSON.stringify({
        pack: "PARTICIPANT_PUBLIC_PLP",
        operation: "materialize_participant_public_plp",
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
        pack: "PARTICIPANT_PUBLIC_PLP",
        operation: "materialize_participant_public_plp",
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
