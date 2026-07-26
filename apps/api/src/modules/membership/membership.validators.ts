import type { MembershipApplicationInput } from "@hu/types";
import { isRecognizedCountrySlug } from "@hu/geography";

import { MembershipValidationError } from "./membership.errors.js";

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

export const MEMBERSHIP_PARTICIPATION_COUNTRY_LIMIT = 10;

export function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

export function validateCountryCode(value: string): string {
  const normalized = normalizeCountryCode(value);

  if (!COUNTRY_CODE_PATTERN.test(normalized)) {
    throw new MembershipValidationError("Country must be a valid ISO 3166-1 alpha-2 code.");
  }

  if (!isRecognizedCountrySlug(normalized)) {
    throw new MembershipValidationError(
      "Country must be selected from the approved geography list.",
    );
  }

  return normalized;
}

export function resolveParticipationCountryCodesInput(input: MembershipApplicationInput): string[] {
  if (Array.isArray(input.participationCountryCodes)) {
    return input.participationCountryCodes.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
  }

  if (typeof input.countryCode === "string" && input.countryCode.trim()) {
    return [input.countryCode];
  }

  return [];
}

export function validateParticipationCountryCodes(values: string[]): string[] {
  const normalized = [...new Set(values.map((value) => validateCountryCode(value)))];

  if (normalized.length === 0) {
    throw new MembershipValidationError("Select at least one country of civic participation.");
  }

  if (normalized.length > MEMBERSHIP_PARTICIPATION_COUNTRY_LIMIT) {
    throw new MembershipValidationError(
      `You may select up to ${MEMBERSHIP_PARTICIPATION_COUNTRY_LIMIT} countries of civic participation.`,
    );
  }

  return normalized;
}

export function validateDisplayNameConfirmed(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length < 2) {
    throw new MembershipValidationError("Display name confirmation is required.");
  }

  return trimmed;
}

export function validateApplicationCheckboxes(input: MembershipApplicationInput): void {
  if (
    !input.understandMembershipMeaning ||
    !input.understandNoVoteWeightChange ||
    !input.understandDataPolicy
  ) {
    throw new MembershipValidationError("All Membership acknowledgement checkboxes are required.");
  }
}

export function validateApplicationInput(input: MembershipApplicationInput): {
  participationCountryCodes: string[];
  countryCode: string;
  displayNameConfirmed: string;
  submit: boolean;
} {
  const participationCountryCodes = validateParticipationCountryCodes(
    resolveParticipationCountryCodesInput(input),
  );
  const displayNameConfirmed = validateDisplayNameConfirmed(input.displayNameConfirmed);
  const submit = input.submit === true;

  if (submit) {
    validateApplicationCheckboxes(input);
  }

  return {
    participationCountryCodes,
    countryCode: participationCountryCodes[0] ?? "",
    displayNameConfirmed,
    submit,
  };
}
