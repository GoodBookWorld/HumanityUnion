import type { Petition, PetitionState, Signature } from "@hu/types";

export const BOOTSTRAP_PARTICIPANT_ID = "member-bootstrap-001";

const PIPELINE_STAGES = [
  "Initiative",
  "Collaborative Analysis",
  "Collective Decision",
  "Petition",
  "Implementation Commitment",
  "Implementation",
  "Impact",
] as const;

export function formatPetitionDate(value: string | null | undefined): string {
  if (!value) {
    return "Not scheduled";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getSupportStatusSummary(status: PetitionState): string {
  switch (status) {
    case "Draft":
    case "Ready":
      return "Preparing for endorsement";
    case "Published":
      return "Published — endorsement not yet open";
    case "Open":
      return "Open for endorsement";
    case "Closed":
      return "Endorsement closed";
    case "Archived":
      return "Archived";
    default:
      return status;
  }
}

export function findParticipantSignature(
  petition: Petition,
  participantId: string,
): Signature | undefined {
  return petition.signatures.find(
    (signature) =>
      signature.participantId === participantId && signature.status === "Active",
  );
}

export function participantHasSigned(petition: Petition, participantId: string): boolean {
  return findParticipantSignature(petition, participantId) !== undefined;
}

export function getPipelineStageStatus(stage: (typeof PIPELINE_STAGES)[number]): string {
  const currentIndex = PIPELINE_STAGES.indexOf("Petition");

  if (stage === "Petition") {
    return "Current stage";
  }

  const stageIndex = PIPELINE_STAGES.indexOf(stage);

  if (stageIndex < currentIndex) {
    return "Complete";
  }

  return "Not yet active";
}

export { PIPELINE_STAGES };

export interface NextMeaningfulAction {
  title: string;
  detail: string;
}

export function deriveNextMeaningfulAction(
  petition: Petition,
  participantId: string,
): NextMeaningfulAction {
  const hasSigned = participantHasSigned(petition, participantId);
  const { status } = petition;

  if (status === "Draft" || status === "Ready") {
    return {
      title: "Review decision context",
      detail:
        "This Petition is being prepared. Read the approved Collective Decision context while publication is pending.",
    };
  }

  if (status === "Published") {
    if (hasSigned) {
      return {
        title: "Follow support progress",
        detail:
          "Your signature is recorded. Follow support statistics until the endorsement period closes.",
      };
    }

    return {
      title: "Read decision context",
      detail:
        "Endorsement has not opened yet. Understand what was approved before signing becomes available.",
    };
  }

  if (status === "Open") {
    if (hasSigned) {
      return {
        title: "Continue civic journey",
        detail:
          "Review related Initiative or Collective Decision context, or follow public support as it develops.",
      };
    }

    return {
      title: "Sign this Petition",
      detail:
        "Use the Signature section when you are ready to record your endorsement through the Endorsement Panel.",
    };
  }

  if (status === "Closed" || status === "Archived") {
    return {
      title: "Review Petition outcome",
      detail:
        "Endorsement has ended. Review the outcome and final support statistics. Signing is no longer available.",
    };
  }

  return {
    title: "Review this Petition",
    detail: "Continue reading this workspace for current civic context.",
  };
}
