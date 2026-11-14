import type { PublicPetitionRecord, PetitionState } from "@hu/types";

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

export function isSignatureWithdrawalAvailable(petition: PublicPetitionRecord): boolean {
  return (
    petition.status === "Open" && petition.policy.withdrawalPolicy?.withdrawalPermitted === true
  );
}
