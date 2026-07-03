export interface PetitionEligibilityRules {
  membershipRequired: boolean;
  verificationLevelRequired: string | null;
  regionRequired: string | null;
  organizationRequired: string | null;
  minimumAccountAge: number | null;
  customEligibilityPolicy: string | null;
}

export interface PetitionVisibilityRules {
  signatureVisibility: string;
  publicStatisticsEnabled: boolean;
}

export interface PetitionSignaturePolicy {
  oneSignaturePerParticipant: boolean;
  signingRequiresOpenState: boolean;
}

export interface PetitionWithdrawalPolicy {
  withdrawalPermitted: boolean;
  withdrawalPolicyDescription: string | null;
}

export interface PetitionPublicationRules {
  shareLinkRequiredOnPublish: boolean;
  subjectSnapshotFrozenOnPublish: boolean;
}

export interface PetitionEndorsementPeriodRules {
  opensAt: string | null;
  closesAt: string | null;
}

export interface PetitionPolicy {
  eligibility: PetitionEligibilityRules;
  visibility: PetitionVisibilityRules;
  signaturePolicy: PetitionSignaturePolicy;
  withdrawalPolicy: PetitionWithdrawalPolicy;
  publicationRules: PetitionPublicationRules;
  endorsementPeriod: PetitionEndorsementPeriodRules;
}
