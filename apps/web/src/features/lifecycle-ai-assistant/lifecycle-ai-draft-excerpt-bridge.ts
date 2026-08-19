/**
 * Lightweight Author-workspace bridge so the AI Assistant modal can Improve
 * wording / regenerate sections against the open draft without mounting a
 * second editor. Stage-keyed — never stores private messages or credentials.
 *
 * Lifecycle Staging Fix 03 — generalizes the Analysis-only excerpt bridge.
 */

const excerptsByStage = new Map<string, string>();

export function setLifecycleAiDraftExcerpt(stageId: string, excerpt: string): void {
  excerptsByStage.set(stageId, excerpt.slice(0, 8000));
}

export function getLifecycleAiDraftExcerpt(stageId: string): string {
  return excerptsByStage.get(stageId) ?? "";
}

export function clearLifecycleAiDraftExcerpt(stageId: string): void {
  excerptsByStage.delete(stageId);
}

/** @deprecated Prefer setLifecycleAiDraftExcerpt("analysis", …) */
export function setLifecycleAiAnalysisDraftExcerpt(excerpt: string): void {
  setLifecycleAiDraftExcerpt("analysis", excerpt);
}

/** @deprecated Prefer getLifecycleAiDraftExcerpt("analysis") */
export function getLifecycleAiAnalysisDraftExcerpt(): string {
  return getLifecycleAiDraftExcerpt("analysis");
}
