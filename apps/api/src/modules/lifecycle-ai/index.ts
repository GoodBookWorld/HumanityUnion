/**
 * Humanity Union Assistant — provider-independent platform AI seam (Pack 02–05 + Hardening 01).
 *
 * Product name: Humanity Union Assistant (one Assistant; context specializes).
 * Provider seam remains LifecycleAiProvider (Gemini / deterministic).
 * Session history: transient_browser_session — sessionStorage only; never Mongo / never DMs.
 * Communication character: assistant-core-policy.ts (Pack 03).
 * Platform knowledge: structured modules + bounded retrieval (Pack 05).
 * Production hardening: retries, rate limits, prompt budgets, anonymous metrics.
 *
 * Policy: no silent Gemini → deterministic fallback.
 */

export { default as assistantRouter } from "./assistant.routes.js";
/** @deprecated Pack 02 quarantine — not mounted in app.ts. Retained for unit tests only. */
export { default as lifecycleAiRouter } from "./lifecycle-ai.routes.js";
export {
  CANONICAL_ASSISTANT_HTTP_BASE,
  CANONICAL_ASSISTANT_HTTP_PATHS,
  QUARANTINED_ASSISTANT_HTTP_BASES,
} from "./assistant-production-routes.js";
export {
  getLifecycleAiAssistantSessionContext,
  requestLifecycleAiAssist,
} from "./lifecycle-ai.service.js";
export {
  getHumanityUnionAssistantSessionContext,
  requestHumanityUnionAssistantAssist,
} from "./platform-assistant.service.js";
export type { LifecycleAiProvider } from "./lifecycle-ai-provider.js";
/** Alias — Pack 02 keeps one provider hierarchy. */
export type { LifecycleAiProvider as PlatformAiProvider } from "./lifecycle-ai-provider.js";
export {
  resolveLifecycleAiProvider,
  resetLifecycleAiProviderForTests,
  setLifecycleAiProviderForTests,
} from "./resolve-lifecycle-ai-provider.js";
export { DeterministicLifecycleAiProvider } from "./providers/deterministic-lifecycle-ai-provider.js";
export { GeminiLifecycleAiProvider } from "./providers/gemini-lifecycle-ai-provider.js";
export { buildLifecycleAiProviderContext } from "./build-lifecycle-ai-provider-context.js";
export { LifecycleAiError, toLifecycleAiPublicMessage } from "./lifecycle-ai.errors.js";
export {
  HUMANITY_UNION_PRINCIPLES,
  PLATFORM_AI_KNOWLEDGE_PROMPT,
  PLATFORM_KNOWLEDGE_TOPICS,
  PLATFORM_KNOWLEDGE_TOPIC_LABELS,
  PLATFORM_KNOWLEDGE_VERSION,
  ASSISTANT_UNKNOWN_PLATFORM_KNOWLEDGE_REPLY,
  retrievePlatformKnowledge,
} from "./platform-ai-knowledge.js";
export {
  ASSISTANT_OUT_OF_SCOPE_REPLY,
  CORE_ASSISTANT_POLICY_MARKER,
  CORE_ASSISTANT_POLICY_PROMPT,
} from "./assistant-core-policy.js";
export { resolveAssistantBehaviorGuard } from "./assistant-behavior-guards.js";
export { buildLifecycleAiPrompt } from "./build-lifecycle-ai-prompt.js";
export {
  boundConversationHistory,
  enforcePromptBudget,
  estimatePromptChars,
  estimatePromptTokens,
} from "./assistant-context-optimizer.js";
export { resolveAssistantPromptVersions, ASSISTANT_PROMPT_VERSIONS } from "./assistant-prompt-versions.js";
export {
  clearAssistantRateLimitBucketsForTests,
  assertAssistantAssistWithinLimits,
} from "./assistant-rate-limit.js";
export {
  recordAssistantUsageMetric,
  resetAssistantUsageMetricsForTests,
  getAssistantUsageMetricSnapshotForTests,
} from "./assistant-usage-metrics.js";
export { resolveLifecycleAiConfig } from "./lifecycle-ai.config.js";
export {
  BLOG_AUTHORING_ASSISTANT_STAGE_KEY,
  BLOG_PUBLICATION_ASSISTANT_SECTION_IDS,
  BLOG_PUBLICATION_AUTHORING_OPS,
  blogAuthoringInstructionBlock,
  buildBlogAuthoringSourceContext,
  isBlogPublicationAuthoringPath,
} from "./blog-authoring-assistant.js";
export type { BlogPublicationAssistantSectionId } from "./blog-authoring-assistant.js";
export { resolveAssistantSpecialization } from "./assistant-specialization.js";

