import type { MembershipApplicationInput } from "@hu/types";

/**
 * HTTP body parser for Membership application create/update.
 * Must forward `participationCountryCodes` (canonical multi-country array).
 * Legacy `countryCode` remains for compatibility only and does not replace the array.
 */
export function parseApplicationBody(body: unknown): MembershipApplicationInput {
  const payload =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const rawParticipation = payload.participationCountryCodes;
  const participationCountryCodes = Array.isArray(rawParticipation)
    ? rawParticipation.filter((value): value is string => typeof value === "string")
    : undefined;

  return {
    ...(participationCountryCodes !== undefined ? { participationCountryCodes } : {}),
    countryCode: String(payload.countryCode ?? ""),
    displayNameConfirmed: String(payload.displayNameConfirmed ?? ""),
    understandMembershipMeaning: payload.understandMembershipMeaning === true,
    understandNoVoteWeightChange: payload.understandNoVoteWeightChange === true,
    understandDataPolicy: payload.understandDataPolicy === true,
    submit: payload.submit === true,
  };
}
