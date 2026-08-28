import type { MemberBadgeApplicationShippingAddress } from "@hu/types";

import { MemberBadgeApplicationValidationError } from "./member-badge-application.errors.js";

function requireTrimmedString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new MemberBadgeApplicationValidationError(`${field} is required.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new MemberBadgeApplicationValidationError(`${field} is required.`);
  }

  if (trimmed.length > maxLength) {
    throw new MemberBadgeApplicationValidationError(
      `${field} must be at most ${maxLength} characters.`,
    );
  }

  return trimmed;
}

function optionalTrimmedString(
  value: unknown,
  field: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new MemberBadgeApplicationValidationError(`${field} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw new MemberBadgeApplicationValidationError(
      `${field} must be at most ${maxLength} characters.`,
    );
  }

  return trimmed;
}

export function validateMemberBadgeApplicationShippingAddress(
  body: unknown,
): MemberBadgeApplicationShippingAddress {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new MemberBadgeApplicationValidationError("Shipping address is required.");
  }

  const record = body as Record<string, unknown>;

  return {
    recipientName: requireTrimmedString(record.recipientName, "Recipient name", 120),
    addressLine1: requireTrimmedString(record.addressLine1, "Address line 1", 200),
    addressLine2: optionalTrimmedString(record.addressLine2, "Address line 2", 200),
    city: requireTrimmedString(record.city, "City", 100),
    provinceStateRegion: requireTrimmedString(
      record.provinceStateRegion,
      "Province / State / Region",
      100,
    ),
    postalCode: requireTrimmedString(record.postalCode, "Postal / ZIP code", 32),
    country: requireTrimmedString(record.country, "Country", 100),
    phone: optionalTrimmedString(record.phone, "Phone", 40),
  };
}

export function validateMemberBadgeApplicationSaveBody(body: unknown): {
  shippingAddress: MemberBadgeApplicationShippingAddress;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new MemberBadgeApplicationValidationError("Application body is required.");
  }

  const record = body as Record<string, unknown>;
  return {
    shippingAddress: validateMemberBadgeApplicationShippingAddress(
      record.shippingAddress ?? record,
    ),
  };
}
