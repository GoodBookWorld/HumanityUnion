import { timingSafeEqual } from "node:crypto";

/** Shared by the Web process and the API. Unset or shorter than 32 characters keeps both bridges closed. */
export const WEB_SYSTEM_HEALTH_TOKEN_ENV = "WEB_SYSTEM_HEALTH_TOKEN";
export const WEB_SYSTEM_HEALTH_TOKEN_HEADER = "x-hu-system-health-token";
export const WEB_SYSTEM_HEALTH_TOKEN_MIN_LENGTH = 32;

export function readConfiguredSystemHealthToken(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const value = env[WEB_SYSTEM_HEALTH_TOKEN_ENV]?.trim() ?? "";
  if (value.length < WEB_SYSTEM_HEALTH_TOKEN_MIN_LENGTH) {
    return null;
  }
  return value;
}

export function systemHealthTokenMatches(
  presented: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const expected = readConfiguredSystemHealthToken(env);
  if (!expected) {
    return false;
  }
  const actual = presented?.trim() ?? "";
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
}
