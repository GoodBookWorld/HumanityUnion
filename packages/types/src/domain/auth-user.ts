import type { MemberId } from "./member.js";
import type { AuthRole } from "./auth.js";
import type { EmailVerificationStatus } from "./email.js";
import type { EditorViewerState } from "./editor-grant.js";

/** Mongo-backed auth account status. */
export type AuthUserAccountStatus = "active" | "disabled";

/** Auth account role stored on the user record (maps to AuthRole). */
export type AuthUserAccountRole = Extract<AuthRole, "member" | "admin">;

/** Safe auth user projection — never includes password or session secrets. */
export interface AuthUserPublic {
  userId: string;
  email: string;
  displayName: string;
  role: AuthUserAccountRole;
  status: AuthUserAccountStatus;
  memberId: MemberId;
  emailVerificationStatus: EmailVerificationStatus;
  emailVerifiedAt?: string;
  pendingEmail?: string;
  loginEmailTwoStepEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  /**
   * Pack 12A — delegated Editor grant projection (not an account role).
   * Absent on older clients; treat missing as non-editor.
   */
  editor?: EditorViewerState;
}

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}
