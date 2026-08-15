/**
 * Production Hardening Pack 01 — canonical prompt version identifiers.
 * Recorded in diagnostics / metrics only. Never shown to ordinary users.
 */

export const ASSISTANT_PROMPT_VERSIONS = {
  corePolicy: "assistant-core-policy-v1.0",
  platformKnowledge: "platform-knowledge-v1.0",
  analysisStage: "analysis-stage-v1.0",
  proposalStage: "proposal-stage-v1.0",
  revisionStage: "revision-stage-v1.0",
  petitionStage: "petition-stage-v1.0",
  decisionSessionStage: "decision-session-stage-v1.0",
  collectiveDecisionStage: "collective-decision-stage-v1.0",
  commitmentStage: "commitment-stage-v1.0",
  trackingStage: "tracking-stage-v1.0",
  officialResponseStage: "official-response-stage-v1.0",
  publicImpactStage: "public-impact-stage-v1.0",
  archiveStage: "archive-stage-v1.0",
  initiativeStage: "initiative-stage-v1.0",
  discussionStage: "discussion-stage-v1.0",
  platformSurface: "platform-surface-v1.0",
} as const;

export type AssistantPromptVersionId =
  (typeof ASSISTANT_PROMPT_VERSIONS)[keyof typeof ASSISTANT_PROMPT_VERSIONS];

const STAGE_PROMPT_VERSIONS: Record<string, AssistantPromptVersionId> = {
  analysis: ASSISTANT_PROMPT_VERSIONS.analysisStage,
  proposal: ASSISTANT_PROMPT_VERSIONS.proposalStage,
  revision: ASSISTANT_PROMPT_VERSIONS.revisionStage,
  petition: ASSISTANT_PROMPT_VERSIONS.petitionStage,
  decision_session: ASSISTANT_PROMPT_VERSIONS.decisionSessionStage,
  collective_decision: ASSISTANT_PROMPT_VERSIONS.collectiveDecisionStage,
  commitment: ASSISTANT_PROMPT_VERSIONS.commitmentStage,
  tracking: ASSISTANT_PROMPT_VERSIONS.trackingStage,
  official_response: ASSISTANT_PROMPT_VERSIONS.officialResponseStage,
  public_impact: ASSISTANT_PROMPT_VERSIONS.publicImpactStage,
  archive: ASSISTANT_PROMPT_VERSIONS.archiveStage,
  initiative: ASSISTANT_PROMPT_VERSIONS.initiativeStage,
  discussion: ASSISTANT_PROMPT_VERSIONS.discussionStage,
};

export function resolveAssistantPromptVersions(input: {
  readonly stageId?: string | null;
  readonly surfaceId?: string | null;
  readonly platformKnowledgeVersion?: string | null;
}): readonly string[] {
  const versions: string[] = [ASSISTANT_PROMPT_VERSIONS.corePolicy];

  if (input.platformKnowledgeVersion) {
    versions.push(input.platformKnowledgeVersion);
  } else {
    versions.push(ASSISTANT_PROMPT_VERSIONS.platformKnowledge);
  }

  if (input.stageId && STAGE_PROMPT_VERSIONS[input.stageId]) {
    versions.push(STAGE_PROMPT_VERSIONS[input.stageId]!);
  } else {
    versions.push(ASSISTANT_PROMPT_VERSIONS.platformSurface);
  }

  return versions;
}
