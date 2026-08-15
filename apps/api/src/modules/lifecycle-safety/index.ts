/**
 * Safety Architecture Pack 01 — Lifecycle Safety Foundation.
 *
 * Central Safety Service + provider-independent SafetyProvider contract.
 * No external AI is connected in this pack.
 */
export {
  assertAiPromptSafe,
  assertLifecycleContentSafe,
  assertLifecycleFieldsSafe,
  evaluateLifecycleSafety,
} from "./lifecycle-safety.service.js";
export {
  LifecycleSafetyNeedsReviewError,
  LifecycleSafetyRejectedError,
} from "./lifecycle-safety.errors.js";
export {
  mapProviderSignalToOutcome,
  mayEnterLifecycleStorage,
  mayEnterStageIntelligence,
  mayNotifyOtherParticipants,
} from "./safety-policy.js";
export type { SafetyProvider } from "./safety-provider.js";
export {
  BaselineHeuristicSafetyProvider,
  UnavailableGeminiSafetyProvider,
  resetSafetyProviderForTests,
  resolveSafetyProvider,
  setSafetyProviderForTests,
} from "./safety-provider.js";
export {
  AI_PROMPT_SAFETY_SURFACE,
  DISCUSSION_SAFETY_SURFACE,
  safetySurfaceForLifecycleStage,
} from "./lifecycle-safety-surfaces.js";
