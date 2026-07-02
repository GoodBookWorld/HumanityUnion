import type { VerificationLevel } from "../member.js";

export interface EligibilityRules {
  membershipRequired: boolean;
  verificationLevelRequired: VerificationLevel | null;
  regionRequired: string | null;
  organizationRequired: string | null;
  minimumAccountAge: number | null;
  customEligibilityPolicy: string | null;
}
