import type { AuthUserAccountRole, AuthUserAccountStatus } from "@hu/types";
import type { EmailVerificationStatus } from "@hu/types";

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
}

export interface RegisterAuthUserInput {
  email: string;
  password: string;
  displayName: string;
  role?: AuthUserAccountRole;
}
