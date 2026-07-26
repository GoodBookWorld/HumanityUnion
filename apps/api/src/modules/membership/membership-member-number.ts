import { randomBytes } from "node:crypto";

/** Unambiguous uppercase alphabet (no 0/O, 1/I/L). */
const MEMBERSHIP_NUMBER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Generates a public-safe Humanity Union Membership number.
 * Assignment occurs only when status becomes active_member (TASK-092+).
 */
export function generateMembershipMemberNumber(now = new Date()): string {
  const year = now.getUTCFullYear();
  const bytes = randomBytes(6);
  let suffix = "";

  for (let index = 0; index < 6; index += 1) {
    const byte = bytes[index] ?? 0;
    suffix += MEMBERSHIP_NUMBER_ALPHABET[byte % MEMBERSHIP_NUMBER_ALPHABET.length];
  }

  return `HU-${year}-${suffix}`;
}

export function isValidMembershipMemberNumber(value: string): boolean {
  return /^HU-\d{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(value);
}
