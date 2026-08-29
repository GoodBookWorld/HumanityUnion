export type MigrationClassification =
  | "MUST_MIGRATE"
  | "CONDITIONAL_MIGRATE"
  | "REBUILD_OR_DERIVE"
  | "DO_NOT_MIGRATE"
  | "MUST_PRESERVE"
  | "CONDITIONAL_SANITIZED"
  | "MUST_MIGRATE_IF_PRESENT";

export type AncestryMethod =
  | "root"
  | "direct:initiativeId"
  | "direct:subject.initiativeId"
  | "pk:initiativeId"
  | "parent:decisionId"
  | "parent:trackingId"
  | "parent:impactId"
  | "parent:petitionId"
  | "parent:sessionId"
  | "parent:analysisId"
  | "optional:initiativeId"
  | "participant-scoped"
  | "none"
  | "ambiguous";

export type PreflightVerdict = "PASS" | "FAIL";

export type MediaDestinationAction =
  | "COPY_PUBLIC"
  | "COPY_PRIVATE"
  | "NO_COPY"
  | "ERROR";

export interface CandidateInitiativeRow {
  initiativeId: string;
  present: boolean;
  idEqualsInitiativeId: boolean | null;
  stewardId: string | null;
  title: string | null;
  status: string | null;
  visibilityPolicy: string | null;
  lifecyclePhase: string | null;
  /** As stored — may be null/missing; never invent STANDARD. */
  lifecycleProfile: string | null | undefined;
  createdAt: string | null;
  updatedAt: string | null;
  titleMatch: boolean | null;
  stewardMatch: boolean | null;
  excluded: boolean;
  forbiddenTypo: boolean;
}

export interface CollectionPlanRow {
  collection: string;
  classification: MigrationClassification;
  ancestryMethod: AncestryMethod;
  rowCount: number;
  initiativeIds: string[];
  participantActorFieldsDetected: string[];
  ambiguousAncestryCount: number;
  notes?: string;
}

export interface ParticipantActorHit {
  actorId: string;
  classification:
    | "APPROVED"
    | "SYSTEM_ACTOR"
    | "EXTERNAL_MUST"
    | "EXTERNAL_CONDITIONAL"
    | "UNRESOLVED";
  label: string | null;
  fields: string[];
  collections: string[];
  initiativeIds: string[];
  resolvedMemberId: string | null;
  resolvedUserId: string | null;
  authRole: string | null;
}

export interface ParticipantsReport {
  approved: ParticipantActorHit[];
  systemActors: ParticipantActorHit[];
  externalMust: ParticipantActorHit[];
  externalConditional: ParticipantActorHit[];
  unresolved: ParticipantActorHit[];
}

export interface MembershipPlanRow {
  collection: string;
  classification: MigrationClassification;
  rowCount: number;
  action: string;
  notes: string;
}

export interface MembershipParticipantPlan {
  label: string;
  memberId: string;
  userId: string;
  membershipStatus: string | null;
  applicationStatus: string | null;
  memberNumberPresent: boolean;
  memberGrantedAtPresent: boolean;
  membershipPubliclyVisible: boolean | null;
  migrateMembershipRow: boolean;
  badgeApplicationPresent: boolean;
  badgePaymentStatus: string | null;
  badgeFulfillmentStatus: string | null;
  shippingDataPresent: boolean;
  stripeOperationalFieldsPresent: string[];
}

export interface StripeSanitizationFieldPlan {
  collection: string;
  field: string;
  action: "OMIT_OR_NULL" | "DO_NOT_MIGRATE_RECORD" | "PRESERVE_HU_BUSINESS_STATE";
  reason: string;
}

export interface MediaPlanItem {
  sourceStorageKey: string | null;
  publicPrivate: "public" | "private" | "unknown";
  owningInitiativeId: string | null;
  mediaUploadRecordPresent: boolean;
  sourceUrlHost: string | null;
  hostClassification: "staging_r2" | "production_r2" | "localhost" | "other" | "none";
  destinationAction: MediaDestinationAction;
  urlRewriteRequired: boolean;
  sourceCollection: string;
  recordId: string | null;
  ownerIsSystemMediaRecovery: boolean;
}

export interface ProjectionPlanRow {
  artifact: string;
  classification: MigrationClassification;
  strategy: string;
}

export interface StagingPreflightReport {
  tool: string;
  mode: "read-only";
  sourceDatabase: string;
  candidateInitiatives: CandidateInitiativeRow[];
  initiativeVerdict: PreflightVerdict;
  collectionPlan: CollectionPlanRow[];
  ancestryVerdict: PreflightVerdict;
  participants: ParticipantsReport;
  participantVerdict: PreflightVerdict;
  membershipPlan: {
    collections: MembershipPlanRow[];
    participants: MembershipParticipantPlan[];
  };
  stripeSanitizationPlan: StripeSanitizationFieldPlan[];
  mediaPlan: {
    items: MediaPlanItem[];
    summary: {
      copyPublic: number;
      copyPrivate: number;
      noCopy: number;
      error: number;
      rewriteRequired: number;
    };
  };
  projectionPlan: ProjectionPlanRow[];
  blockers: string[];
  overallVerdict: PreflightVerdict;
  /** Explicit: Task 07.1 has no write path. */
  writePathPresent: false;
}

export interface ProductionCollisionPreflightReport {
  tool: string;
  mode: "read-only";
  database: string;
  initiativeCollisions: Array<{ initiativeId: string; present: boolean }>;
  childCollisions: Array<{
    collection: string;
    collidingIds: string[];
    count: number;
  }>;
  identityChecks: Array<{
    label: string;
    memberId: string;
    present: boolean;
    authRole: string | null;
    expectedAuthRole: string;
    rolesOk: boolean;
  }>;
  membershipCollisions: Array<{
    userId: string;
    label: string;
    present: boolean;
    status: string | null;
  }>;
  memberNumberCollisions: Array<{
    memberNumber: string;
    present: boolean;
  }>;
  badgeOrderCollisions: Array<{
    applicationId: string;
    present: boolean;
  }>;
  blockers: string[];
  collisionVerdict: PreflightVerdict;
  writePathPresent: false;
}
