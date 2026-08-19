import type {
  Initiative,
  InitiativeLifecycleAiAssistOperation,
  InitiativeLifecycleProfile,
  InitiativeLifecycleStageId,
} from "@hu/types";
import { getInitiativeLifecycleStageDefinition } from "@hu/types";

import { buildInitiativeAnalysisSourceSnapshot } from "../initiative-collaborative-analysis/initiative-analysis-source-snapshot.service.js";
import { buildInitiativeCivicArchiveIntelligenceSnapshot } from "../initiative-civic-archive-lifecycle/initiative-civic-archive-intelligence.service.js";
import { buildInitiativeCollectiveDecisionIntelligenceSnapshot } from "../initiative-collective-decision-lifecycle/initiative-collective-decision-intelligence.service.js";
import { buildInitiativePublicImpactIntelligenceSnapshot } from "../initiative-public-impact-lifecycle/initiative-public-impact-intelligence.service.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getMemberById } from "../member/member-access.js";

import { assertLifecycleAiPayloadIsPrivateFree, sanitizePublicDraftExcerpt } from "./lifecycle-ai-privacy.js";

/**
 * Part 5 — single server-side context builder for Lifecycle AI providers.
 *
 * Lifecycle Staging Fix 03 — stage-aware source summaries + lifecycleProfile.
 * The browser may send only Author-supplied instructions and an optional
 * draft excerpt. Everything else is assembled here. Private chats, documents,
 * credentials, and auth material are never loaded into this context.
 */
export interface LifecycleAiAllowedProviderContext {
  readonly participantDisplayName: string;
  readonly initiativeId: string;
  readonly initiativeTitle: string;
  readonly lifecycleProfile: InitiativeLifecycleProfile;
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
  lifecycleProfile: InitiativeLifecycleProfile,
): Promise<{ labels: string[]; summary: string }> {
  try {
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

    if (stageId === "public_impact") {
      const snapshot = await buildInitiativePublicImpactIntelligenceSnapshot(initiativeId);
      const labels = [
        `Initiative: ${snapshot.initiativeTitle || initiativeId}`,
        snapshot.decisionReference
          ? `Collective Decision (${snapshot.decisionReference.decisionId})`
          : "Collective Decision (not published)",
        snapshot.trackingPackageReference
          ? `Tracking package (${snapshot.trackingPackageReference.packageId})`
          : "Tracking (not published)",
        snapshot.commitmentPackageReference
          ? `Commitments (${snapshot.commitmentPackageReference.packageId})`
          : "Commitments (not published)",
        snapshot.officialResponsePackageReference
          ? `Official Responses (${snapshot.officialResponsePackageReference.packageId})`
          : "Official Responses (not published)",
        `Evidence items (${snapshot.evidenceItems.length})`,
      ];
      const summary = [
        `Lifecycle profile: ${lifecycleProfile}.`,
        `Official Responses published: ${Boolean(snapshot.officialResponsePackageReference)}.`,
        `Tracking records: ${snapshot.trackingRecords.length}.`,
        `Completed commitments/trackings: ${snapshot.completedCommitmentCount}.`,
        "Never invent Official Responses, votes, or evidence. Missing upstream stages are SOURCE_OPTIONAL.",
      ].join(" ");
      return { labels, summary };
    }

    if (stageId === "collective_decision") {
      const snapshot = await buildInitiativeCollectiveDecisionIntelligenceSnapshot(initiativeId);
      const labels = [
        `Lifecycle profile: ${lifecycleProfile}`,
        snapshot.decisionSessionReference
          ? `Decision Session (${snapshot.decisionSessionReference.sessionId})`
          : "Decision Session (optional / may be absent on PUBLIC_CHOICE)",
        snapshot.petitionReference
          ? `Petition (${snapshot.petitionReference.petitionId})`
          : "Petition (optional)",
        "Voting results: Initiative Decision Vote records only — never synthesize",
      ];
      const summary = [
        `Profile ${lifecycleProfile}: use only applicable stage sources.`,
        "Voting Results must come from canonical Initiative Decision Vote records.",
        "Do not invent vote tallies, winners, or turnout.",
      ].join(" ");
      return { labels, summary };
    }

    if (stageId === "archive") {
      const snapshot = await buildInitiativeCivicArchiveIntelligenceSnapshot(initiativeId);
      const labels = [
        `Lifecycle profile: ${lifecycleProfile}`,
        snapshot.publicImpactReportReference
          ? `Public Impact (${snapshot.publicImpactReportReference.recordId})`
          : "Public Impact (not published)",
        snapshot.decisionReference
          ? `Collective Decision (${snapshot.decisionReference.recordId})`
          : "Collective Decision (optional / may be absent)",
        `Timeline entries (${snapshot.timeline.length})`,
      ];
      const summary = [
        `Civic Archive for profile ${lifecycleProfile}.`,
        `Public Impact available: ${snapshot.isPublicImpactReportAvailable}.`,
        "Use available canonical records; stages not on this profile must be described honestly as not on route / unavailable — never invent history.",
      ].join(" ");
      return { labels, summary };
    }
  } catch {
    // Fall through to honest placeholder — never invent stage facts.
  }

  const definition = getInitiativeLifecycleStageDefinition(stageId);
  return {
    labels: [
      definition ? `${definition.label} stage sources` : "Lifecycle stage sources",
      `Lifecycle profile: ${lifecycleProfile}`,
    ],
    summary: [
      `Source Snapshot for ${definition?.label ?? stageId} (stage-specific intelligence).`,
      `Lifecycle profile: ${lifecycleProfile}.`,
      "Private messages and credentials are excluded.",
      "Missing upstream stages are SOURCE_OPTIONAL — do not invent facts, votes, Official Responses, or evidence.",
    ].join(" "),
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
  const lifecycleProfile = (input.initiative.lifecycleProfile ?? "STANDARD") as InitiativeLifecycleProfile;
  const sources = await resolveStageSources(
    input.stageId,
    input.initiative.initiativeId,
    lifecycleProfile,
  );
  const participantDisplayName = await resolveParticipantDisplayName(input.identity);
  const instructions = input.instructions?.trim() || undefined;
  const currentDraftExcerpt = DRAFT_REQUIRED_OPERATIONS.has(input.operation)
    ? sanitizePublicDraftExcerpt(input.currentDraftExcerpt)
    : undefined;

  const includedFields = [
    "participantDisplayName",
    "initiativeId",
    "initiativeTitle",
    "lifecycleProfile",
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
    lifecycleProfile,
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

  assertLifecycleAiPayloadIsPrivateFree(
    {
      participantDisplayName: context.participantDisplayName,
      initiativeTitle: context.initiativeTitle,
      lifecycleProfile: context.lifecycleProfile,
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
