/**
 * Localization Simplification Reset 01 — Collaborative Analysis.
 *
 * Browser-visible human-readable CA body fields are the localization boundary.
 * WEB_UI owns section headings / chrome only. Incomplete localized bags must
 * never field-merge with originals on the public path.
 */

/** Public CA prose fields rendered by InitiativeCollaborativeAnalysisPublicResult. */
export const COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS = [
  "title",
  "summary",
  "supportingEvidence",
  "risks",
  "openQuestions",
  "suggestedImprovements",
  "references",
] as const;

export type CollaborativeAnalysisBrowserVisibleProseField =
  (typeof COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS)[number];

/**
 * True when every non-empty canonical prose field has a non-empty localized
 * value. Presence-only — presentation still falls back wholesale when false.
 *
 * When `requiredFields` is omitted, every non-empty key in `originalFields`
 * is required (entity-wide completeness). Callers may pass an explicit
 * browser-visible boundary list (e.g. CA public prose fields).
 */
export function isCompleteLocalizedProseBag(input: {
  readonly originalFields: Readonly<Record<string, string>>;
  readonly localizedFields: Readonly<Record<string, string>>;
  readonly requiredFields?: readonly string[];
}): boolean {
  const required =
    input.requiredFields ??
    Object.keys(input.originalFields).filter((key) => {
      const value = input.originalFields[key];
      return typeof value === "string" && value.trim().length > 0;
    });
  for (const key of required) {
    const original = input.originalFields[key];
    if (typeof original !== "string" || original.trim().length === 0) {
      continue;
    }
    const localized = input.localizedFields[key];
    if (typeof localized !== "string" || localized.trim().length === 0) {
      return false;
    }
  }
  return true;
}

/** @deprecated Prefer {@link isCompleteLocalizedProseBag}. */
export const isCompleteCollaborativeAnalysisLocalizedBag = isCompleteLocalizedProseBag;
