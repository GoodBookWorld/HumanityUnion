/** Platform deployment mode controlling access and safeguards. */
export type PlatformMode = "development" | "beta" | "production";

export type BetaInviteStatus = "pending" | "used" | "expired";

/** Safe beta invite projection — never includes raw invite codes. */
export interface BetaInvitePublic {
  inviteId: string;
  email: string;
  status: BetaInviteStatus;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
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
