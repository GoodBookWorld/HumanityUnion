import { randomUUID } from "node:crypto";

import type {
  Initiative,
  InitiativePublicImpactLifecycleDraft,
  InitiativePublicImpactLifecycleDraftContext,
  InitiativePublicImpactReport,
  PublicImpactTraceability,
} from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { listCommitmentsByInitiative } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { listTrackingsByInitiative } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { getPackageByInitiativeId as getOfficialResponsePackageByInitiativeId } from "../initiative-official-response-lifecycle/initiative-official-response-package.store.js";
import { publishInitiativeLifecycleStage } from "../../shared/initiative-lifecycle-stage/index.js";
import { createReminderIfNotExists } from "../reminders/reminder.service.js";
import { findAuthUsersByMemberIds } from "../auth/auth-user.repository.js";
import { generatePublicImpactDraftContent } from "./initiative-public-impact-draft-builder.js";
import {
  deleteInitiativePublicImpactLifecycleDraft,
  getInitiativePublicImpactLifecycleDraftByInitiativeId,
  updateInitiativePublicImpactLifecycleDraft,
  upsertInitiativePublicImpactLifecycleDraft,
  type InitiativePublicImpactLifecycleDraftUpdate,
} from "./initiative-public-impact-lifecycle-draft.store.js";
import { buildInitiativePublicImpactIntelligenceSnapshot } from "./initiative-public-impact-intelligence.service.js";
import {
  getReportById,
  getReportByInitiativeId,
  upsertReport,
} from "./initiative-public-impact-report.store.js";
import { validateInitiativePublicImpactLifecycleDraftForPublication } from "./initiative-public-impact-lifecycle.validators.js";

function emptyParticipationStatistics() {
  return {
    signatureCount: 0,
    supportCount: 0,
    reactionCount: 0,
    activeAllyCount: 0,
  };
}

function getOwnedInitiative(initiativeId: string, identity: RequestIdentity): Initiative {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  return initiative;
}

function getOrCreateWorkingDraft(
  identity: RequestIdentity,
  initiative: Initiative,
): InitiativePublicImpactLifecycleDraft {
  const existing = getInitiativePublicImpactLifecycleDraftByInitiativeId(initiative.initiativeId);

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const draft: InitiativePublicImpactLifecycleDraft = {
    draftId: `initiative-public-impact-draft-${randomUUID()}`,
    initiativeId: initiative.initiativeId,
    authorId: identity.participantId,
    title: "",
    officialResponsePackageId: null,
    trackingPackageId: null,
    commitmentPackageId: null,
    decisionId: null,
    sections: [],
    participationStatistics: emptyParticipationStatistics(),
    createdAt: now,
    updatedAt: now,
  };

  return upsertInitiativePublicImpactLifecycleDraft(draft);
}

export async function getInitiativePublicImpactWorkspaceContext(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativePublicImpactLifecycleDraftContext> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const publishedReport = getReportByInitiativeId(initiativeId);
  const intelligenceSnapshot = await buildInitiativePublicImpactIntelligenceSnapshot(initiativeId);

  if (publishedReport) {
    return {
      draft: null,
      intelligenceSnapshot,
      publishedReportId: publishedReport.reportId,
    };
  }

  const draft = getOrCreateWorkingDraft(identity, initiative);

  return {
    draft,
    intelligenceSnapshot,
    publishedReportId: null,
  };
}

export async function generateInitiativePublicImpactDraft(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativePublicImpactLifecycleDraft> {
  const initiative = getOwnedInitiative(initiativeId, identity);

  if (getReportByInitiativeId(initiativeId)) {
    throw new Error("Public Impact has already been published for this Initiative.");
  }

  const snapshot = await buildInitiativePublicImpactIntelligenceSnapshot(initiativeId);

  if (!snapshot.isOfficialResponsePackageAvailable) {
    throw new Error(
      "A published Official Response Package is required before generating Public Impact.",
    );
  }

  const content = await generatePublicImpactDraftContent(snapshot);
  const existing = getOrCreateWorkingDraft(identity, initiative);
  const updated = updateInitiativePublicImpactLifecycleDraft(initiativeId, {
    title: content.title,
    officialResponsePackageId: content.officialResponsePackageId,
    trackingPackageId: content.trackingPackageId,
    commitmentPackageId: content.commitmentPackageId,
    decisionId: content.decisionId,
    sections: content.sections.map((section) => structuredClone(section)),
    participationStatistics: structuredClone(content.participationStatistics),
  });

  return updated ?? existing;
}

export function saveInitiativePublicImpactDraft(
  identity: RequestIdentity,
  initiativeId: string,
  input: InitiativePublicImpactLifecycleDraftUpdate,
): InitiativePublicImpactLifecycleDraft {
  getOwnedInitiative(initiativeId, identity);

  if (getReportByInitiativeId(initiativeId)) {
    throw new Error("Public Impact has already been published for this Initiative.");
  }

  const existing = getInitiativePublicImpactLifecycleDraftByInitiativeId(initiativeId);

  if (!existing) {
    throw new Error("Public Impact draft not found.");
  }

  const updated = updateInitiativePublicImpactLifecycleDraft(initiativeId, input);

  if (!updated) {
    throw new Error("Public Impact draft not found.");
  }

  return updated;
}

function buildPublicImpactTraceability(
  draft: InitiativePublicImpactLifecycleDraft,
  snapshot: Awaited<ReturnType<typeof buildInitiativePublicImpactIntelligenceSnapshot>>,
): PublicImpactTraceability {
  const trackings = listTrackingsByInitiative(draft.initiativeId);
  const commitments = listCommitmentsByInitiative(draft.initiativeId);
  const primaryCommitment = commitments.find(
    (commitment) => commitment.proposalStatus === "accepted",
  );
  const source = primaryCommitment?.traceability ?? null;
  const evidenceReferences = [
    ...new Set(draft.sections.flatMap((section) => section.evidenceReferences)),
  ];

  return {
    analysisId: source?.analysisId ?? snapshot.analysisReference?.analysisId ?? null,
    analysisVersion: source?.analysisVersion ?? snapshot.analysisReference?.version ?? null,
    proposalIds: source ? [...source.proposalIds] : [],
    revisionId: source?.revisionId ?? snapshot.revisionReference?.revisionId ?? null,
    revisionVersion: source?.revisionVersion ?? snapshot.revisionReference?.version ?? null,
    petitionId: source?.petitionId ?? snapshot.petitionReference?.petitionId ?? null,
    petitionVersion: source?.petitionVersion ?? snapshot.petitionReference?.version ?? null,
    decisionSessionId:
      source?.decisionSessionId ?? snapshot.decisionSessionReference?.sessionId ?? null,
    decisionSessionVersion:
      source?.decisionSessionVersion ?? snapshot.decisionSessionReference?.version ?? null,
    decisionId:
      draft.decisionId ??
      source?.decisionId ??
      primaryCommitment?.decisionId ??
      snapshot.decisionReference?.decisionId ??
      null,
    commitmentPackageId: draft.commitmentPackageId,
    trackingPackageId: draft.trackingPackageId,
    officialResponsePackageId: draft.officialResponsePackageId,
    relatedTrackingIds: trackings.map((tracking) => tracking.trackingId),
    relatedCommitmentIds: commitments.map((commitment) => commitment.commitmentId),
    relatedOfficialResponseIds: [
      ...(snapshot.officialResponsePackageReference?.responseIds ?? []),
    ],
    evidenceReferences,
  };
}

async function createReminderCandidatesForPublishedPublicImpactReport(input: {
  initiative: Initiative;
  report: InitiativePublicImpactReport;
  actorParticipantId: string;
}): Promise<void> {
  const allies = await listActiveAlliesByInitiative(input.initiative.initiativeId);
  const trackings = listTrackingsByInitiative(input.initiative.initiativeId);
  const allyIds = allies
    .map((ally) => ally.participantId)
    .filter((participantId) => participantId !== input.actorParticipantId);
  const responsibleIds = trackings
    .map((tracking) => tracking.participantId)
    .filter((participantId) => participantId !== input.actorParticipantId);

  const recipientParticipantIds = [...new Set([...allyIds, ...responsibleIds])];
  const relatedUrl = `/initiatives/public/${encodeURIComponent(input.initiative.initiativeId)}#public-impact`;

  if (recipientParticipantIds.length > 0) {
    const usersByMemberId = await findAuthUsersByMemberIds(recipientParticipantIds);

    for (const participantId of recipientParticipantIds) {
      const user = usersByMemberId.get(participantId);

      if (!user) {
        continue;
      }

      await createReminderIfNotExists({
        recipientUserId: user.userId,
        recipientProfileId: participantId,
        category: "implementation",
        title: "Public Impact published",
        message: `The Public Impact Report for "${input.initiative.title}" has been published.`,
        relatedEntityType: "public_impact_report",
        relatedEntityId: input.report.reportId,
        relatedUrl,
      });
    }

    const outstanding = trackings.filter((tracking) => tracking.status !== "completed");
    if (outstanding.length > 0) {
      for (const participantId of recipientParticipantIds) {
        const user = usersByMemberId.get(participantId);

        if (!user) {
          continue;
        }

        await createReminderIfNotExists({
          recipientUserId: user.userId,
          recipientProfileId: participantId,
          category: "implementation",
          title: "Outstanding implementation remains",
          message: `"${input.initiative.title}" still has ${outstanding.length} Tracking Record(s) that are not completed.`,
          relatedEntityType: "public_impact_report",
          // Distinct from the publish reminder so createReminderIfNotExists
          // does not collapse both candidates onto the same report id.
          relatedEntityId: `${input.report.reportId}:outstanding`,
          relatedUrl,
        });
      }
    }
  }

  const authorUsers = await findAuthUsersByMemberIds([input.actorParticipantId]);
  const authorUser = authorUsers.get(input.actorParticipantId);

  if (authorUser) {
    await createReminderIfNotExists({
      recipientUserId: authorUser.userId,
      recipientProfileId: input.actorParticipantId,
      category: "implementation",
      title: "Archive preparation available",
      message: `Civic Archive preparation is available for "${input.initiative.title}" after Public Impact publication.`,
      relatedEntityType: "public_impact_report",
      relatedEntityId: input.report.reportId,
      relatedUrl: `/initiatives/public/${encodeURIComponent(input.initiative.initiativeId)}#archive`,
    });
  }
}

/**
 * Initiative Lifecycle — Part L. Publishes the working draft as one
 * Public Impact Report, followed by exactly one Lifecycle stage
 * publication and Reminder candidates for Active Allies and responsible
 * Tracking Participants. This is a Lifecycle Stage Workspace artifact —
 * it never creates, mutates, or reads the pre-existing TASK-033
 * `InitiativePublicImpact` domain (`../initiative-public-impact/`).
 */
export async function publishInitiativePublicImpactStage(
  identity: RequestIdentity,
  initiativeId: string,
): Promise<InitiativePublicImpactReport> {
  const initiative = getOwnedInitiative(initiativeId, identity);
  const draft = getInitiativePublicImpactLifecycleDraftByInitiativeId(initiativeId);

  if (!draft) {
    throw new Error("Public Impact draft not found.");
  }

  validateInitiativePublicImpactLifecycleDraftForPublication(draft);

  if (getReportByInitiativeId(initiativeId)) {
    throw new Error("Public Impact has already been published for this Initiative.");
  }

  const snapshot = await buildInitiativePublicImpactIntelligenceSnapshot(initiativeId);
  const currentOfficialResponsePackage = getOfficialResponsePackageByInitiativeId(initiativeId);

  if (
    !snapshot.officialResponsePackageReference ||
    !currentOfficialResponsePackage ||
    snapshot.officialResponsePackageReference.packageId !== draft.officialResponsePackageId
  ) {
    throw new Error(
      "The Official Response Package this draft was generated from is no longer current. Generate Public Impact again before publishing.",
    );
  }

  const now = new Date().toISOString();
  const reportId = `public-impact-report-${randomUUID()}`;

  const report: InitiativePublicImpactReport = {
    reportId,
    initiativeId,
    stewardId: initiative.stewardId,
    title: draft.title,
    sections: draft.sections.map((section) => structuredClone(section)),
    participationStatistics: structuredClone(draft.participationStatistics),
    officialResponsePackageId: draft.officialResponsePackageId,
    trackingPackageId: draft.trackingPackageId,
    commitmentPackageId: draft.commitmentPackageId,
    decisionId: draft.decisionId,
    traceability: buildPublicImpactTraceability(draft, snapshot),
    status: "published",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  upsertReport(report);
  deleteInitiativePublicImpactLifecycleDraft(initiativeId);

  try {
    await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      lifecycleProfile: initiative.lifecycleProfile,
      stageId: "public_impact",
      stageLabel: "Public Impact",
      stageArtifactId: reportId,
      stageVersion: 1,
      actorParticipantId: identity.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#public-impact`,
    });
  } catch (error) {
    console.warn(
      `[initiative-public-impact-lifecycle] Lifecycle stage notification skipped: ${String(error)}`,
    );
  }

  try {
    await createReminderCandidatesForPublishedPublicImpactReport({
      initiative,
      report,
      actorParticipantId: identity.participantId,
    });
  } catch (error) {
    console.warn(`[initiative-public-impact-lifecycle] Reminder candidates skipped: ${String(error)}`);
  }

  return report;
}

export function getPublishedInitiativePublicImpactReport(
  initiativeId: string,
): InitiativePublicImpactReport | null {
  return getReportByInitiativeId(initiativeId);
}

export function getPublishedInitiativePublicImpactReportById(
  reportId: string,
): InitiativePublicImpactReport | null {
  return getReportById(reportId);
}
