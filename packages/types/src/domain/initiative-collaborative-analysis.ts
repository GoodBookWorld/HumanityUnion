import type { InitiativeId } from "./initiative.js";
import type { MemberId } from "./member.js";

export type InitiativeCollaborativeAnalysisId = string;

/** Structured collaborative analysis lifecycle (Collective Intelligence). */
export type InitiativeCollaborativeAnalysisStatus = "draft" | "published" | "archived";

export interface InitiativeCollaborativeAnalysis {
  analysisId: InitiativeCollaborativeAnalysisId;
  initiativeId: InitiativeId;
  authorId: MemberId;
  title: string;
  summary: string;
  supportingEvidence: string;
  risks: string;
  /**
   * Initiative Lifecycle — Part B. Additive field (optional so pre-existing
   * persisted analyses without it still deserialize cleanly). Maps to the
   * Lifecycle Stage Workspace editor's "Open Questions" section.
   */
  openQuestions?: string;
  suggestedImprovements: string;
  references: string;
  status: InitiativeCollaborativeAnalysisStatus;
  /** Initiative version active when this analysis was created. */
  initiativeVersion: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}
