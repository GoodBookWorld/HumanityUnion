export interface LoginEmailTwoStepConfig {
  codeTtlMinutes: number;
  maxAttempts: number;
  resendCooldownSeconds: number;
  maxSendsPerHour: number;
  ipMaxSendsPerHour: number;
  maxResendsPerChallenge: number;
  challengeTokenExpiresIn: string;
}

export function resolveLoginEmailTwoStepConfig(): LoginEmailTwoStepConfig {
  return {
    codeTtlMinutes: Number.parseInt(process.env.LOGIN_EMAIL_CODE_TTL_MINUTES ?? "10", 10),
    maxAttempts: Number.parseInt(process.env.LOGIN_EMAIL_CODE_MAX_ATTEMPTS ?? "5", 10),
    resendCooldownSeconds: Number.parseInt(
      process.env.LOGIN_EMAIL_CODE_RESEND_COOLDOWN_SECONDS ?? "60",
      10,
    ),
    maxSendsPerHour: Number.parseInt(process.env.LOGIN_EMAIL_CODE_MAX_SENDS_PER_HOUR ?? "5", 10),
    ipMaxSendsPerHour: Number.parseInt(
      process.env.LOGIN_EMAIL_CODE_IP_MAX_SENDS_PER_HOUR ?? "20",
      10,
    ),
    maxResendsPerChallenge: Number.parseInt(
      process.env.LOGIN_EMAIL_CODE_MAX_RESENDS_PER_CHALLENGE ?? "5",
      10,
    ),
    challengeTokenExpiresIn: process.env.LOGIN_EMAIL_TWO_STEP_CHALLENGE_TOKEN_EXPIRES_IN ?? "15m",
  };
}
