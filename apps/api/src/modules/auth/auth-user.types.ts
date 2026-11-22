import type { AuthUserAccountRole, AuthUserAccountStatus } from "@hu/types";
import type { EmailVerificationStatus } from "@hu/types";

/**
 * Voluntary account deletion. Separate from `status: "disabled"` (administrator suspension).
 * Absent means no open or historical request has been stored.
 */
export type AccountDeletionPhase =
  | "awaiting_confirmation"
  | "pending"
  | "cancelled"
  | "finalized";

export type AccountDeletionFinalNoticeStatus = "sending" | "sent" | "failed" | "skipped";

export interface AccountDeletionRecord {
  requestId: string;
  phase: AccountDeletionPhase;
  requestedAt: string;
  confirmationExpiresAt?: string;
  confirmedAt?: string;
  deadlineAt?: string;
  cancelledAt?: string;
  finalizedAt?: string;
  /** SHA-256 of the normalized email. Written only at finalization. Never the raw address. */
  previousEmailHash?: string;
  scheduledNoticeEmailId?: string;
  finalNoticeStatus?: AccountDeletionFinalNoticeStatus;
  /** Set after the public profile close succeeds, so a restart can retry closure only. */
  profileClosedAt?: string;
  /**
   * One reminder during the last three days. `sent` is terminal.
   * `failed` and a stale `sending` claim may be retried. Cancellation does not clear it.
   */
  reminderStatus?: "sending" | "sent" | "failed";
}

/** Mongo-backed auth user record — never expose outside auth infrastructure. */
export interface AuthUserRecord {
  userId: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: AuthUserAccountRole;
  status: AuthUserAccountStatus;
  memberId: string;
  emailVerificationStatus: EmailVerificationStatus;
  emailVerifiedAt?: string;
  registrationWelcomeEmailSentAt?: string;
  loginEmailTwoStepEnabled?: boolean;
  pendingEmail?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  accountDeletion?: AccountDeletionRecord;
}

export interface RegisterAuthUserInput {
  email: string;
  password: string;
  displayName: string;
  role?: AuthUserAccountRole;
}
