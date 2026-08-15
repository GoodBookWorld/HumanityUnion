import type {
  Initiative,
  InitiativeLifecycleAiAssistOperation,
  InitiativeLifecycleStageId,
} from "@hu/types";
import { getInitiativeLifecycleStageDefinition } from "@hu/types";

import { buildInitiativeAnalysisSourceSnapshot } from "../initiative-collaborative-analysis/initiative-analysis-source-snapshot.service.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getMemberById } from "../member/member-access.js";

import { assertLifecycleAiPayloadIsPrivateFree, sanitizePublicDraftExcerpt } from "./lifecycle-ai-privacy.js";

/**
 * Part 5 — single server-side context builder for Lifecycle AI providers.
 *
 * The browser may send only Author-supplied instructions and an optional
 * draft excerpt. Everything else (sources, stage identity, principles
 * inputs) is assembled here. Private chats, documents, credentials, and
 * auth material are never loaded into this context.
 */
export interface LifecycleAiAllowedProviderContext {
  readonly participantDisplayName: string;
  readonly initiativeId: string;
  readonly initiativeTitle: string;
  readonly stageId: InitiativeLifecycleStageId;
  readonly stageLabel: string;
  readonly presentationMode: string;
  readonly availableSourceLabels: readonly string[];
  readonly sourceContextSummary: string;
  readonly operation: InitiativeLifecycleAiAssistOperation;
  readonly instructions?: string;
  readonly currentDraftExcerpt?: string;
  readonly targetSectionId?: string;
  /** Explicit allow-list audit for tests and diagnostics (no secrets). */
  readonly includedFields: readonly string[];
}

const DRAFT_REQUIRED_OPERATIONS = new Set<InitiativeLifecycleAiAssistOperation>([
  "improve_wording",
  "regenerate_section",
]);

async function resolveParticipantDisplayName(identity: RequestIdentity): Promise<string> {
  if (identity.displayName?.trim()) {
    return identity.displayName.trim();
  }

  const member = await getMemberById(identity.participantId);
  return member?.profile.displayName?.trim() || "Author";
}

async function resolveStageSources(
  stageId: InitiativeLifecycleStageId,
  initiativeId: string,
): Promise<{ labels: string[]; summary: string }> {
  if (stageId === "analysis") {
    const snapshot = await buildInitiativeAnalysisSourceSnapshot(initiativeId);
    const labels = [
      `Discussion comments (${snapshot.discussionStatistics.commentCount})`,
      `Helpful (${snapshot.discussionStatistics.helpfulCount})`,
      `Not Helpful (${snapshot.discussionStatistics.notHelpfulCount})`,
      `Proposal candidates (${snapshot.proposalCandidates.length})`,
      `Active Allies (${snapshot.activeAlliesCount})`,
      `Ready to Collaborate (${snapshot.readyToCollaborateCount})`,
    ];

    const summary = [
      `Comments: ${snapshot.discussionStatistics.commentCount}.`,
      `Top arguments: ${
        snapshot.repeatedArguments
          .slice(0, 3)
          .map((item) => item.excerpt)
          .join(" | ") || "none"
      }.`,
      `Top concerns: ${
        snapshot.repeatedConcerns
          .slice(0, 3)
          .map((item) => item.excerpt)
          .join(" | ") || "none"
      }.`,
      `Open questions: ${
        snapshot.openQuestions
          .slice(0, 3)
          .map((item) => item.excerpt)
          .join(" | ") || "none"
      }.`,
      `Topics: ${
        snapshot.mostDiscussedTopics
          .slice(0, 5)
          .map((topic) => topic.topic)
          .join(", ") || "none"
      }.`,
    ].join(" ");

    return { labels, summary };
  }

  const definition = getInitiativeLifecycleStageDefinition(stageId);
  return {
    labels: definition ? [`${definition.label} stage sources`] : ["Lifecycle stage sources"],
    summary: `Source Snapshot for ${definition?.label ?? stageId} (stage-specific intelligence). Private messages and credentials are excluded.`,
  };
}

export async function buildLifecycleAiProviderContext(input: {
  readonly identity: RequestIdentity;
  readonly initiative: Initiative;
  readonly stageId: InitiativeLifecycleStageId;
  readonly stageLabel: string;
  readonly presentationMode: string;
  readonly operation: InitiativeLifecycleAiAssistOperation;
  readonly instructions?: string;
  readonly currentDraftExcerpt?: string;
  readonly targetSectionId?: string;
}): Promise<LifecycleAiAllowedProviderContext> {
  const sources = await resolveStageSources(input.stageId, input.initiative.initiativeId);
  const participantDisplayName = await resolveParticipantDisplayName(input.identity);
  const instructions = input.instructions?.trim() || undefined;
  const currentDraftExcerpt = DRAFT_REQUIRED_OPERATIONS.has(input.operation)
    ? sanitizePublicDraftExcerpt(input.currentDraftExcerpt)
    : undefined;

  const includedFields = [
    "participantDisplayName",
    "initiativeId",
    "initiativeTitle",
    "stageId",
    "stageLabel",
    "presentationMode",
    "availableSourceLabels",
    "sourceContextSummary",
    "operation",
  ];

  if (instructions) {
    includedFields.push("instructions");
  }
  if (currentDraftExcerpt) {
    includedFields.push("currentDraftExcerpt");
  }
  if (input.targetSectionId) {
    includedFields.push("targetSectionId");
  }

  const context: LifecycleAiAllowedProviderContext = {
    participantDisplayName,
    initiativeId: input.initiative.initiativeId,
    initiativeTitle: input.initiative.title,
    stageId: input.stageId,
    stageLabel: input.stageLabel,
    presentationMode: input.presentationMode,
    availableSourceLabels: sources.labels,
    sourceContextSummary: sources.summary,
    operation: input.operation,
    instructions,
    currentDraftExcerpt,
    targetSectionId: input.targetSectionId,
    includedFields,
  };

  // Hard boundary: refuse if any forbidden private keys ever appear.
  assertLifecycleAiPayloadIsPrivateFree(
    {
      participantDisplayName: context.participantDisplayName,
      initiativeTitle: context.initiativeTitle,
      stageLabel: context.stageLabel,
      presentationMode: context.presentationMode,
      availableSourceLabels: context.availableSourceLabels,
      sourceContextSummary: context.sourceContextSummary,
      instructions: context.instructions,
      currentDraftExcerpt: context.currentDraftExcerpt,
      targetSectionId: context.targetSectionId,
    },
    "Lifecycle AI provider context",
  );

  return context;
}
