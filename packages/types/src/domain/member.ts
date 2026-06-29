import type { BaseEntity } from "../common/base-entity.js";

export type MemberId = string;

export type MemberStatus = "active" | "inactive" | "suspended" | "archived";

export type VerificationLevel = "none" | "email" | "identity" | "institution" | "trusted";

export type MemberRole = "member" | "moderator" | "admin" | "institution";

export interface FairBalance {
  personal: number;
  community: number;
  regional: number;
  global: number;
}

export interface MemberProfile {
  displayName: string;
  uniqueName: string;
  avatarUrl?: string;
  country?: string;
  region?: string;
  city?: string;
  bio?: string;
  languages: string[];
}

export interface ImpactProfileSummary {
  scope: string;
  priorityCategories: string[];
  preferredTools: string[];
  timeCommitment?: string;
}

export interface Member extends BaseEntity {
  profile: MemberProfile;
  status: MemberStatus;
  verificationLevel: VerificationLevel;
  roles: MemberRole[];
  fair: FairBalance;
  impactProfile?: ImpactProfileSummary;
}
