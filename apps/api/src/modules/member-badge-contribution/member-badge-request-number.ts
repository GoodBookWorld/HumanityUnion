import { randomBytes } from "node:crypto";

const BADGE_REQUEST_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateMemberBadgeRequestNumber(now = new Date()): string {
  const year = now.getUTCFullYear();
  const bytes = randomBytes(6);
  let suffix = "";

  for (let index = 0; index < 6; index += 1) {
    const byte = bytes[index] ?? 0;
    suffix += BADGE_REQUEST_ALPHABET[byte % BADGE_REQUEST_ALPHABET.length];
  }

  return `HU-BADGE-${year}-${suffix}`;
}

export function isValidMemberBadgeRequestNumber(value: string): boolean {
  return /^HU-BADGE-\d{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(value);
}
