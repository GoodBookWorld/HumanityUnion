import type {
  InitiativeCollaborativeAnalysis,
  PublicInitiativeCollaborativeAnalysisListItem,
  PublicInitiativeCollaborativeAnalysisProjection,
} from "@hu/types";

import { getMemberById } from "../member/member.store.js";
import {
  getAnalysisById,
  listPublishedAnalysesByInitiative,
} from "./initiative-collaborative-analysis.store.js";

function resolveAuthorDisplayName(authorId: string): string {
  const member = getMemberById(authorId);

  return member?.profile.displayName ?? "Unknown Author";
}

export function toPublicInitiativeCollaborativeAnalysisProjection(
  analysis: InitiativeCollaborativeAnalysis,
): PublicInitiativeCollaborativeAnalysisProjection {
  return {
    analysisId: analysis.analysisId,
    initiativeId: analysis.initiativeId,
    title: analysis.title,
    summary: analysis.summary,
    supportingEvidence: analysis.supportingEvidence,
    risks: analysis.risks,
    suggestedImprovements: analysis.suggestedImprovements,
    references: analysis.references,
    authorDisplayName: resolveAuthorDisplayName(analysis.authorId),
    publishedAt: analysis.publishedAt ?? analysis.updatedAt,
    initiativeVersion: analysis.initiativeVersion ?? 1,
  };
}

export function toPublicInitiativeCollaborativeAnalysisListItem(
  analysis: InitiativeCollaborativeAnalysis,
): PublicInitiativeCollaborativeAnalysisListItem {
  return {
    analysisId: analysis.analysisId,
    title: analysis.title,
    summary: analysis.summary,
    authorDisplayName: resolveAuthorDisplayName(analysis.authorId),
    publishedAt: analysis.publishedAt ?? analysis.updatedAt,
    initiativeVersion: analysis.initiativeVersion ?? 1,
  };
}

export function listPublicInitiativeCollaborativeAnalyses(
  initiativeId: string,
): PublicInitiativeCollaborativeAnalysisListItem[] {
  return listPublishedAnalysesByInitiative(initiativeId).map((analysis) =>
    toPublicInitiativeCollaborativeAnalysisListItem(analysis),
  );
}

export function getPublicInitiativeCollaborativeAnalysis(
  analysisId: string,
): PublicInitiativeCollaborativeAnalysisProjection | null {
  const analysis = getAnalysisById(analysisId);

  if (!analysis || analysis.status !== "published") {
    return null;
  }

  return toPublicInitiativeCollaborativeAnalysisProjection(analysis);
}
