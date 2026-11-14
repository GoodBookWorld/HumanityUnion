import {
  presentLifecycleStageTokensAsEnglish,
  type InitiativeCollaborativeAnalysis,
  type PublicInitiativeCollaborativeAnalysisListItem,
  type PublicInitiativeCollaborativeAnalysisProjection,
} from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";
import { canExposePublicInitiativeProjection } from "../initiatives/public-initiative.projection.js";
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

function presentAnalysisFieldsForParticipants(analysis: InitiativeCollaborativeAnalysis) {
  return {
    title: presentLifecycleStageTokensAsEnglish(analysis.title),
    summary: presentLifecycleStageTokensAsEnglish(analysis.summary),
    supportingEvidence: presentLifecycleStageTokensAsEnglish(analysis.supportingEvidence),
    risks: presentLifecycleStageTokensAsEnglish(analysis.risks),
    openQuestions: presentLifecycleStageTokensAsEnglish(analysis.openQuestions ?? ""),
    suggestedImprovements: presentLifecycleStageTokensAsEnglish(
      analysis.suggestedImprovements,
    ),
    references: presentLifecycleStageTokensAsEnglish(analysis.references),
  };
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
    ...presentAnalysisFieldsForParticipants(analysis),
    authorDisplayName,
    publishedAt: analysis.publishedAt ?? analysis.updatedAt,
    initiativeVersion: analysis.initiativeVersion ?? 1,
    reactionSummary,
  };
}

export async function toPublicInitiativeCollaborativeAnalysisListItem(
  analysis: InitiativeCollaborativeAnalysis,
): Promise<PublicInitiativeCollaborativeAnalysisListItem> {
  const fields = presentAnalysisFieldsForParticipants(analysis);
  return {
    analysisId: analysis.analysisId,
    title: fields.title,
    summary: fields.summary,
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
  const initiative = analysis ? getInitiativeById(analysis.initiativeId) : null;

  // Same parent rule as the by-Initiative listing: hidden Initiatives expose no analyses.
  if (
    !analysis ||
    analysis.status !== "published" ||
    !initiative ||
    !canExposePublicInitiativeProjection(initiative)
  ) {
    return null;
  }

  return await toPublicInitiativeCollaborativeAnalysisProjection(analysis, viewerUserId);
}
