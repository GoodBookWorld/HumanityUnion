import type { BetaInviteStatus } from "@hu/types";

/** Mongo-backed beta invite record — never expose raw codes outside issuance. */
export interface BetaInviteRecord {
  inviteId: string;
  email: string;
  codeHash: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  revokedAt?: string;
  status: BetaInviteStatus;
}

export interface CreateBetaInviteInput {
  email: string;
  createdBy: string;
  expiresAt: string;
}

export interface IssuedBetaInvite {
  invite: BetaInviteRecord;
  code: string;
}
