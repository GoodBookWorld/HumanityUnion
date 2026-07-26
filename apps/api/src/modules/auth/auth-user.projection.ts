import type { AuthUserPublic } from "@hu/types";

import type { AuthUserRecord } from "./auth-user.types.js";

const INTERNAL_FIELDS = ["passwordHash"] as const;

export function toAuthUserPublic(user: AuthUserRecord): AuthUserPublic {
  return {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    memberId: user.memberId,
    emailVerificationStatus: user.emailVerificationStatus,
    emailVerifiedAt: user.emailVerifiedAt,
    pendingEmail: user.pendingEmail,
    loginEmailTwoStepEnabled: user.loginEmailTwoStepEnabled === true,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export function assertAuthUserRecordIsPrivate(record: Record<string, unknown>): void {
  for (const field of INTERNAL_FIELDS) {
    if (field in record) {
      throw new Error(`Auth projection must not expose ${field}.`);
    }
  }
}
