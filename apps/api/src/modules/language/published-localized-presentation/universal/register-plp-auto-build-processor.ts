/**
 * RESET 05C / 05C.1 — register + bootstrap the PLP auto-build processor.
 *
 * Enable when:
 * - HU_PLP_AUTO_BUILD_PROCESSOR is not "0" (default: enabled when locales set)
 * - HU_PLP_AUTO_BUILD_LOCALES is non-empty (safety allowlist — no uncontrolled fanout)
 *
 * RESET 05C.1 — durable work + bounded drain interval; call from index.ts
 * AFTER bootstrapPublishedLocalizationPersistence and BEFORE news scheduler.
 */

import { isMongoConfigured } from "../../../../infrastructure/mongodb/mongo-config.js";
import { logger } from "../../../../shared/observability/logger.js";
import {
  assertPublishedLocalizationMongoPersistenceActive,
  getPublishedLocalizationPersistenceMode,
  requirePublishedLocalizationMongoPersistence,
} from "../persistence/repository.js";
import {
  QUEUE_ACTIVE_PROVIDER_ACTIVE,
  QUEUE_ACTIVE_PROVIDER_DORMANT,
  setMediaLocalizationBuildHookStatus,
} from "../media/publication-hook.js";
import { kickPlpAutoBuildDrain, setPlpBuildRequestProcessor } from "./build-request-queue.js";
import { processPlpBuildRequest } from "./process-plp-build-request.js";
import {
  refreshPlpAutoBuildQueueDepthFromStore,
  resolvePlpAutoBuildQueueBackend,
  setPlpAutoBuildProcessorRegistered,
  setPlpAutoBuildStartupStatus,
} from "./plp-auto-build-runtime.js";
import { resolvePlpAutoBuildLocales } from "./public-source-mutation-bridge.js";

const DRAIN_INTERVAL_MS = 3_000;

let drainTimer: NodeJS.Timeout | null = null;

export type RegisterPlpAutoBuildProcessorResult = {
  readonly registered: boolean;
  readonly reason: "active" | "disabled_by_env" | "no_locales";
  readonly locales: readonly string[];
  readonly localesCount: number;
  readonly status:
    | typeof QUEUE_ACTIVE_PROVIDER_ACTIVE
    | typeof QUEUE_ACTIVE_PROVIDER_DORMANT;
};

function stopPlpAutoBuildDrainInterval(): void {
  if (drainTimer) {
    clearInterval(drainTimer);
    drainTimer = null;
  }
}

function startPlpAutoBuildDrainInterval(): void {
  if (drainTimer) {
    return;
  }
  drainTimer = setInterval(() => {
    kickPlpAutoBuildDrain();
  }, DRAIN_INTERVAL_MS);
  drainTimer.unref?.();
}

/**
 * Synchronous register (tests + bootstrap helper).
 * Does not start the drain interval — prefer bootstrapPlpAutoBuildRuntime in production.
 */
export function registerPlpAutoBuildProcessor(): RegisterPlpAutoBuildProcessorResult {
  if (process.env.HU_PLP_AUTO_BUILD_PROCESSOR === "0") {
    setPlpBuildRequestProcessor(null);
    setPlpAutoBuildProcessorRegistered(false);
    setMediaLocalizationBuildHookStatus(QUEUE_ACTIVE_PROVIDER_DORMANT);
    stopPlpAutoBuildDrainInterval();
    return {
      registered: false,
      reason: "disabled_by_env",
      locales: [],
      localesCount: 0,
      status: QUEUE_ACTIVE_PROVIDER_DORMANT,
    };
  }

  const locales = resolvePlpAutoBuildLocales();
  if (locales.length === 0) {
    setPlpBuildRequestProcessor(null);
    setPlpAutoBuildProcessorRegistered(false);
    setMediaLocalizationBuildHookStatus(QUEUE_ACTIVE_PROVIDER_DORMANT);
    stopPlpAutoBuildDrainInterval();
    return {
      registered: false,
      reason: "no_locales",
      locales: [],
      localesCount: 0,
      status: QUEUE_ACTIVE_PROVIDER_DORMANT,
    };
  }

  setPlpBuildRequestProcessor((request) => processPlpBuildRequest(request));
  setPlpAutoBuildProcessorRegistered(true);
  setMediaLocalizationBuildHookStatus(QUEUE_ACTIVE_PROVIDER_ACTIVE);
  return {
    registered: true,
    reason: "active",
    locales,
    localesCount: locales.length,
    status: QUEUE_ACTIVE_PROVIDER_ACTIVE,
  };
}

export type BootstrapPlpAutoBuildRuntimeResult = RegisterPlpAutoBuildProcessorResult & {
  readonly queueBackend: "MONGO" | "MEMORY";
  readonly pendingCount: number;
};

/**
 * Deterministic API startup: locales → persistence → register → drain interval + kick.
 */
export async function bootstrapPlpAutoBuildRuntime(): Promise<BootstrapPlpAutoBuildRuntimeResult> {
  const queueBackend = resolvePlpAutoBuildQueueBackend();
  const registered = registerPlpAutoBuildProcessor();

  if (!registered.registered) {
    setPlpAutoBuildStartupStatus({
      registered: false,
      reason: registered.reason,
      localesCount: 0,
      queueBackend,
      pendingCount: 0,
    });
    logger.info("plp_auto_build_runtime.dormant", {
      component: "plp-auto-build",
      registered: false,
      reason: registered.reason,
      localesCount: 0,
      queueBackend,
      pendingCount: 0,
    });
    return {
      ...registered,
      queueBackend,
      pendingCount: 0,
    };
  }

  if (isMongoConfigured()) {
    try {
      if (getPublishedLocalizationPersistenceMode() !== "mongo") {
        requirePublishedLocalizationMongoPersistence("plp auto-build runtime");
      }
      assertPublishedLocalizationMongoPersistenceActive("plp auto-build runtime");
    } catch (error) {
      logger.warn("plp_auto_build_runtime.persistence_check", {
        component: "plp-auto-build",
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  const pendingCount = await refreshPlpAutoBuildQueueDepthFromStore();

  // RESET 05D / 05E — schedule editorial + bounded current-consumer provider heal.
  try {
    const { healCurrentConsumerProviderFailures } = await import(
      "./current-consumer-provider-heal.js"
    );
    const healed = await healCurrentConsumerProviderFailures({
      locales: registered.locales,
    });
    logger.info("plp_auto_build_runtime.consumer_provider_heal", {
      component: "plp-auto-build",
      editorialEnqueued: healed.editorialEnqueued,
      newsEnqueued: healed.newsEnqueued,
      newsSkippedNotProviderClass: healed.newsSkippedNotProviderClass,
      newsSkippedAlreadyRecovered: healed.newsSkippedAlreadyRecovered,
      newsSkippedUsable: healed.newsSkippedUsable,
      newsSkippedVersionMismatch: healed.newsSkippedVersionMismatch,
    });
  } catch (error) {
    logger.warn("plp_auto_build_runtime.consumer_provider_heal_failed", {
      component: "plp-auto-build",
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  startPlpAutoBuildDrainInterval();
  kickPlpAutoBuildDrain();

  setPlpAutoBuildStartupStatus({
    registered: true,
    reason: "active",
    localesCount: registered.localesCount,
    queueBackend,
    pendingCount,
  });

  logger.info("plp_auto_build_runtime.started", {
    component: "plp-auto-build",
    registered: true,
    localesCount: registered.localesCount,
    queueBackend,
    pendingCount,
  });

  return {
    ...registered,
    queueBackend,
    pendingCount,
  };
}

/** Test helper — stop drain interval between cases. */
export function stopPlpAutoBuildRuntimeForTests(): void {
  stopPlpAutoBuildDrainInterval();
  setPlpBuildRequestProcessor(null);
  setPlpAutoBuildProcessorRegistered(false);
  setMediaLocalizationBuildHookStatus(QUEUE_ACTIVE_PROVIDER_DORMANT);
}
