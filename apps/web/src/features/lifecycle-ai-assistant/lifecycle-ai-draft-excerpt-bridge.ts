/**
 * Lightweight Author-workspace bridge so the AI Assistant modal (sidebar)
 * can Improve wording against the open draft without mounting a second
 * editor. Never stores private messages or credentials.
 */

let analysisDraftExcerpt = "";

export function setLifecycleAiAnalysisDraftExcerpt(excerpt: string): void {
  analysisDraftExcerpt = excerpt.slice(0, 8000);
}

export function getLifecycleAiAnalysisDraftExcerpt(): string {
  return analysisDraftExcerpt;
}
