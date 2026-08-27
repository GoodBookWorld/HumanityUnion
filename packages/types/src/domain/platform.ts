/** Platform deployment mode controlling access and safeguards. */
export type PlatformMode = "development" | "beta" | "production";

export type BetaInviteStatus = "pending" | "used" | "expired" | "revoked";

/** Safe beta invite projection — never includes raw invite codes or hashes. */
export interface BetaInvitePublic {
  inviteId: string;
  email: string;
  status: BetaInviteStatus;
  createdAt: string;
  expiresAt: string;
  /** Auth user id of the actor who created the invite (Admin inventory). */
  createdBy: string;
  usedAt?: string;
  revokedAt?: string;
}

export interface BetaOnboardingItem {
  id: string;
  label: string;
  completed: boolean;
  href: string;
}

export interface WorkspaceReadiness {
  status: "ready" | "missing";
  missing: string[];
}

export interface PlatformConfigPublic {
  platformMode: PlatformMode;
  registrationRequiresInvite: boolean;
  showBetaBanner: boolean;
  betaBannerMessage: string;
}

/**
 * Pack 23E.2 — Admin Platform production-readiness projection.
 * Booleans/enums only — never secrets, URIs with credentials, or raw env values.
 */
export type AdminPlatformServiceConfigState =
  | "configured"
  | "not_configured"
  | "incomplete"
  | "enabled"
  | "disabled"
  | "external";

export type AdminPlatformReadinessLevel = "ready" | "attention" | "missing_configuration";

export type AdminPlatformWarningCode =
  | "production_site_origin_missing"
  | "production_indexing_disabled"
  | "indexing_policy_attention"
  | "email_not_configured"
  | "media_incomplete"
  | "api_public_origin_missing"
  | "cors_origin_missing";

export interface AdminPlatformServiceConfigStatus {
  readonly web: AdminPlatformServiceConfigState;
  readonly api: AdminPlatformServiceConfigState;
  readonly mongodb: AdminPlatformServiceConfigState;
  readonly email: AdminPlatformServiceConfigState;
  readonly media: AdminPlatformServiceConfigState;
  readonly ai: AdminPlatformServiceConfigState;
}

/** Safe Admin-only readiness snapshot from the API process. */
export interface AdminPlatformReadinessPublic {
  readonly platformMode: PlatformMode;
  readonly platformVersion: string;
  readonly registrationRequiresInvite: boolean;
  readonly showBetaBanner: boolean;
  readonly betaBannerMessage: string;
  /** Presence of a public Web/site origin in API-visible env (no URL value). */
  readonly publicSiteOriginConfigured: boolean;
  readonly apiPublicOriginConfigured: boolean;
  readonly corsOriginConfigured: boolean;
  /** Cookie domain/secure flags are deployment-owned; not inspectable as values. */
  readonly cookieSecurityStatus: "external";
  readonly emailPublicUrlConfigured: boolean;
  readonly mediaPublicOriginConfigured: boolean;
  readonly services: AdminPlatformServiceConfigStatus;
}

/**
 * Pack 17C — Official Humanity Union public social destinations (URLs only; no credentials).
 */
export type PlatformSocialNetworkId = "facebook" | "youtube" | "instagram" | "x";

export interface PlatformSocialNetworkDefinition {
  readonly networkId: PlatformSocialNetworkId;
  readonly label: string;
}

export const PLATFORM_SOCIAL_NETWORKS: readonly PlatformSocialNetworkDefinition[] = [
  { networkId: "facebook", label: "Facebook" },
  { networkId: "youtube", label: "YouTube" },
  { networkId: "instagram", label: "Instagram" },
  { networkId: "x", label: "X" },
] as const;

export const PLATFORM_SOCIAL_NETWORK_IDS: readonly PlatformSocialNetworkId[] =
  PLATFORM_SOCIAL_NETWORKS.map((network) => network.networkId);

/** Admin-managed canonical social account row. */
export interface PlatformSocialAccount {
  readonly networkId: PlatformSocialNetworkId;
  readonly label: string;
  /** HTTPS profile URL when configured; null when cleared / not set. */
  readonly url: string | null;
  readonly enabled: boolean;
  readonly updatedAt: string;
  readonly updatedByParticipantId?: string;
}

/** Public footer projection — only enabled networks with a configured URL. */
export interface PlatformSocialAccountPublic {
  readonly networkId: PlatformSocialNetworkId;
  readonly label: string;
  readonly url: string;
}

export interface PlatformSocialAccountListResponse {
  readonly accounts: readonly PlatformSocialAccount[];
}

export interface PlatformSocialAccountPublicListResponse {
  readonly accounts: readonly PlatformSocialAccountPublic[];
}

export interface PlatformSocialAccountUpsertInput {
  readonly url: string | null;
  readonly enabled?: boolean;
}
