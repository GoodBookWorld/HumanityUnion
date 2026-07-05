import type { AnalysisSummary } from "@hu/types";

import "./analysis-summary.css";

interface AnalysisSummaryPanelProps {
  summaries: AnalysisSummary[];
}

function formatCreatedDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getCurrentSummary(summaries: AnalysisSummary[]): AnalysisSummary | null {
  if (summaries.length === 0) {
    return null;
  }

  return (
    [...summaries].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )[0] ?? null
  );
}

export function AnalysisSummaryPanel({ summaries }: AnalysisSummaryPanelProps) {
  const currentSummary = getCurrentSummary(summaries);

  if (!currentSummary) {
    return <p className="analysis-summary__empty">No analysis summary available.</p>;
  }

  return (
    <article className="analysis-summary">
      <p className="analysis-summary__text">{currentSummary.summaryText}</p>
      <p className="analysis-summary__meta">
        <span>Author: {currentSummary.createdBy}</span>
        <span>Created: {formatCreatedDate(currentSummary.createdAt)}</span>
      </p>
    </article>
  );
}
