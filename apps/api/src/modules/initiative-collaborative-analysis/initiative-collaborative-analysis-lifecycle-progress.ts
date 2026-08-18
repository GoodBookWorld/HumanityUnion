import type { InitiativeCollaborativeAnalysis } from "@hu/types";

import { listAnalysesByInitiativeAndAuthor } from "./initiative-collaborative-analysis.store.js";

/**
 * Canonical Collaborative Analysis progress for Initiative lifecycle nav +
 * stage presentation. Scoped to the Initiative steward's analyses only —
 * the same authority as `adaptAnalysisStage` (lifecycle stage adapter).
 *
 * Viewer identity never enters this function: every participant must see
 * the same stage state for the same Initiative artifacts.
 */
export interface StewardCollaborativeAnalysisLifecycleProgress {
  readonly published: readonly InitiativeCollaborativeAnalysis[];
  readonly latestPublished: InitiativeCollaborativeAnalysis | null;
  readonly hasDraft: boolean;
}

export function resolveStewardCollaborativeAnalysisLifecycleProgress(
  initiativeId: string,
  stewardId: string,
): StewardCollaborativeAnalysisLifecycleProgress {
  const authored = listAnalysesByInitiativeAndAuthor(initiativeId, stewardId);
  const published = authored
    .filter((analysis) => analysis.status === "published")
    .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
  const hasDraft = authored.some((analysis) => analysis.status === "draft");

  return {
    published,
    latestPublished: published[0] ?? null,
    hasDraft,
  };
}
