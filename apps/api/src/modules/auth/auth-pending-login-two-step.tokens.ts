import jwt, { type SignOptions } from "jsonwebtoken";

import { assertAuthSecretsConfigured, resolveAuthConfig } from "../../config/auth.config.js";
import { parseDurationToSeconds } from "./auth-tokens.js";
import { resolveLoginEmailTwoStepConfig } from "../email/login-email-two-step.config.js";

export interface PendingLoginTwoStepTokenPayload {
  sub: string;
  memberId: string;
  email: string;
  displayName: string;
  type: "login_two_step_pending";
}

export function createPendingLoginTwoStepToken(input: {
  userId: string;
  memberId: string;
  email: string;
  displayName: string;
}): string {
  assertAuthSecretsConfigured();
  const authConfig = resolveAuthConfig();
  const loginConfig = resolveLoginEmailTwoStepConfig();
  const signOptions: SignOptions = {
    expiresIn: loginConfig.challengeTokenExpiresIn as SignOptions["expiresIn"],
  };

  return jwt.sign(
    {
      sub: input.userId,
      memberId: input.memberId,
      email: input.email,
      displayName: input.displayName,
      type: "login_two_step_pending",
    },
    authConfig.jwtAccessSecret,
    signOptions,
  );
}

export function verifyPendingLoginTwoStepToken(token: string): PendingLoginTwoStepTokenPayload {
  assertAuthSecretsConfigured();
  const authConfig = resolveAuthConfig();
  const payload = jwt.verify(token, authConfig.jwtAccessSecret) as PendingLoginTwoStepTokenPayload;

  if (payload.type !== "login_two_step_pending") {
    throw new Error("Invalid pending login two-step token type.");
  }

  return payload;
}

export function resolvePendingLoginTwoStepCookieMaxAgeMs(): number {
  const loginConfig = resolveLoginEmailTwoStepConfig();
  return parseDurationToSeconds(loginConfig.challengeTokenExpiresIn) * 1000;
}
