import type { InitiativeLifecycleAiAssistSuggestion } from "@hu/types";

export const LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT = "hu:lifecycle-ai-apply-suggestions";

export interface LifecycleAiApplySuggestionsDetail {
  readonly initiativeId: string;
  readonly stageId: string;
  readonly suggestions: readonly InitiativeLifecycleAiAssistSuggestion[];
}

export function dispatchLifecycleAiApplySuggestions(
  detail: LifecycleAiApplySuggestionsDetail,
): void {
  window.dispatchEvent(
    new CustomEvent<LifecycleAiApplySuggestionsDetail>(LIFECYCLE_AI_APPLY_SUGGESTIONS_EVENT, {
      detail,
    }),
  );
}
