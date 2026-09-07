import { isMongoConfigured } from "../mongodb/mongo-config.js";
import { connectMongoClient } from "../mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../mongodb/mongo-indexes.js";
import { registerWorkspaceProjectionHandlers } from "../../modules/workspace/index.js";
import { registerParticipantActionHandlers } from "../../modules/participant-action/index.js";
import { registerInitiativeLifecycleStageHandlers } from "../../shared/initiative-lifecycle-stage/index.js";
import { registerBlogPublicationDeliveryHandlers } from "../../modules/blog/blog-publication-delivery.index.js";
import { registerBlogAdminSubscriberMessageHandlers } from "../../modules/blog/blog-subscription-admin-message.index.js";
import { registerAdminNotificationHandlers } from "../../modules/admin-notifications/index.js";
import { registerContentTranslationWarmHandlers } from "../../modules/language/content-translation-warm-consumer.js";
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
  registerParticipantActionHandlers();
  registerInitiativeLifecycleStageHandlers();
  registerBlogPublicationDeliveryHandlers();
  registerBlogAdminSubscriberMessageHandlers();
  registerAdminNotificationHandlers();
  registerContentTranslationWarmHandlers();
  startOutboxDispatcher();

  // RESET 05C — fire-and-forget PLP auto-build processor (in-process queue).
  void import(
    "../../modules/language/published-localized-presentation/universal/register-plp-auto-build-processor.js"
  )
    .then(({ registerPlpAutoBuildProcessor }) => {
      const result = registerPlpAutoBuildProcessor();
      logger.info("plp_auto_build_processor.register", {
        component: "event-infrastructure",
        registered: result.registered,
        reason: result.reason,
        locales: result.locales,
        status: result.status,
      });
    })
    .catch((error: unknown) => {
      logger.warn("plp_auto_build_processor.register_failed", {
        component: "event-infrastructure",
        error: error instanceof Error ? error.message : "unknown",
      });
    });

  logger.info("event_infrastructure.ready", { component: "event-infrastructure" });
}

export async function shutdownEventInfrastructure(): Promise<void> {
  const { stopOutboxDispatcher } = await import("../outbox/outbox.dispatcher.js");
  stopOutboxDispatcher();
}
