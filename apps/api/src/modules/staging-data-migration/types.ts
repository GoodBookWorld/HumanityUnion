export type MigrationAction = "create" | "skip_existing" | "transform" | "conflict";

export interface SafeAuthShell {
  userId: string;
  memberId: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  emailVerificationStatus: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SafeMemberRecord {
  memberId: string;
  identityId?: string;
  uniqueName?: string | null;
  status?: string | null;
  createdAt?: string | null;
}

export interface SafeProfileRecord {
  profileId: string;
  userId: string;
  displayName?: string | null;
  publicName?: string | null;
  status?: string | null;
}

export interface SafeMembershipRecord {
  membershipId?: string;
  memberId: string;
  [key: string]: unknown;
}

export interface InitiativeRecord {
  initiativeId: string;
  title: string;
  stewardId: string;
  lifecyclePhase?: string;
  status?: string;
  visibility?: unknown;
  metadata?: unknown;
  createdAt?: string;
  updatedAt?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ParticipantPlanItem {
  key: string;
  memberId: string;
  userId: string | null;
  displayName: string;
  emailMasked: string | null;
  classification: string;
  action: MigrationAction;
  reason: string;
  authAction: MigrationAction;
  memberAction: MigrationAction;
  profileAction: MigrationAction;
  membershipAction: MigrationAction | "none";
}

export interface InitiativePlanItem {
  initiativeId: string;
  title: string;
  stewardMemberId: string;
  action: MigrationAction;
  reason: string;
  related: {
    analyses: number;
    proposals: number;
    revisions: number;
    petitionDrafts: number;
  };
}

export interface MigrationPlan {
  mode: "dry-run" | "execute";
  sourceDatabase: string;
  targetDatabase: string;
  fileRuntimePath: string;
  stagingAdmin: {
    protected: boolean;
    userId: string | null;
    memberId: string | null;
    emailMasked: string | null;
    role: string | null;
  };
  participants: ParticipantPlanItem[];
  initiatives: InitiativePlanItem[];
  relatedArtifacts: {
    analyses: number;
    proposals: number;
    revisions: number;
    petitionDrafts: number;
  };
  excludedLegacy: {
    activities: boolean;
    discussions: boolean;
    proposals: boolean;
    decisions: boolean;
  };
  expectedTargetCounts: {
    participantsApprox: number;
    historicalInitiatives: number;
    bootstrapInitiativeRetained: boolean;
  };
  conflicts: string[];
  integrityIssues: string[];
  bootstrapInitiative: {
    initiativeId: string;
    recommendation: string;
  };
}

export interface MigrationWriteSummary {
  mode: "execute";
  written: {
    authUsers: number;
    members: number;
    profiles: number;
    memberships: number;
    initiatives: number;
    analyses: number;
    proposals: number;
    revisions: number;
    petitionDrafts: number;
  };
  skipped: {
    authUsers: number;
    members: number;
    profiles: number;
    memberships: number;
    initiatives: number;
    analyses: number;
    proposals: number;
    revisions: number;
    petitionDrafts: number;
  };
  stagingAdminUnchanged: boolean;
  confirmation: string;
}
