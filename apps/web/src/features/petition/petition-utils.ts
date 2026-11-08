import type { Petition, PetitionState } from "@hu/types";

import type { ClientAuthStatus } from "../auth/use-client-auth-status";

export const BOOTSTRAP_PARTICIPANT_ID = "member-bootstrap-001";

/**
 * Viewer signature as reported by the server for the current session
 * (`viewerHasSigned` on the public Petition projection) — never derived from a
 * client-held participant id.
 */
export type ViewerSignatureStatus = "unknown" | "signed" | "unsigned" | "unavailable";

export type SignatureSectionState =
  | "checking"
  | "sign_in"
  | "just_signed"
  | "already_signed"
  | "not_open"
  | "status_unavailable"
  | "unsigned";

export function resolveSignatureSectionState(input: {
  readonly authStatus: ClientAuthStatus;
  readonly viewerSignature: ViewerSignatureStatus;
  readonly justSigned: boolean;
  readonly petitionStatus: PetitionState;
}): SignatureSectionState {
  if (input.authStatus === "pending") {
    return "checking";
  }

  if (input.authStatus === "unauthenticated") {
    return input.petitionStatus === "Open" ? "sign_in" : "not_open";
  }

  if (input.viewerSignature === "signed") {
    return input.justSigned ? "just_signed" : "already_signed";
  }

  if (input.petitionStatus !== "Open") {
    return "not_open";
  }

  if (input.viewerSignature === "unknown") {
    return "checking";
  }

  return input.viewerSignature === "unavailable" ? "status_unavailable" : "unsigned";
}

export function isSignatureWithdrawalAvailable(petition: Petition): boolean {
  return (
    petition.status === "Open" && petition.policy.withdrawalPolicy?.withdrawalPermitted === true
  );
}

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
  viewerHasSigned: boolean,
): NextMeaningfulAction {
  const hasSigned = viewerHasSigned;
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
