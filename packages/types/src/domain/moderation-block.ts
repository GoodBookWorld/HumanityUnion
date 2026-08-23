/**
 * Pack 12C — Effective moderation block with ADMIN | EDITOR provenance.
 * Extends Fix08 soft-block fields; does not replace them with a second boolean.
 */

export type ModerationBlockAuthority = "ADMIN" | "EDITOR";

export const MODERATION_BLOCK_AUTHORITIES = ["ADMIN", "EDITOR"] as const;

export function isModerationBlockAuthority(value: unknown): value is ModerationBlockAuthority {
  return value === "ADMIN" || value === "EDITOR";
}

/** Fields shared by Initiative and Public Choice Candidate soft-blocks. */
export interface ModerationBlockRecordFields {
  readonly administrativelyBlocked?: boolean;
  /**
   * Pack 12C — who set the effective block.
   * Missing on legacy Fix08 Admin blocks → resolved as ADMIN.
   */
  readonly administrativeBlockAuthority?: ModerationBlockAuthority;
  readonly administrativelyBlockedAt?: string;
  readonly administrativelyBlockedByParticipantId?: string;
  readonly administrativeBlockReason?: string;
}

export interface EffectiveModerationBlock {
  readonly isBlocked: true;
  readonly authority: ModerationBlockAuthority;
  readonly blockedAt?: string;
  readonly blockedByParticipantId?: string;
  readonly reason?: string;
}

export interface ClearModerationBlock {
  readonly isBlocked: false;
}

export type ResolvedModerationBlock = EffectiveModerationBlock | ClearModerationBlock;

/**
 * Canonical effective-block resolver for Initiative + Candidate soft-blocks.
 * Legacy Fix08 records with administrativelyBlocked=true and no authority → ADMIN.
 */
export function resolveEffectiveModerationBlock(
  record: ModerationBlockRecordFields | null | undefined,
): ResolvedModerationBlock {
  if (!record || record.administrativelyBlocked !== true) {
    return { isBlocked: false };
  }

  const authority: ModerationBlockAuthority =
    record.administrativeBlockAuthority === "EDITOR" ? "EDITOR" : "ADMIN";

  return {
    isBlocked: true,
    authority,
    ...(record.administrativelyBlockedAt
      ? { blockedAt: record.administrativelyBlockedAt }
      : {}),
    ...(record.administrativelyBlockedByParticipantId
      ? { blockedByParticipantId: record.administrativelyBlockedByParticipantId }
      : {}),
    ...(record.administrativeBlockReason
      ? { reason: record.administrativeBlockReason }
      : {}),
  };
}

export function isModerationBlocked(
  record: ModerationBlockRecordFields | null | undefined,
): boolean {
  return resolveEffectiveModerationBlock(record).isBlocked;
}

export function isAdminModerationBlock(
  record: ModerationBlockRecordFields | null | undefined,
): boolean {
  const resolved = resolveEffectiveModerationBlock(record);
  return resolved.isBlocked && resolved.authority === "ADMIN";
}

export function isEditorModerationBlock(
  record: ModerationBlockRecordFields | null | undefined,
): boolean {
  const resolved = resolveEffectiveModerationBlock(record);
  return resolved.isBlocked && resolved.authority === "EDITOR";
}

/** Safe Admin/Editor UI label — no actor PII. */
export function formatModerationBlockLabel(
  record: ModerationBlockRecordFields | null | undefined,
): string | null {
  const resolved = resolveEffectiveModerationBlock(record);
  if (!resolved.isBlocked) {
    return null;
  }
  return resolved.authority === "ADMIN" ? "Blocked by administrator" : "Blocked by editor";
}

export const MODERATION_ADMIN_BLOCK_CONTACT_MESSAGE =
  "This content has been blocked by an administrator. Please contact the administrator.";
