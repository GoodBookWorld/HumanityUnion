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
  suggestedImprovements: string;
  references: string;
  status: InitiativeCollaborativeAnalysisStatus;
  /** Initiative version active when this analysis was created. */
  initiativeVersion: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}
