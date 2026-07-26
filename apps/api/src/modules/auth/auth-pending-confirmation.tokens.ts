import jwt, { type SignOptions } from "jsonwebtoken";

import { assertAuthSecretsConfigured, resolveAuthConfig } from "../../config/auth.config.js";
import { parseDurationToSeconds } from "./auth-tokens.js";
import { resolveEmailConfirmationConfig } from "../email/email-confirmation.config.js";

export interface PendingConfirmationTokenPayload {
  sub: string;
  memberId: string;
  email: string;
  displayName: string;
  type: "email_confirmation_pending";
}

export function createPendingConfirmationToken(input: {
  userId: string;
  memberId: string;
  email: string;
  displayName: string;
}): string {
  assertAuthSecretsConfigured();
  const authConfig = resolveAuthConfig();
  const confirmationConfig = resolveEmailConfirmationConfig();
  const signOptions: SignOptions = {
    expiresIn: confirmationConfig.pendingTokenExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign(
    {
      sub: input.userId,
      memberId: input.memberId,
      email: input.email,
      displayName: input.displayName,
      type: "email_confirmation_pending",
    },
    authConfig.jwtAccessSecret,
    signOptions,
  );
}

export function verifyPendingConfirmationToken(token: string): PendingConfirmationTokenPayload {
  assertAuthSecretsConfigured();
  const authConfig = resolveAuthConfig();
  const payload = jwt.verify(token, authConfig.jwtAccessSecret) as PendingConfirmationTokenPayload;

  if (payload.type !== "email_confirmation_pending") {
    throw new Error("Invalid pending confirmation token type.");
  }

  return payload;
}

export function resolvePendingConfirmationCookieMaxAgeMs(): number {
  const confirmationConfig = resolveEmailConfirmationConfig();
  return parseDurationToSeconds(confirmationConfig.pendingTokenExpiresIn) * 1000;
}
