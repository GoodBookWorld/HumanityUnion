import { randomUUID } from "node:crypto";

import type { AuthIdentity, AuthTokenPair, AuthUserPublic } from "@hu/types";
import {
  assertRegistrationInviteProvided,
  validateAndConsumeBetaInvite,
} from "../beta-invite/beta-invite.service.js";
import {
  BetaInviteNotFoundError,
  BetaInviteRequiredError,
} from "../beta-invite/beta-invite.errors.js";
import { createMemberProfileForUser } from "../member-profile/member-profile.service.js";
import { resolveEmailConfig } from "../email/email.config.js";
import { sendLoginNotificationEmail } from "../email/email.service.js";
import { isRegistrationInviteRequired } from "../../config/platform.config.js";
import {
  buildRegistrationPendingConfirmationResultAsync,
  queueRegistrationConfirmationCode,
  confirmRegistrationEmailCode,
} from "./auth-email-confirmation.service.js";
import type { RegistrationPendingConfirmationResult } from "./auth-email-confirmation.service.js";
import {
  buildLoginTwoStepRequiredResult,
  queueLoginTwoStepCode,
  type LoginTwoStepRequiredResult,
} from "./auth-login-two-step.service.js";
import { getLastIssuedConfirmationCodeForTests } from "../email/email-confirmation-code.repository.js";
import { issueAuthSession, type AuthSessionResult } from "./auth-session.issue.js";
import {
  DuplicateEmailError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  UserDisabledError,
  AuthValidationError,
  RegistrationUnavailableError,
} from "./auth.errors.js";
import {
  findAuthSessionById,
  isAuthSessionActive,
  refreshTokenMatchesSession,
  revokeAllAuthSessionsForUser,
  revokeAuthSession,
  rotateAuthSessionRefreshToken,
} from "./auth-session.repository.js";
import { toAuthUserPublic } from "./auth-user.projection.js";
import {
  findAuthUserByEmail,
  findAuthUserById,
  insertAuthUser,
  updateAuthUserLastLogin,
} from "./auth-user.repository.js";
import type { AuthUserRecord } from "./auth-user.types.js";
import { verifyPassword } from "./auth-password.js";
import {
  createAccessToken,
  createRefreshToken,
  resolveAccessExpiresInLabel,
  verifyRefreshToken,
} from "./auth-tokens.js";

export type { AuthSessionResult, AuthLoginResult } from "./auth-session.issue.js";
export { issueAuthSession } from "./auth-session.issue.js";

export interface AuthRegisterResult {
  kind: "email_confirmation_required";
  confirmation: RegistrationPendingConfirmationResult;
}

export interface LoginTwoStepRequiredResponse {
  kind: "login_two_step_required";
  challenge: LoginTwoStepRequiredResult;
}

export type AuthLoginResponse =
  AuthSessionResult | AuthRegisterResult | LoginTwoStepRequiredResponse;

export function isLoginTwoStepRequiredResponse(
  result: AuthLoginResponse,
): result is LoginTwoStepRequiredResponse {
  return result.kind === "login_two_step_required";
}

export type AuthRegisterResponse = AuthSessionResult | AuthRegisterResult;

export function isEmailConfirmationRequiredResponse(
  result: AuthRegisterResponse | AuthLoginResponse,
): result is AuthRegisterResult {
  return result.kind === "email_confirmation_required";
}

function validateRegistrationInput(email: string, password: string, displayName: string): void {
  if (!email.trim() || !email.includes("@")) {
    throw new AuthValidationError("A valid email address is required.");
  }

  if (password.length < 8) {
    throw new AuthValidationError("Password must be at least 8 characters.");
  }

  if (!displayName.trim()) {
    throw new AuthValidationError("Display name is required.");
  }
}

function buildTokenPair(user: AuthUserRecord, sessionId: string): AuthTokenPair {
  const accessToken = createAccessToken({
    sub: user.userId,
    memberId: user.memberId,
    role: user.role,
    displayName: user.displayName,
    email: user.email,
  });

  const refreshToken = createRefreshToken({
    sub: user.userId,
    sessionId,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: resolveAccessExpiresInLabel(),
  };
}

async function issueAuthSessionInternal(
  user: AuthUserRecord,
  userAgent?: string,
): Promise<AuthSessionResult> {
  return issueAuthSession(user, userAgent);
}

export async function registerAuthUser(input: {
  email: string;
  password: string;
  displayName: string;
  inviteCode?: string;
}): Promise<AuthRegisterResponse> {
  validateRegistrationInput(input.email, input.password, input.displayName);

  if (isRegistrationInviteRequired()) {
    try {
      assertRegistrationInviteProvided(input.inviteCode);
      await validateAndConsumeBetaInvite({
        email: input.email,
        inviteCode: input.inviteCode,
      });
    } catch (error) {
      if (error instanceof BetaInviteNotFoundError || error instanceof BetaInviteRequiredError) {
        throw new RegistrationUnavailableError();
      }

      throw error;
    }
  }

  const existing = await findAuthUserByEmail(input.email);

  if (existing) {
    throw new DuplicateEmailError();
  }

  const memberId = randomUUID();

  let user: AuthUserRecord;

  try {
    user = await insertAuthUser(input, memberId);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      throw new DuplicateEmailError();
    }

    throw error;
  }

  await createMemberProfileForUser({
    userId: user.userId,
    displayName: input.displayName,
    language: "en",
  });

  const delivery = await queueRegistrationConfirmationCode(user.userId);
  const confirmation = await buildRegistrationPendingConfirmationResultAsync(user, delivery);

  return {
    kind: "email_confirmation_required",
    confirmation,
  };
}

/** Registers a user and confirms email — intended for verification scripts and legacy test helpers. */
export async function registerAndConfirmAuthUser(input: {
  email: string;
  password: string;
  displayName: string;
  inviteCode?: string;
}): Promise<AuthSessionResult> {
  const result = await registerAuthUser(input);

  if (!isEmailConfirmationRequiredResponse(result)) {
    return result;
  }

  const user = await findAuthUserByEmail(input.email);

  if (!user) {
    throw new AuthValidationError("Registered user not found.");
  }

  const code = getLastIssuedConfirmationCodeForTests(user.userId);

  if (!code) {
    throw new AuthValidationError("Confirmation code was not issued.");
  }

  return confirmRegistrationEmailCode({
    userId: user.userId,
    code,
  });
}

export async function loginAuthUser(input: {
  email: string;
  password: string;
  userAgent?: string;
  ipKey?: string;
}): Promise<AuthLoginResponse> {
  const user = await findAuthUserByEmail(input.email);

  if (!user) {
    throw new InvalidCredentialsError();
  }

  if (user.status === "disabled") {
    throw new UserDisabledError();
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash);

  if (!passwordValid) {
    throw new InvalidCredentialsError();
  }

  if (user.emailVerificationStatus !== "verified") {
    const now = new Date().toISOString();
    await updateAuthUserLastLogin(user.userId, now);

    const loggedInUser = { ...user, lastLoginAt: now, updatedAt: now };

    const delivery = await queueRegistrationConfirmationCode(loggedInUser.userId);
    const confirmation = await buildRegistrationPendingConfirmationResultAsync(
      loggedInUser,
      delivery,
    );

    return {
      kind: "email_confirmation_required",
      confirmation,
    };
  }

  if (user.loginEmailTwoStepEnabled) {
    const delivery = await queueLoginTwoStepCode(user.userId, input.ipKey);
    const challenge = await buildLoginTwoStepRequiredResult(user, delivery);

    return {
      kind: "login_two_step_required",
      challenge,
    };
  }

  const now = new Date().toISOString();
  await updateAuthUserLastLogin(user.userId, now);

  const loggedInUser = { ...user, lastLoginAt: now, updatedAt: now };
  const config = resolveEmailConfig();

  if (config.sendLoginNotifications) {
    void sendLoginNotificationEmail({
      to: loggedInUser.email,
      displayName: loggedInUser.displayName,
      loginTime: now,
      userAgent: input.userAgent,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "Login notification email failed.";
      console.error(`[auth:email] ${message}`);
    });
  }

  return issueAuthSessionInternal(loggedInUser, input.userAgent);
}

export async function refreshAuthSession(refreshToken: string): Promise<AuthSessionResult> {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new InvalidRefreshTokenError();
  }

  const session = await findAuthSessionById(payload.sessionId);

  if (!session || !isAuthSessionActive(session)) {
    throw new InvalidRefreshTokenError();
  }

  if (!refreshTokenMatchesSession(refreshToken, session)) {
    throw new InvalidRefreshTokenError();
  }

  const user = await findAuthUserById(payload.sub);

  if (!user || user.status === "disabled") {
    throw new InvalidRefreshTokenError();
  }

  if (user.emailVerificationStatus !== "verified") {
    throw new InvalidRefreshTokenError();
  }

  const now = new Date().toISOString();
  const tokens = buildTokenPair(user, session.sessionId);

  await rotateAuthSessionRefreshToken({
    sessionId: session.sessionId,
    refreshToken: tokens.refreshToken,
    lastUsedAt: now,
  });

  return {
    kind: "session",
    user: toAuthUserPublic(user),
    tokens,
  };
}

export async function revokeAllAuthSessionsExceptCurrent(
  userId: string,
  currentSessionId?: string,
): Promise<{ revokedCount: number }> {
  const revokedCount = await revokeAllAuthSessionsForUser(userId, currentSessionId);
  return { revokedCount };
}

export async function logoutAuthSession(refreshToken: string): Promise<void> {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new InvalidRefreshTokenError();
  }

  const session = await findAuthSessionById(payload.sessionId);

  if (!session) {
    throw new InvalidRefreshTokenError();
  }

  if (!refreshTokenMatchesSession(refreshToken, session)) {
    throw new InvalidRefreshTokenError();
  }

  await revokeAuthSession(session.sessionId, new Date().toISOString());
}

export async function getAuthUserPublicById(userId: string): Promise<AuthUserPublic | null> {
  const user = await findAuthUserById(userId);

  if (!user) {
    return null;
  }

  return toAuthUserPublic(user);
}

export function authIdentityFromAccessTokenClaims(claims: {
  sub: string;
  memberId: string;
  role: AuthUserRecord["role"];
  displayName: string;
  email: string;
}): AuthIdentity {
  const now = new Date().toISOString();

  return {
    id: claims.sub,
    email: claims.email,
    provider: "email",
    status: "active",
    roles: [claims.role],
    memberId: claims.memberId,
    createdAt: now,
    updatedAt: now,
  };
}

export function toAuthIdentity(user: AuthUserRecord): AuthIdentity {
  return {
    id: user.userId,
    email: user.email,
    provider: "email",
    status: user.status === "disabled" ? "disabled" : "active",
    roles: [user.role],
    memberId: user.memberId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
