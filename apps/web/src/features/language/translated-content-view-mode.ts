/**
 * Pack 02G Task 07B — TranslatedContentView mode lifecycle (pure).
 * Handles async arrival of a distinct preferred translation without
 * overriding a participant's explicit "View Original" choice.
 */

export type TranslatedContentViewMode = "translation" | "original";

export interface TranslatedContentViewModeLifecycleState {
  readonly mode: TranslatedContentViewMode;
  readonly previouslyHadDistinctTranslation: boolean;
  readonly userPrefersOriginal: boolean;
}

/**
 * Resolve the next view mode after a props/lifecycle change.
 *
 * - false → true distinct translation: auto-select translation (unless user already chose original)
 * - user chose original: keep original across ordinary rerenders while translation remains
 * - translation unavailable: fall back to original and clear the manual preference
 */
export function resolveTranslatedContentViewModeLifecycle(input: {
  readonly hasDistinctTranslation: boolean;
  readonly previouslyHadDistinctTranslation: boolean;
  readonly currentMode: TranslatedContentViewMode;
  readonly userPrefersOriginal: boolean;
}): TranslatedContentViewModeLifecycleState {
  if (!input.hasDistinctTranslation) {
    return {
      mode: "original",
      previouslyHadDistinctTranslation: false,
      userPrefersOriginal: false,
    };
  }

  if (!input.previouslyHadDistinctTranslation && !input.userPrefersOriginal) {
    return {
      mode: "translation",
      previouslyHadDistinctTranslation: true,
      userPrefersOriginal: false,
    };
  }

  return {
    mode: input.currentMode,
    previouslyHadDistinctTranslation: true,
    userPrefersOriginal: input.userPrefersOriginal,
  };
}

export function translatedContentHasDistinctTranslation(input: {
  readonly content: string;
  readonly originalContent: string;
  readonly canViewOriginal: boolean;
}): boolean {
  return (
    input.canViewOriginal && input.content.trim() !== input.originalContent.trim()
  );
}
