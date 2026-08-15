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
  | "blog.publish"
  | "blog.publish_after_safety_review"
  | "blog.archive"
  | "blog.comment.moderate"
  | "safety.override"
  | "administration.bootstrap";

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
