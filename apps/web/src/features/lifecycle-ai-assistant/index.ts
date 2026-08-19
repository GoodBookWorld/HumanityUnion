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
  getLifecycleAiDraftExcerpt,
  setLifecycleAiAnalysisDraftExcerpt,
  setLifecycleAiDraftExcerpt,
  clearLifecycleAiDraftExcerpt,
} from "./lifecycle-ai-draft-excerpt-bridge";
export {
  applyLifecycleAiSuggestionsToFields,
  applyLifecycleAiSuggestionsToPublicImpactSections,
  applyLifecycleAiSuggestionsToCandidateCollection,
} from "./lifecycle-ai-apply-suggestions";
export {
  getLifecycleAiStageApplyContract,
  isLifecycleAiApplyStageAllowedForProfile,
  formatKnownSectionIdsForPrompt,
  PUBLIC_CHOICE_AI_APPLY_STAGE_IDS,
} from "./lifecycle-ai-stage-apply-contract";
export { useLifecycleAiFormApply } from "./use-lifecycle-ai-form-apply";
