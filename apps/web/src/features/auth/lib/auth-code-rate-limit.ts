import { ApiRequestError } from "../../../lib/api-client";

export interface AuthCodeRateLimitDetails {
  code: string;
  retryAfterSeconds: number;
  limitType: "cooldown" | "account_hourly_limit" | "ip_hourly_limit" | "challenge_limit";
}

export function getAuthCodeRateLimitDetails(error: unknown): AuthCodeRateLimitDetails | null {
  if (!(error instanceof ApiRequestError) || error.status !== 429) {
    return null;
  }

  const meta = error.meta;

  if (!meta || typeof meta.retryAfterSeconds !== "number" || typeof meta.limitType !== "string") {
    return null;
  }

  return {
    code: typeof meta.code === "string" ? meta.code : "AUTH_CODE_RATE_LIMITED",
    retryAfterSeconds: meta.retryAfterSeconds,
    limitType: meta.limitType as AuthCodeRateLimitDetails["limitType"],
  };
}

export function formatAuthCodeRateLimitMessage(details: AuthCodeRateLimitDetails): string {
  const minutes = Math.max(1, Math.ceil(details.retryAfterSeconds / 60));
  const timeLabel =
    details.retryAfterSeconds >= 60
      ? minutes === 1
        ? "1 minute"
        : `${minutes} minutes`
      : `${Math.max(1, details.retryAfterSeconds)} seconds`;

  if (details.limitType === "cooldown") {
    return `You can request another code in ${formatCountdownLabel(details.retryAfterSeconds)}.`;
  }

  return `Too many codes have been requested. Try again in ${timeLabel}.`;
}

export function formatCountdownLabel(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = seconds % 60;

  return `${minutesPart.toString().padStart(2, "0")}:${secondsPart.toString().padStart(2, "0")}`;
}

export function formatResendAvailabilityLabel(untilIso: string | null): string | null {
  if (!untilIso) {
    return null;
  }

  const remainingSeconds = Math.ceil((Date.parse(untilIso) - Date.now()) / 1000);

  if (remainingSeconds <= 0) {
    return null;
  }

  return formatCountdownLabel(remainingSeconds);
}
