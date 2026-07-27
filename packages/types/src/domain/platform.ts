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
