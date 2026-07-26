import type { MemberRole, MemberStatus, VerificationLevel } from "@hu/types";

/** Civic Member registration lifecycle — distinct from auth email verification. */
export type MemberRegistrationStatus = "registered";

/** Persisted Member aggregate owned by the Member bounded context. */
export interface PersistedMemberRecord {
  memberId: string;
  identityId: string;
  displayName: string;
  uniqueName: string;
  country?: string;
  region?: string;
  city?: string;
  languages: string[];
  status: MemberStatus;
  verificationLevel: VerificationLevel;
  roles: MemberRole[];
  registrationStatus: MemberRegistrationStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersistedMemberInput {
  memberId: string;
  identityId: string;
  displayName: string;
  uniqueName: string;
  verificationLevel?: VerificationLevel;
}
