import type {
  InitiativeOfficialResponseConsistencyCheck,
  InitiativeOfficialResponseIntelligenceSnapshot,
  InitiativeOfficialResponseTrackingPackageReference,
  InitiativeOfficialResponseTrackingRecordReference,
} from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { listCommitmentsByInitiative } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { listTrackingsByInitiative } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { getPackageByInitiativeId as getTrackingPackageByInitiativeId } from "../initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-package.store.js";

function buildConsistencyChecks(input: {
  trackingPackageReference: InitiativeOfficialResponseTrackingPackageReference | null;
  trackingRecords: readonly InitiativeOfficialResponseTrackingRecordReference[];
}): readonly InitiativeOfficialResponseConsistencyCheck[] {
  const checks: InitiativeOfficialResponseConsistencyCheck[] = [];

  checks.push(
    input.trackingPackageReference
      ? {
          checkId: "tracking-package-available",
          label: "Published Implementation Tracking Package",
          status: "ok",
          detail: `Implementation Tracking "${input.trackingPackageReference.title}" is available as the Official Response source.`,
          params: {},
          civic: { title: input.trackingPackageReference.title },
        }
      : {
          checkId: "tracking-package-available",
          label: "Published Implementation Tracking Package",
          status: "warning",
          detail: "No published Implementation Tracking Package yet — Official Responses can still be authored from Initiative context, including No official response received.",
          params: {},
        },
  );

  checks.push(
    input.trackingRecords.length > 0
      ? {
          checkId: "tracking-records-available",
          label: "Tracking Records",
          status: "ok",
          detail: `${input.trackingRecords.length} Tracking Record(s) are available from the Tracking Package.`,
          params: { count: input.trackingRecords.length },
        }
      : {
          checkId: "tracking-records-available",
          label: "Tracking Records",
          status: "warning",
          detail: "No Tracking Record is available yet.",
          params: { count: 0 },
        },
  );

  const withEvidence = input.trackingRecords.filter((tracking) => tracking.evidenceReferences.length > 0);
  checks.push(
    withEvidence.length > 0
      ? {
          checkId: "evidence-visible",
          label: "Evidence Visibility",
          status: "ok",
          detail: `${withEvidence.length} Tracking Record(s) carry an Evidence Reference.`,
          params: { count: withEvidence.length },
        }
      : {
          checkId: "evidence-visible",
          label: "Evidence Visibility",
          status: "warning",
          detail: "No Tracking Record carries an Evidence Reference yet.",
          params: { count: 0 },
        },
  );

  const withApprovedAction = input.trackingRecords.filter((tracking) => Boolean(tracking.approvedAction));
  const allTraceable =
    withApprovedAction.length === input.trackingRecords.length && input.trackingRecords.length > 0;
  checks.push(
    allTraceable
      ? {
          checkId: "approved-actions-traceable",
          label: "Approved Action Traceability",
          status: "ok",
          detail: "Every Tracking Record cites its Approved Action.",
          params: { allTraceable: true },
        }
      : {
          checkId: "approved-actions-traceable",
          label: "Approved Action Traceability",
          status: "warning",
          detail: "One or more Tracking Records are missing an Approved Action reference.",
          params: { allTraceable: false },
        },
  );

  return checks;
}

/**
 * Initiative Lifecycle — Part K, Section 2/9. Read-only aggregation of the
 * published Implementation Tracking Package (Part J) and its Tracking
 * Records — Official Responses' one mandatory source unit. Never mutates a
 * Tracking Record and never itself makes an AI decision.
 */
export async function buildInitiativeOfficialResponseIntelligenceSnapshot(
  initiativeId: string,
): Promise<InitiativeOfficialResponseIntelligenceSnapshot> {
  // Mirror Implementation Tracking Intelligence: degrade gracefully when
  // the Initiative is not yet readable from the store.
  const initiative = getInitiativeById(initiativeId);
  const trackingPackage = getTrackingPackageByInitiativeId(initiativeId);
  const trackings = listTrackingsByInitiative(initiativeId);

  const trackingRecords: InitiativeOfficialResponseTrackingRecordReference[] = trackings.map((tracking) => ({
    trackingId: tracking.trackingId,
    commitmentId: tracking.commitmentId,
    approvedAction: tracking.approvedAction ?? null,
    participantId: tracking.participantId,
    status: tracking.status,
    progress: tracking.progress ?? null,
    evidenceReferences: [...(tracking.evidenceReferences ?? [])],
    summary: tracking.summary,
  }));

  const trackingPackageReference: InitiativeOfficialResponseTrackingPackageReference | null = trackingPackage
    ? {
        packageId: trackingPackage.packageId,
        title: trackingPackage.title,
        summary: trackingPackage.summary,
        publishedAt: trackingPackage.publishedAt,
        trackingIds: [...trackingPackage.trackingIds],
        commitmentPackageId: trackingPackage.commitmentPackageId,
        decisionId: trackingPackage.decisionId,
      }
    : null;

  let activeAllyCount = 0;
  try {
    activeAllyCount = (await listActiveAlliesByInitiative(initiativeId)).length;
  } catch {
    activeAllyCount = 0;
  }

  const completedTrackingCount = trackings.filter((tracking) => tracking.status === "completed").length;
  const acceptedCommitmentCount = listCommitmentsByInitiative(initiativeId).filter(
    (commitment) => commitment.proposalStatus === "accepted",
  ).length;
  const completedCommitmentCount =
    completedTrackingCount > 0 ? completedTrackingCount : acceptedCommitmentCount;

  const consistencyChecks = buildConsistencyChecks({ trackingPackageReference, trackingRecords });
  const isTrackingPackageAvailable = trackingPackage !== null;

  return {
    initiativeId,
    generatedAt: new Date().toISOString(),
    initiativeTitle: initiative?.title ?? "",
    initiativeDescription: initiative?.description ?? "",
    trackingPackageReference,
    trackingRecords,
    completedCommitmentCount,
    activeAllyCount,
    decisionId: trackingPackageReference?.decisionId ?? null,
    consistencyChecks,
    isTrackingPackageAvailable,
    isEmpty: !initiative,
  };
}
