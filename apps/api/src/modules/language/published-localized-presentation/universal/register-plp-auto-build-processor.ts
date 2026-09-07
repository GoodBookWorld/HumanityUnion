/**
 * RESET 05C — register the in-process PLP auto-build processor at API bootstrap.
 *
 * Enable when:
 * - HU_PLP_AUTO_BUILD_PROCESSOR is not "0" (default: enabled when locales set)
 * - HU_PLP_AUTO_BUILD_LOCALES is non-empty (safety allowlist — no uncontrolled fanout)
 *
 * In-process queue: lost on restart; next RSS refresh re-enqueues consumer-visible set.
 */

import { setPlpBuildRequestProcessor } from "./build-request-queue.js";
import { processPlpBuildRequest } from "./process-plp-build-request.js";
import { resolvePlpAutoBuildLocales } from "./public-source-mutation-bridge.js";
import {
  QUEUE_ACTIVE_PROVIDER_ACTIVE,
  QUEUE_ACTIVE_PROVIDER_DORMANT,
  setMediaLocalizationBuildHookStatus,
} from "../media/publication-hook.js";

export type RegisterPlpAutoBuildProcessorResult = {
  readonly registered: boolean;
  readonly reason: "active" | "disabled_by_env" | "no_locales";
  readonly locales: readonly string[];
  readonly status:
    | typeof QUEUE_ACTIVE_PROVIDER_ACTIVE
    | typeof QUEUE_ACTIVE_PROVIDER_DORMANT;
};

/**
 * Fire-and-forget safe. Call after warm handlers in bootstrap-event-infrastructure.
 */
export function registerPlpAutoBuildProcessor(): RegisterPlpAutoBuildProcessorResult {
  if (process.env.HU_PLP_AUTO_BUILD_PROCESSOR === "0") {
    setPlpBuildRequestProcessor(null);
    setMediaLocalizationBuildHookStatus(QUEUE_ACTIVE_PROVIDER_DORMANT);
    return {
      registered: false,
      reason: "disabled_by_env",
      locales: [],
      status: QUEUE_ACTIVE_PROVIDER_DORMANT,
    };
  }

  const locales = resolvePlpAutoBuildLocales();
  if (locales.length === 0) {
    setPlpBuildRequestProcessor(null);
    setMediaLocalizationBuildHookStatus(QUEUE_ACTIVE_PROVIDER_DORMANT);
    return {
      registered: false,
      reason: "no_locales",
      locales: [],
      status: QUEUE_ACTIVE_PROVIDER_DORMANT,
    };
  }

  setPlpBuildRequestProcessor((request) => processPlpBuildRequest(request));
  setMediaLocalizationBuildHookStatus(QUEUE_ACTIVE_PROVIDER_ACTIVE);
  return {
    registered: true,
    reason: "active",
    locales,
    status: QUEUE_ACTIVE_PROVIDER_ACTIVE,
  };
}
