import type {
  InitiativeCollaborativeAnalysis,
  PublicInitiativeCollaborativeAnalysisListItem,
  PublicInitiativeCollaborativeAnalysisProjection,
} from "@hu/types";

import { getMemberById } from "../member/member-access.js";
import {
  getAnalysisById,
  listPublishedAnalysesByInitiative,
} from "./initiative-collaborative-analysis.store.js";
import { getInitiativeAnalysisReactionSummary } from "../initiative-analysis-reactions/initiative-analysis-reaction.service.js";

async function resolveAuthorDisplayName(authorId: string): Promise<string> {
  const member = await getMemberById(authorId);

  return member?.profile.displayName ?? "Unknown Author";
}

export async function toPublicInitiativeCollaborativeAnalysisProjection(
  analysis: InitiativeCollaborativeAnalysis,
  viewerUserId?: string | null,
): Promise<PublicInitiativeCollaborativeAnalysisProjection> {
  const [authorDisplayName, reactionSummary] = await Promise.all([
    resolveAuthorDisplayName(analysis.authorId),
    getInitiativeAnalysisReactionSummary({
      analysisId: analysis.analysisId,
      actorUserId: viewerUserId,
    }),
  ]);

  return {
    analysisId: analysis.analysisId,
    initiativeId: analysis.initiativeId,
    title: analysis.title,
    summary: analysis.summary,
    supportingEvidence: analysis.supportingEvidence,
    risks: analysis.risks,
    openQuestions: analysis.openQuestions ?? "",
    suggestedImprovements: analysis.suggestedImprovements,
    references: analysis.references,
    authorDisplayName,
    publishedAt: analysis.publishedAt ?? analysis.updatedAt,
    initiativeVersion: analysis.initiativeVersion ?? 1,
    reactionSummary,
  };
}

export async function toPublicInitiativeCollaborativeAnalysisListItem(
  analysis: InitiativeCollaborativeAnalysis,
): Promise<PublicInitiativeCollaborativeAnalysisListItem> {
  return {
    analysisId: analysis.analysisId,
    title: analysis.title,
    summary: analysis.summary,
    authorDisplayName: await resolveAuthorDisplayName(analysis.authorId),
    publishedAt: analysis.publishedAt ?? analysis.updatedAt,
    initiativeVersion: analysis.initiativeVersion ?? 1,
  };
}

export async function listPublicInitiativeCollaborativeAnalyses(
  initiativeId: string,
): Promise<PublicInitiativeCollaborativeAnalysisListItem[]> {
  const analyses = listPublishedAnalysesByInitiative(initiativeId);

  return Promise.all(
    analyses.map((analysis) => toPublicInitiativeCollaborativeAnalysisListItem(analysis)),
  );
}

export async function getPublicInitiativeCollaborativeAnalysis(
  analysisId: string,
  viewerUserId?: string | null,
): Promise<PublicInitiativeCollaborativeAnalysisProjection | null> {
  const analysis = getAnalysisById(analysisId);

  if (!analysis || analysis.status !== "published") {
    return null;
  }

  return await toPublicInitiativeCollaborativeAnalysisProjection(analysis, viewerUserId);
}
