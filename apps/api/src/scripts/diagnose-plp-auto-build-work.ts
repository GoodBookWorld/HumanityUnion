/**
 * RESET 05C.1 / 05C.2 — diagnose:plp-auto-build-work (READ-ONLY).
 *
 * Counts:
 *   pnpm --filter @hu/api diagnose:plp-auto-build-work -- --mongo
 *
 * Failed rows (bounded):
 *   pnpm --filter @hu/api diagnose:plp-auto-build-work -- \
 *     --mongo \
 *     --failed \
 *     --limit 20
 *
 * Shell CANNOT see API in-memory counters — use Admin
 * GET /api/v1/admin/diagnostics/plp-auto-build for process state.
 *
 * Do not run against staging from Cursor automation unless explicitly requested.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";

loadApiEnvironment();

function flagValue(argv: readonly string[], flag: string): string | null {
  const idx = argv.indexOf(flag);
  if (idx < 0) {
    return null;
  }
  const value = argv[idx + 1];
  if (!value || value.startsWith("--")) {
    return null;
  }
  return value.trim();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mongo = args.includes("--mongo");
  const failed = args.includes("--failed");
  const limitRaw = flagValue(args, "--limit");

  if (!mongo) {
    console.error(
      JSON.stringify({
        pack: "RESET_05C_2",
        ok: false,
        errorMessage:
          "--mongo required (read-only durable plp_auto_build_work). Shell cannot see API process counters — use Admin GET /api/v1/admin/diagnostics/plp-auto-build.",
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
        pack: "RESET_05C_2",
        ok: false,
        errorMessage: "diagnose:plp-auto-build-work --mongo requires MONGODB_URI",
      }),
    );
    process.exit(1);
  }

  if (limitRaw && !failed) {
    console.error(
      JSON.stringify({
        pack: "RESET_05C_2",
        ok: false,
        errorMessage: "--limit requires --failed",
      }),
    );
    process.exit(1);
  }

  let limit = 20;
  if (limitRaw) {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      console.error(
        JSON.stringify({
          pack: "RESET_05C_2",
          ok: false,
          errorMessage: "--limit must be a positive integer",
        }),
      );
      process.exit(1);
    }
    if (parsed > 20) {
      console.error(
        JSON.stringify({
          pack: "RESET_05C_2",
          ok: false,
          errorMessage: "--limit max is 20",
        }),
      );
      process.exit(1);
    }
    limit = parsed;
  }

  const { connectMongoClient, disconnectMongoClient } = await import(
    "../infrastructure/mongodb/mongo-connection.js"
  );
  await connectMongoClient();

  try {
    if (failed) {
      const { bootstrapPublishedLocalizationPersistence } = await import(
        "../infrastructure/mongodb/bootstrap-published-localization-persistence.js"
      );
      await bootstrapPublishedLocalizationPersistence();

      const { inspectPlpAutoBuildFailedWork } = await import(
        "../modules/language/published-localized-presentation/universal/plp-auto-build-work-failure-diagnostic.js"
      );
      const { countPlpAutoBuildWorkByStatus } = await import(
        "../modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js"
      );
      const { resolvePlpAutoBuildQueueBackend } = await import(
        "../modules/language/published-localized-presentation/universal/plp-auto-build-runtime.js"
      );

      const workCounts = await countPlpAutoBuildWorkByStatus();
      const report = await inspectPlpAutoBuildFailedWork({ limit });

      console.log(
        JSON.stringify(
          {
            ok: true,
            QUEUE_BACKEND: resolvePlpAutoBuildQueueBackend(),
            workCounts,
            FAILED_TOTAL_PERSISTED: workCounts.failed,
            // Sample enrichment (bounded). FAILED_TOTAL prefers persisted count.
            ...report,
            FAILED_TOTAL: workCounts.failed,
            ROWS_RETURNED: report.ROWS_RETURNED,
          },
          null,
          2,
        ),
      );
      process.exit(0);
    }

    const { countPlpAutoBuildWorkByStatus } = await import(
      "../modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js"
    );
    const { resolvePlpAutoBuildQueueBackend } = await import(
      "../modules/language/published-localized-presentation/universal/plp-auto-build-runtime.js"
    );

    const counts = await countPlpAutoBuildWorkByStatus();
    console.log(
      JSON.stringify(
        {
          pack: "RESET_05C_2",
          ok: true,
          readOnly: true,
          QUEUE_BACKEND: resolvePlpAutoBuildQueueBackend(),
          note: "Persisted Mongo counts only. Process counters require Admin diagnostics endpoint on the RUNNING API. Use --failed --limit 20 for bounded failure rows.",
          workCounts: counts,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  } finally {
    try {
      await disconnectMongoClient();
    } catch {
      // ignore
    }
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      pack: "RESET_05C_2",
      ok: false,
      errorMessage: error instanceof Error ? error.message : "unknown",
    }),
  );
  process.exit(1);
});
