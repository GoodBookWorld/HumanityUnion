import type {
  CommitmentState,
  ContributionItem,
  ImplementationCommitment,
} from "@hu/types";

export const BOOTSTRAP_PARTICIPANT_ID = "member-bootstrap-001";

export const PIPELINE_STAGES = [
  "Initiative",
  "Collaborative Analysis",
  "Collective Decision",
  "Petition",
  "Implementation Commitment",
  "Implementation",
  "Impact",
] as const;

export interface ThresholdCatalogEntry {
  thresholdId: string;
  description: string;
  optional?: boolean;
}

/** Display catalog aligned with bootstrap Frozen Policy — read-only workspace context. */
export const THRESHOLD_CATALOG: ThresholdCatalogEntry[] = [
  {
    thresholdId: "threshold-coordinator",
    description: "One coordinator needed",
  },
  {
    thresholdId: "threshold-translator",
    description: "Two translators needed",
  },
  {
    thresholdId: "threshold-volunteer-base",
    description: "Three volunteer contributors needed",
  },
  {
    thresholdId: "threshold-facility",
    description: "Meeting venue or facility resource",
    optional: true,
  },
];

export function formatCommitmentDate(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getPipelineStageStatus(stage: (typeof PIPELINE_STAGES)[number]): string {
  const currentIndex = PIPELINE_STAGES.indexOf("Implementation Commitment");

  if (stage === "Implementation Commitment") {
    return "Current stage";
  }

  const stageIndex = PIPELINE_STAGES.indexOf(stage);

  if (stageIndex < currentIndex) {
    return "Complete";
  }

  return "Not yet active";
}

export function getLifecycleSummary(status: CommitmentState): string {
  switch (status) {
    case "Draft":
      return "Preparing commitment collection";
    case "Submitted":
      return "Submitted — awaiting activation";
    case "Active":
      return "Active — accepting declarations";
    case "Withdrawn":
      return "Commitment phase withdrawn";
    case "Completed":
      return "Commitment collection completed";
    case "Archived":
      return "Archived historical record";
    default:
      return status;
  }
}

export function getActiveParticipantItem(
  commitment: ImplementationCommitment,
  participantId: string,
): ContributionItem | undefined {
  return commitment.contributionItems.find(
    (item) => item.participantId === participantId && item.commitmentStatus === "Declared",
  );
}

export function getParticipantItems(
  commitment: ImplementationCommitment,
  participantId: string,
): ContributionItem[] {
  return commitment.contributionItems.filter((item) => item.participantId === participantId);
}

export function participantHasActiveDeclaration(
  commitment: ImplementationCommitment,
  participantId: string,
): boolean {
  return getActiveParticipantItem(commitment, participantId) !== undefined;
}

export function getThresholdDescription(thresholdId: string): string {
  return (
    THRESHOLD_CATALOG.find((entry) => entry.thresholdId === thresholdId)?.description ??
    thresholdId
  );
}

export function isOptionalThreshold(thresholdId: string): boolean {
  return THRESHOLD_CATALOG.find((entry) => entry.thresholdId === thresholdId)?.optional ?? false;
}

export interface PolicyRequirementGroup {
  thresholdId: string;
  description: string;
}

export function getPolicyRequirementGroups(commitment: ImplementationCommitment): {
  satisfied: PolicyRequirementGroup[];
  pending: PolicyRequirementGroup[];
  optional: PolicyRequirementGroup[];
} {
  const satisfied: PolicyRequirementGroup[] = [];
  const pending: PolicyRequirementGroup[] = [];
  const optional: PolicyRequirementGroup[] = [];

  for (const entry of THRESHOLD_CATALOG) {
    const group = {
      thresholdId: entry.thresholdId,
      description: entry.description,
    };

    if (entry.optional) {
      optional.push(group);
      continue;
    }

    if (commitment.implementationReadiness.satisfiedThresholds.includes(entry.thresholdId)) {
      satisfied.push(group);
    } else {
      pending.push(group);
    }
  }

  for (const entry of THRESHOLD_CATALOG.filter((item) => item.optional)) {
    if (commitment.implementationReadiness.satisfiedThresholds.includes(entry.thresholdId)) {
      const index = optional.findIndex((item) => item.thresholdId === entry.thresholdId);

      if (index >= 0) {
        optional[index] = { thresholdId: entry.thresholdId, description: `${entry.description} (satisfied)` };
      }
    }
  }

  return { satisfied, pending, optional };
}

export function getCommunityNeeds(commitment: ImplementationCommitment): PolicyRequirementGroup[] {
  return commitment.implementationReadiness.unsatisfiedThresholds
    .filter((thresholdId) => !isOptionalThreshold(thresholdId))
    .map((thresholdId) => ({
      thresholdId,
      description: getThresholdDescription(thresholdId),
    }));
}

export interface NextMeaningfulAction {
  title: string;
  detail: string;
}

export function deriveNextMeaningfulAction(
  commitment: ImplementationCommitment,
  participantId: string,
): NextMeaningfulAction {
  const hasDeclaration = participantHasActiveDeclaration(commitment, participantId);
  const needs = getCommunityNeeds(commitment);
  const { status } = commitment;

  if (status === "Draft") {
    return {
      title: "Review Initiative Context and Frozen Policy",
      detail:
        "This commitment is being prepared. Understand the approved direction and policy requirements before collection opens.",
    };
  }

  if (status === "Submitted") {
    return {
      title: "Wait for activation",
      detail:
        "Commitment collection has not started yet. Review policy thresholds while activation is pending.",
    };
  }

  if (status === "Active") {
    if (!hasDeclaration) {
      if (needs.length > 0) {
        return {
          title: "Review Community Needs before declaring",
          detail: `Community Needs include: ${needs.map((need) => need.description).join("; ")}. Declare only if you choose to offer matching capacity.`,
        };
      }

      return {
        title: "Declare a contribution if eligible",
        detail:
          "Use the Contribution Declaration Panel when you are ready to record preparedness. Declaration does not assign work.",
      };
    }

    return {
      title: "Review readiness progress",
      detail:
        "Your declaration is recorded. Review Implementation Readiness and update availability if your context changed.",
    };
  }

  if (status === "Completed") {
    return {
      title: "Review final readiness summary",
      detail:
        "Commitment collection has ended successfully. Review derived readiness meaning — readiness is not approval of the collective decision.",
    };
  }

  if (status === "Withdrawn" || status === "Archived") {
    return {
      title: "Review historical commitment record",
      detail: "This commitment phase is closed. Declaration is no longer available.",
    };
  }

  return {
    title: "Review this workspace",
    detail: "Continue reading for current civic context.",
  };
}

export interface AssistantGuidance {
  summary: string;
  highlights: string[];
  suggestion: string;
}

export function deriveAssistantGuidance(
  commitment: ImplementationCommitment,
  participantId: string,
): AssistantGuidance {
  const needs = getCommunityNeeds(commitment);
  const hasDeclaration = participantHasActiveDeclaration(commitment, participantId);
  const readiness = commitment.implementationReadiness;

  const highlights: string[] = [
    "Implementation Readiness is derived from declared capacity and Frozen Policy.",
    "Readiness is not approval of the Collective Decision.",
  ];

  if (needs.length > 0) {
    highlights.push(
      ...needs.map((need) => `Pending policy requirement: ${need.description}.`),
    );
  } else if (commitment.status === "Active") {
    highlights.push("Required Community Needs are currently satisfied by declared capacity.");
  }

  let suggestion = deriveNextMeaningfulAction(commitment, participantId).detail;

  if (commitment.status === "Active" && !hasDeclaration && needs.length > 0) {
    suggestion =
      "Review whether your skills and availability match a pending Community Need before using the Contribution Declaration Panel.";
  }

  return {
    summary:
      "This assistant explains context and highlights unmet policy requirements. It does not decide, create, or modify commitments on your behalf.",
    highlights,
    suggestion,
  };
}
