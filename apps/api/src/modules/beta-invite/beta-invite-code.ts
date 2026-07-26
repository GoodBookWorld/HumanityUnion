import { createHash, randomBytes } from "node:crypto";

const INVITE_CODE_BYTES = 24;

export function generateBetaInviteCode(): string {
  return randomBytes(INVITE_CODE_BYTES).toString("base64url");
}

export function hashBetaInviteCode(code: string): string {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export function normalizeBetaInviteCode(code: string): string {
  return code.trim();
}
