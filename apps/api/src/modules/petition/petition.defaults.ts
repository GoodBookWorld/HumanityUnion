import type { PetitionPolicy } from "@hu/types";

const BOOTSTRAP_TIMESTAMP = "2026-07-02T00:00:00.000Z";

export const defaultPetitionPolicy: PetitionPolicy = {
  eligibility: {
    membershipRequired: true,
    verificationLevelRequired: null,
    regionRequired: null,
    organizationRequired: null,
    minimumAccountAge: null,
    customEligibilityPolicy: null,
  },
  visibility: {
    signatureVisibility: "operational",
    publicStatisticsEnabled: true,
  },
  signaturePolicy: {
    oneSignaturePerParticipant: true,
    signingRequiresOpenState: true,
  },
  withdrawalPolicy: {
    withdrawalPermitted: false,
    withdrawalPolicyDescription: null,
  },
  publicationRules: {
    shareLinkRequiredOnPublish: true,
    subjectSnapshotFrozenOnPublish: true,
  },
  endorsementPeriod: {
    opensAt: null,
    closesAt: null,
  },
};

export const bootstrapPetitionId = "petition-bootstrap-001";

export const bootstrapCollectiveDecisionId = "decision-bootstrap-001";

export const bootstrapInitiativeId = "initiative-bootstrap-001";

export { BOOTSTRAP_TIMESTAMP };
