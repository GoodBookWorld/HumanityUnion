import type { InitiativeId } from "./initiative.js";
import type { AnalysisMetrics } from "./analysis-metrics.js";
import type { AnalysisSummary } from "./analysis-summary.js";
import type { Contribution } from "./contribution.js";
import type { ProgressPolicy } from "./progress-policy.js";
import type { Readiness } from "./readiness.js";
import type { Signal } from "./signal.js";

export type AnalysisId = string;

export type CollaborativeAnalysisStatus =
  "not_started" | "active" | "requirements_met" | "completed" | "archived";

export interface CollaborativeAnalysis {
  analysisId: AnalysisId;
  initiativeId: InitiativeId;
  status: CollaborativeAnalysisStatus;
  createdAt: string;
  updatedAt: string;
  contributions: Contribution[];
  signals: Signal[];
  summaries: AnalysisSummary[];
  progressPolicy: ProgressPolicy;
  readiness: Readiness;
  metrics: AnalysisMetrics;
}
