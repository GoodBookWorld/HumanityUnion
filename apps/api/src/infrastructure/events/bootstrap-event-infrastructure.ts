import { isMongoConfigured } from "../mongodb/mongo-config.js";
import { connectMongoClient } from "../mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../mongodb/mongo-indexes.js";
import { registerWorkspaceProjectionHandlers } from "../../modules/workspace/index.js";
import { startOutboxDispatcher } from "../outbox/outbox.dispatcher.js";
import { logger } from "../../shared/observability/logger.js";

/**
 * Ensures event infrastructure indexes exist and starts the outbox dispatcher when enabled.
 * Safe to call on every API boot; no-op when MongoDB is not configured.
 */
export async function bootstrapEventInfrastructure(): Promise<void> {
  if (!isMongoConfigured()) {
    logger.info("event_infrastructure.skipped", {
      component: "event-infrastructure",
      reason: "mongodb_not_configured",
    });
    return;
  }

  await connectMongoClient();
  await ensureMongoIndexes();
  registerWorkspaceProjectionHandlers();
  startOutboxDispatcher();

  logger.info("event_infrastructure.ready", { component: "event-infrastructure" });
}

export async function shutdownEventInfrastructure(): Promise<void> {
  const { stopOutboxDispatcher } = await import("../outbox/outbox.dispatcher.js");
  stopOutboxDispatcher();
}
