import type { AuthTokenPair, AuthUserPublic } from "@hu/types";

import { apiRequest } from "../../lib/api-client";
import { clearPwaAppBadge } from "../pwa/pwa-app-badge";
import { stopPwaLaunchAudio } from "../pwa/pwa-launch-audio";
import { dispatchAuthStateChanged } from "./auth-events";
import { refreshAuthSessionOnce, resetAuthRefreshState } from "./auth-token-refresh";
import {
  buildPendingConfirmationHeaders,
  clearPendingConfirmationContext,
  storePendingConfirmationContext,
} from "./auth-pending-confirmation-store";
import {
  buildPendingLoginTwoStepHeaders,
  clearPendingLoginTwoStepToken,
  storePendingLoginTwoStepToken,
} from "./auth-pending-login-two-step-store";
import {
  clearLegacyAuthTokenStorage,
  clearStoredAuthTokens,
  storeAuthTokens,
} from "./auth-token-store";

export interface AuthSessionProbe {
  authenticated: boolean;
  user: AuthUserPublic | null;
  authSource?: string;
}

function acceptBrowserSession(): void {
  // Pack 07 — cookies already set by Set-Cookie; never persist JSON tokens.
  storeAuthTokens();
  clearLegacyAuthTokenStorage();
  // Auth Recovery Hotfix — prior failed refresh must not poison login.
  resetAuthRefreshState();
  dispatchAuthStateChanged();
}

export interface AuthSessionPayload {
  user: AuthUserPublic;
  tokens: AuthTokenPair;
}

export interface EmailConfirmationRequiredPayload {
  emailConfirmationRequired: true;
  emailSent: boolean;
  maskedEmail: string;
  resendAvailableAt: string | null;
  pendingConfirmationToken: string;
  emailDeliveryError?: string;
}

export interface EmailConfirmationStatusPayload {
  status: "pending" | "confirmed" | "expired";
  emailSent: boolean;
  maskedEmail: string;
  resendAvailableAt: string | null;
  attemptsRemaining: number | null;
  emailDeliveryError?: string;
}

export interface LoginTwoStepRequiredPayload {
  authenticationComplete: false;
  twoStepRequired: true;
  emailSent: boolean;
  maskedEmail: string;
  resendAvailableAt: string | null;
  challengeToken: string;
  emailDeliveryError?: string;
}

export interface AuthSessionCompletePayload extends AuthSessionPayload {
  authenticationComplete?: true;
}

export type LoginResult =
  AuthSessionCompletePayload | EmailConfirmationRequiredPayload | LoginTwoStepRequiredPayload;

function isLoginTwoStepRequired(payload: LoginResult): payload is LoginTwoStepRequiredPayload {
  return "twoStepRequired" in payload && payload.twoStepRequired === true;
}

export type RegisterResult = AuthSessionPayload | EmailConfirmationRequiredPayload;

function isEmailConfirmationRequired(
  payload: RegisterResult | LoginResult,
): payload is EmailConfirmationRequiredPayload {
  return "emailConfirmationRequired" in payload && payload.emailConfirmationRequired === true;
}

export async function register(input: {
  email: string;
  displayName: string;
  password: string;
  inviteCode?: string;
}): Promise<RegisterResult> {
  const result = await apiRequest<RegisterResult>("/api/v1/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });

  if (isEmailConfirmationRequired(result)) {
    storePendingConfirmationContext({
      pendingConfirmationToken: result.pendingConfirmationToken,
      maskedEmail: result.maskedEmail,
    });
    return result;
  }

  acceptBrowserSession();
  return result;
}

export async function login(input: { email: string; password: string }): Promise<LoginResult> {
  const result = await apiRequest<LoginResult>("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });

  if (isEmailConfirmationRequired(result)) {
    storePendingConfirmationContext({
      pendingConfirmationToken: result.pendingConfirmationToken,
      maskedEmail: result.maskedEmail,
    });
    return result;
  }

  if (isLoginTwoStepRequired(result)) {
    storePendingLoginTwoStepToken(result.challengeToken);
    return result;
  }

  acceptBrowserSession();
  return result;
}

export async function refresh(): Promise<AuthSessionPayload> {
  const refreshed = await refreshAuthSessionOnce();

  if (!refreshed) {
    throw new Error("Authentication is required.");
  }

  const user = await getMe();

  return {
    user,
    tokens: {
      accessToken: "",
      refreshToken: "",
      expiresIn: "15m",
    },
  };
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<{ loggedOut: boolean }>("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Logout request did not complete successfully.", error);
    }
  } finally {
    clearStoredAuthTokens();
    clearPendingConfirmationContext();
    clearPendingLoginTwoStepToken();
    // Auth Recovery Hotfix — allow a later login after guest settle.
    resetAuthRefreshState();
    // Pack 22B.1 — never leave a previous account's OS app badge after logout.
    void clearPwaAppBadge();
    // Pack 22I.1 — stop branded intro if logout tears down the session mid-play.
    stopPwaLaunchAudio();
    dispatchAuthStateChanged();
  }
}

export async function getMe(): Promise<AuthUserPublic> {
  return apiRequest<AuthUserPublic>("/api/v1/auth/me");
}

/** Pack 07 — bounded session probe (no JWT in response). */
export async function fetchAuthSession(): Promise<AuthSessionProbe> {
  return apiRequest<AuthSessionProbe>("/api/v1/auth/session");
}

export async function verifyEmail(token: string): Promise<AuthUserPublic> {
  const result = await apiRequest<{ user: AuthUserPublic }>(
    `/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`,
  );

  return result.user;
}

export async function resendVerificationEmail(): Promise<AuthUserPublic> {
  const result = await apiRequest<{ user: AuthUserPublic }>("/api/v1/auth/resend-verification", {
    method: "POST",
    credentials: "include",
  });

  return result.user;
}

export async function getEmailConfirmationStatus(): Promise<EmailConfirmationStatusPayload> {
  return apiRequest<EmailConfirmationStatusPayload>("/api/v1/auth/email-confirmation/status", {
    headers: buildPendingConfirmationHeaders(),
    credentials: "include",
  });
}

export async function confirmEmailCode(code: string): Promise<AuthSessionPayload> {
  const result = await apiRequest<AuthSessionPayload>("/api/v1/auth/email-confirmation/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildPendingConfirmationHeaders(),
    },
    credentials: "include",
    body: JSON.stringify({ code }),
  });

  clearPendingConfirmationContext();
  acceptBrowserSession();
  return result;
}

export async function resendEmailConfirmationCode(): Promise<EmailConfirmationStatusPayload> {
  return apiRequest<EmailConfirmationStatusPayload>("/api/v1/auth/email-confirmation/resend", {
    method: "POST",
    headers: buildPendingConfirmationHeaders(),
    credentials: "include",
  });
}

export async function cancelEmailConfirmation(): Promise<void> {
  await apiRequest<{ cancelled: boolean }>("/api/v1/auth/email-confirmation/cancel", {
    method: "POST",
    headers: buildPendingConfirmationHeaders(),
    credentials: "include",
  });
  clearPendingConfirmationContext();
}

export interface LoginTwoStepStatusPayload {
  status: "pending" | "expired";
  emailSent: boolean;
  maskedEmail: string;
  resendAvailableAt: string | null;
  attemptsRemaining: number | null;
  emailDeliveryError?: string;
}

export async function getLoginTwoStepStatus(): Promise<LoginTwoStepStatusPayload> {
  return apiRequest<LoginTwoStepStatusPayload>("/api/v1/auth/login/two-step/status", {
    headers: buildPendingLoginTwoStepHeaders(),
    credentials: "include",
  });
}

export async function confirmLoginTwoStepCode(code: string): Promise<AuthSessionPayload> {
  const result = await apiRequest<AuthSessionCompletePayload>(
    "/api/v1/auth/login/two-step/confirm",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildPendingLoginTwoStepHeaders(),
      },
      credentials: "include",
      body: JSON.stringify({ code }),
    },
  );

  clearPendingLoginTwoStepToken();
  acceptBrowserSession();
  return result;
}

export async function resendLoginTwoStepCode(): Promise<LoginTwoStepStatusPayload> {
  return apiRequest<LoginTwoStepStatusPayload>("/api/v1/auth/login/two-step/resend", {
    method: "POST",
    headers: buildPendingLoginTwoStepHeaders(),
    credentials: "include",
  });
}

export async function cancelLoginTwoStep(): Promise<void> {
  await apiRequest<{ cancelled: boolean }>("/api/v1/auth/login/two-step/cancel", {
    method: "POST",
    headers: buildPendingLoginTwoStepHeaders(),
    credentials: "include",
  });
  clearPendingLoginTwoStepToken();
}

export interface LoginTwoStepSettingStartPayload {
  maskedEmail: string;
  resendAvailableAt: string | null;
}

export async function startEnableLoginTwoStep(
  currentPassword: string,
): Promise<LoginTwoStepSettingStartPayload> {
  return apiRequest<LoginTwoStepSettingStartPayload>("/api/v1/auth/login-two-step/enable/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ currentPassword }),
  });
}

export async function confirmEnableLoginTwoStep(code: string): Promise<AuthUserPublic> {
  const result = await apiRequest<{ user: AuthUserPublic }>(
    "/api/v1/auth/login-two-step/enable/confirm",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code }),
    },
  );

  return result.user;
}

export async function startDisableLoginTwoStep(
  currentPassword: string,
): Promise<LoginTwoStepSettingStartPayload> {
  return apiRequest<LoginTwoStepSettingStartPayload>("/api/v1/auth/login-two-step/disable/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ currentPassword }),
  });
}

export async function confirmDisableLoginTwoStep(code: string): Promise<AuthUserPublic> {
  const result = await apiRequest<{ user: AuthUserPublic }>(
    "/api/v1/auth/login-two-step/disable/confirm",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code }),
    },
  );

  return result.user;
}

export async function resendLoginTwoStepSettingCode(
  action: "enable" | "disable",
): Promise<LoginTwoStepSettingStartPayload> {
  return apiRequest<LoginTwoStepSettingStartPayload>("/api/v1/auth/login-two-step/setting/resend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action }),
  });
}

export async function requestEmailChange(newEmail: string): Promise<AuthUserPublic> {
  const result = await apiRequest<{ user: AuthUserPublic }>("/api/v1/auth/email-change/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ newEmail }),
  });

  return result.user;
}

export async function confirmEmailChange(token: string): Promise<AuthUserPublic> {
  const result = await apiRequest<{ user: AuthUserPublic }>("/api/v1/auth/email-change/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  return result.user;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiRequest<{ requested: boolean; message: string }>("/api/v1/auth/password-reset/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
}

export async function validatePasswordResetToken(token: string): Promise<boolean> {
  const result = await apiRequest<{ valid: boolean }>(
    `/api/v1/auth/password-reset/validate?token=${encodeURIComponent(token)}`,
  );

  return result.valid;
}

export async function confirmPasswordReset(
  token: string,
  password: string,
): Promise<AuthUserPublic> {
  const result = await apiRequest<{ user: AuthUserPublic }>("/api/v1/auth/password-reset/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, password }),
  });

  return result.user;
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<AuthUserPublic> {
  const result = await apiRequest<{ user: AuthUserPublic }>("/api/v1/auth/password/change", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(input),
  });

  return result.user;
}

export async function revokeAllOtherSessions(): Promise<{ revokedCount: number }> {
  return apiRequest<{ revokedCount: number }>("/api/v1/auth/sessions/revoke-all", {
    method: "POST",
    credentials: "include",
  });
}

/** @deprecated Use confirmPasswordReset */
export async function resetPassword(token: string, password: string): Promise<AuthUserPublic> {
  return confirmPasswordReset(token, password);
}
