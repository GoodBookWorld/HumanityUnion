/**
 * Lifecycle AI assistant feature barrel.
 *
 * Pack 02 quarantine: modal + legacy `/api/v1/lifecycle-ai` client are NOT
 * exported. Active draft bridges remain for Humanity Union Assistant.
 */

export {
  LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT,
  dispatchLifecycleAiApplySuggestions,
  type LifecycleAiApplySuggestionsDetail,
} from "./lifecycle-ai-suggestion-events";
export {
  getLifecycleAiAnalysisDraftExcerpt,
  setLifecycleAiAnalysisDraftExcerpt,
} from "./lifecycle-ai-draft-excerpt-bridge";
