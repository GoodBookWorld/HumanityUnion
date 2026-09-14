/**
 * Operator script — retry ONE historical failed outbox record by ID.
 *
 * Default is dry-run (inspect only). Never touches production.
 *
 * Usage (Render Staging Shell / operator machine):
 *   pnpm retry:failed-outbox -- --outbox-id=<uuid>
 *   OUTBOX_RETRY_CONFIRM=YES pnpm retry:failed-outbox -- --outbox-id=<uuid> --execute
 *
 * Optional:
 *   --dispatch-now   After requeue, run one canonical dispatchOutboxBatch cycle.
 *
 * Required env for --execute:
 *   MONGODB_URI, MONGODB_DATABASE (staging DB)
 *   OUTBOX_RETRY_CONFIRM=YES
 *   PLATFORM_MODE must NOT be production
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { resolvePlatformMode } from "../config/platform.config.js";
import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../infrastructure/mongodb/mongo-connection.js";
import {
  assertSingleOutboxId,
  OutboxRecoveryNotFailedError,
  OutboxRecoveryNotFoundError,
  OutboxRecoveryValidationError,
} from "../infrastructure/outbox/outbox-recovery.errors.js";
import {
  formatRetryFailedOutboxSummary,
  retryFailedOutboxRecordById,
} from "../infrastructure/outbox/outbox-recovery.service.js";
import { findOutboxRecordById } from "../infrastructure/outbox/outbox.repository.js";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((entry) => entry.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  const outboxId = assertSingleOutboxId(readArg("outbox-id"));
  const execute = hasFlag("execute");
  const dispatchNow = hasFlag("dispatch-now");
  const platformMode = resolvePlatformMode();
  const explicitPlatformMode = process.env.PLATFORM_MODE?.trim();

  if (explicitPlatformMode === "production" || platformMode === "production") {
    throw new OutboxRecoveryValidationError(
      "Refusing outbox retry against PLATFORM_MODE=production.",
    );
  }

  if (!isMongoConfigured()) {
    throw new OutboxRecoveryValidationError("MONGODB_URI must be configured.");
  }

  await connectMongoClient();

  try {
    const existing = await findOutboxRecordById(outboxId);
    if (!existing) {
      throw new OutboxRecoveryNotFoundError(outboxId);
    }

    console.log("Outbox record (safe metadata only; envelope omitted):");
    console.log(`  outboxId=${existing.outboxId}`);
    console.log(`  eventId=${existing.eventId}`);
    console.log(`  eventName=${existing.eventName}`);
    console.log(`  aggregateType=${existing.aggregateType}`);
    console.log(`  aggregateId=${existing.aggregateId}`);
    console.log(`  status=${existing.status}`);
    console.log(`  attempts=${existing.attempts}`);
    console.log(`  lastError=${existing.lastError ?? "(none)"}`);
    console.log(`  createdAt=${existing.createdAt}`);
    console.log(`  publishedAt=${existing.publishedAt ?? "(null)"}`);

    if (!execute) {
      console.log("");
      console.log("Dry-run only. No writes performed.");
      console.log(
        "To requeue this failed record: OUTBOX_RETRY_CONFIRM=YES pnpm retry:failed-outbox -- --outbox-id=<id> --execute [--dispatch-now]",
      );
      return;
    }

    if (process.env.OUTBOX_RETRY_CONFIRM?.trim() !== "YES") {
      throw new OutboxRecoveryValidationError(
        "Refusing write: set OUTBOX_RETRY_CONFIRM=YES with --execute.",
      );
    }

    if (existing.status !== "failed") {
      throw new OutboxRecoveryNotFailedError(outboxId, existing.status);
    }

    const result = await retryFailedOutboxRecordById({
      outboxId,
      dispatchNow,
    });

    console.log("");
    console.log("Recovery result:");
    console.log(formatRetryFailedOutboxSummary(result));
  } finally {
    await disconnectMongoClient().catch(() => undefined);
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
