/**
 * Admin Foundation Pack 02 — Canonical capability & audit types.
 *
 * Does not introduce a second Participant identity.
 * BlogCapability grants remain authoritative for Blog until migration completes.
 */

/** Canonical capability identifiers (dotted). */
export type PlatformCapabilityId =
  | "blog.author"
  | "blog.trusted_author"
  | "blog.review"
  | "blog.publish"
  | "blog.comment.moderate"
  | "blog.author_application.review"
  | "blog.capability.manage"
  | "media.review"
  | "membership.review"
  | "safety.review"
  | "platform.audit.read"
  | "platform.capability.manage"
  | "platform.settings.manage"
  | "platform.admin"
  | "platform.ops.health.read"
  | "beta.invite.manage"
  | "institution.moderate";

export const PLATFORM_CAPABILITY_IDS: readonly PlatformCapabilityId[] = [
  "blog.author",
  "blog.trusted_author",
  "blog.review",
  "blog.publish",
  "blog.comment.moderate",
  "blog.author_application.review",
  "blog.capability.manage",
  "media.review",
  "membership.review",
  "safety.review",
  "platform.audit.read",
  "platform.capability.manage",
  "platform.settings.manage",
  "platform.admin",
  "platform.ops.health.read",
  "beta.invite.manage",
  "institution.moderate",
] as const;

export type CapabilityScopeType =
  | "global"
  | "blog"
  | "initiative"
  | "institution"
  | "surface";

export interface CapabilityScope {
  readonly scopeType: CapabilityScopeType;
  /** Required when scopeType is not global (except blog default). */
  readonly scopeId?: string;
}

/** Generalized platform capability grant (dual-read alongside blog_capability_grants). */
export type PlatformCapabilityGrantSource =
  | "application"
  | "admin_console"
  | "bootstrap"
  | "migration"
  | "role_compat"
  | "system";

export interface PlatformCapabilityGrant {
  readonly grantId: string;
  readonly participantId: string;
  readonly capability: PlatformCapabilityId;
  readonly scopeType: CapabilityScopeType;
  readonly scopeId?: string;
  readonly grantedByParticipantId: string;
  readonly grantedAt: string;
  readonly expiresAt?: string;
  readonly revokedAt?: string;
  readonly revokedByParticipantId?: string;
  readonly reason?: string;
  readonly source: PlatformCapabilityGrantSource;
}

/** Ownership is separate from administrative capabilities. */
export type OwnershipRelation =
  | "blog_post_author"
  | "initiative_steward"
  | "self_profile"
  | "self_resource";

export interface OwnershipCheck {
  readonly relation: OwnershipRelation;
  readonly actorParticipantId: string;
  readonly ownerParticipantId: string;
}

/** Append-only administration audit record. */
export type AdministrationAuditAction =
  | "capability.grant"
  | "capability.revoke"
  | "blog.author_application.decide"
  | "blog.author_application.submit"
  | "blog.author_application.reconcile"
  | "blog.author_application.recovery_reset"
  | "blog.publication_review.reconcile"
  | "blog.publish"
  | "blog.publish_after_safety_review"
  | "blog.archive"
  | "blog.update_published"
  | "blog.published_correction_started"
  | "blog.comment.moderate"
  | "author.block"
  | "author.unblock"
  | "publication.block"
  | "publication.unblock"
  | "safety.override"
  | "administration.bootstrap"
  | "initiative.visibility.hide"
  | "initiative.visibility.restore"
  | "initiative.administrative.block"
  | "initiative.administrative.unblock"
  | "public_choice.candidate.block"
  | "public_choice.candidate.unblock"
  | "editor.moderation.block"
  | "editor.moderation.unblock"
  | "media_resource.create"
  | "media_resource.update"
  | "media_resource.activate"
  | "media_resource.deactivate"
  | "media_resource.delete"
  | "blog.category.create"
  | "blog.category.update"
  | "blog.category.activate"
  | "blog.category.deactivate"
  | "blog.category.delete"
  | "blog.author.trusted_publishing.enable"
  | "blog.author.trusted_publishing.disable"
  | "country_affiliation.create"
  | "country_affiliation.update"
  | "country_affiliation.activate"
  | "country_affiliation.deactivate"
  | "country_affiliation.delete"
  | "editor.assign"
  | "editor.update_permissions"
  | "editor.update_scope"
  | "editor.activate"
  | "editor.deactivate";

export interface AdministrationAuditRecord {
  readonly auditId: string;
  readonly actorParticipantId: string;
  readonly action: AdministrationAuditAction;
  readonly targetType: string;
  readonly targetId: string;
  readonly scope: CapabilityScope;
  readonly reason?: string;
  readonly beforeSummary?: string;
  readonly afterSummary?: string;
  readonly createdAt: string;
  readonly correlationId?: string;
}

export interface AdministrationAuditAppendInput {
  readonly actorParticipantId: string;
  readonly action: AdministrationAuditAction;
  readonly targetType: string;
  readonly targetId: string;
  readonly scope?: CapabilityScope;
  readonly reason?: string;
  readonly beforeSummary?: string;
  readonly afterSummary?: string;
  readonly correlationId?: string;
}

/** Admin Panel Pack 03 — safe Participant directory row (never includes secrets). */
export interface AdminParticipantDirectoryItem {
  readonly userId: string;
  readonly memberId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: "member" | "admin";
  readonly status: "active" | "disabled";
  readonly emailVerificationStatus: string;
  readonly createdAt: string;
  readonly lastLoginAt?: string;
  readonly uniqueName?: string;
  readonly memberRecordStatus?: string;
  readonly verificationLevel?: string;
  readonly publicName?: string;
  readonly profileDisplayName?: string;
  readonly avatarUrl?: string;
  readonly membership?: {
    readonly cohortLabel: "Participant" | "Member";
    readonly status: string;
    readonly applicationStatus: string;
    readonly memberNumber: string | null;
  };
}

export interface AdminParticipantDirectoryResponse {
  readonly participants: readonly AdminParticipantDirectoryItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

/** Admin Panel Pack 05 — safe Initiative directory row. */
export interface AdminInitiativeDirectoryItem {
  readonly initiativeId: string;
  readonly title: string;
  readonly stewardId: string;
  readonly stewardDisplayName: string;
  readonly stewardUniqueName?: string;
  readonly lifecyclePhase: string;
  readonly status: string;
  readonly visibility: "steward_only" | "public";
  readonly geography: {
    readonly region: string;
    readonly countrySlug?: string;
    readonly regionSlug?: string;
    readonly communitySlug?: string;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publiclyProjected: boolean;
  readonly proposalCount: number;
  readonly decisionSummary: string | null;
  readonly civicArchiveState: "none" | "present";
  readonly integrityStatus: "ok" | "warning";
  /** Fix 08C / Pack 12C — soft-block with ADMIN|EDITOR provenance. */
  readonly administrativelyBlocked: boolean;
  readonly blockAuthority?: "ADMIN" | "EDITOR" | null;
  readonly blockLabel?: string | null;
}

export interface AdminInitiativeDirectoryAggregates {
  readonly total: number;
  readonly public: number;
  readonly nonPublic: number;
  readonly activeLifecycle: number;
  readonly archived: number;
  readonly proposals: number;
}

export interface AdminInitiativeDirectoryResponse {
  readonly initiatives: readonly AdminInitiativeDirectoryItem[];
  readonly aggregates: AdminInitiativeDirectoryAggregates;
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

export type AdminInitiativeLifecycleStageId =
  | "initiative"
  | "discussion"
  | "collaborative_analysis"
  | "improvement_proposals"
  | "revision"
  | "petition"
  | "decision_session"
  | "collective_decision"
  | "implementation_commitments"
  | "implementation_tracking"
  | "official_responses"
  | "public_impact"
  | "civic_archive";

export type AdminInitiativeLifecycleStageState =
  | "present"
  | "current"
  | "not_reached";

export interface AdminInitiativeLifecycleStage {
  readonly stageId: AdminInitiativeLifecycleStageId;
  readonly label: string;
  readonly state: AdminInitiativeLifecycleStageState;
  readonly evidence: string;
}

export interface AdminInitiativeIntegrityFinding {
  readonly code: string;
  readonly severity: "info" | "warning";
  readonly message: string;
}

export interface AdminInitiativeCivicRelationships {
  readonly proposalCount: number;
  readonly analysisCount: number;
  readonly revisionCount: number;
  readonly petitionStatus: string | null;
  readonly decisionSessionCount: number;
  readonly collectiveDecisionSummary: string | null;
  readonly commitmentCount: number;
  readonly trackingCount: number;
  readonly officialResponseCount: number;
  readonly publicImpactCount: number;
  readonly civicArchiveCount: number;
}

export interface AdminInitiativeDetail {
  readonly initiativeId: string;
  readonly title: string;
  readonly descriptionPreview: string;
  readonly stewardId: string;
  readonly stewardDisplayName: string;
  readonly stewardUniqueName?: string;
  readonly geography: AdminInitiativeDirectoryItem["geography"];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lifecyclePhase: string;
  readonly status: string;
  readonly visibility: "steward_only" | "public";
  readonly publiclyProjected: boolean;
  readonly publicUrl: string | null;
  readonly lifecycleStages: readonly AdminInitiativeLifecycleStage[];
  readonly relationships: AdminInitiativeCivicRelationships;
  readonly integrity: readonly AdminInitiativeIntegrityFinding[];
  /** Explicit admin visibility moderation availability. */
  readonly adminActions: {
    readonly canHideFromPublic: boolean;
    readonly canRestorePublicVisibility: boolean;
    readonly canBlock: boolean;
    readonly canUnblock: boolean;
  };
  /** Fix 08C — soft-block. */
  readonly administrativelyBlocked: boolean;
  readonly blockAuthority?: "ADMIN" | "EDITOR" | null;
  readonly blockLabel?: string | null;
}

export interface AdminInitiativeVisibilityCommandResult {
  readonly initiativeId: string;
  readonly visibility: "steward_only" | "public";
  readonly publiclyProjected: boolean;
  readonly auditId: string;
}

export interface AdminInitiativeBlockCommandResult {
  readonly initiativeId: string;
  readonly administrativelyBlocked: boolean;
  readonly auditId: string;
}

/** Fix 08C — Admin Public Choice election directory row. */
export interface AdminPublicChoiceDirectoryItem {
  readonly initiativeId: string;
  readonly electionTitle: string;
  readonly countrySlug?: string;
  readonly stewardId: string;
  readonly stewardDisplayName: string;
  readonly stewardUniqueName?: string;
  readonly votingStatus: string;
  readonly openedAt?: string;
  readonly closesAt?: string;
  readonly closedAt?: string;
  readonly candidateCount: number;
  readonly effectiveVoterCount: number | null;
  readonly administrativelyBlocked: boolean;
  readonly blockAuthority?: "ADMIN" | "EDITOR" | null;
  readonly blockLabel?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdminPublicChoiceDirectoryResponse {
  readonly elections: readonly AdminPublicChoiceDirectoryItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

export interface AdminPublicChoiceCandidateRow {
  readonly candidateId: string;
  readonly name: string;
  readonly photoUrl?: string;
  readonly campaignPageUrl?: string;
  readonly voteCount: number;
  readonly isBlocked: boolean;
  readonly blockAuthority?: "ADMIN" | "EDITOR" | null;
  readonly blockLabel?: string | null;
  readonly sortOrder: number;
}

export interface AdminPublicChoiceDetail {
  readonly initiativeId: string;
  readonly electionTitle: string;
  readonly descriptionPreview: string;
  readonly stewardId: string;
  readonly stewardDisplayName: string;
  readonly stewardUniqueName?: string;
  readonly countrySlug?: string;
  readonly votingStatus: string;
  readonly openedAt?: string;
  readonly closesAt?: string;
  readonly closedAt?: string;
  readonly decisionId: string | null;
  readonly candidateCount: number;
  readonly effectiveVoterCount: number | null;
  readonly administrativelyBlocked: boolean;
  readonly blockAuthority?: "ADMIN" | "EDITOR" | null;
  readonly blockLabel?: string | null;
  readonly publicUrl: string;
  readonly candidates: readonly AdminPublicChoiceCandidateRow[];
  readonly resultSummary: {
    readonly ballotMode: string;
    readonly totalEffectiveVoters: number | null;
  };
}
