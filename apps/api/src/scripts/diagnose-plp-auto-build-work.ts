/**
 * RESET 05C.1 — diagnose:plp-auto-build-work (READ-ONLY Mongo counts).
 *
 * Usage:
 *   pnpm --filter @hu/api diagnose:plp-auto-build-work -- --mongo
 *
 * Shell CANNOT see API in-memory counters — use Admin
 * GET /api/v1/admin/diagnostics/plp-auto-build for process state.
 *
 * Do not run against staging from Cursor automation unless explicitly requested.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mongo = args.includes("--mongo");
  if (!mongo) {
    console.error(
      JSON.stringify({
        pack: "RESET_05C_1",
        ok: false,
        errorMessage:
          "--mongo required (read-only durable plp_auto_build_work counts). Shell cannot see API process counters — use Admin GET /api/v1/admin/diagnostics/plp-auto-build.",
      }),
    );
    process.exit(1);
  }

  const { isMongoConfigured } = await import(
    "../infrastructure/mongodb/mongo-config.js"
  );
  if (!isMongoConfigured()) {
    console.error(
      JSON.stringify({
        pack: "RESET_05C_1",
        ok: false,
        errorMessage: "diagnose:plp-auto-build-work --mongo requires MONGODB_URI",
      }),
    );
    process.exit(1);
  }

  const { connectMongoClient } = await import(
    "../infrastructure/mongodb/mongo-connection.js"
  );
  await connectMongoClient();

  const { countPlpAutoBuildWorkByStatus, resolvePlpAutoBuildQueueBackend } =
    await import(
      "../modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js"
    ).then(async (work) => {
      const runtime = await import(
        "../modules/language/published-localized-presentation/universal/plp-auto-build-runtime.js"
      );
      return {
        countPlpAutoBuildWorkByStatus: work.countPlpAutoBuildWorkByStatus,
        resolvePlpAutoBuildQueueBackend: runtime.resolvePlpAutoBuildQueueBackend,
      };
    });

  const counts = await countPlpAutoBuildWorkByStatus();
  console.log(
    JSON.stringify(
      {
        pack: "RESET_05C_1",
        ok: true,
        readOnly: true,
        QUEUE_BACKEND: resolvePlpAutoBuildQueueBackend(),
        note: "Persisted Mongo counts only. Process counters require Admin diagnostics endpoint on the RUNNING API.",
        workCounts: counts,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      pack: "RESET_05C_1",
      ok: false,
      errorMessage: error instanceof Error ? error.message : "unknown",
    }),
  );
  process.exit(1);
});
