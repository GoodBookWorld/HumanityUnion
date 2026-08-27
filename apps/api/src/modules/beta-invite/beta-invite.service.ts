import type {
  AdministrationAuditAppendInput,
  AdministrationAuditRecord,
  BetaInvitePublic,
} from "@hu/types";

import { resolveBetaInviteExpiresDays } from "../../config/platform.config.js";
import { AuditService } from "../administration/audit.service.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  expireBetaInviteIfNeeded,
  findBetaInviteByEmail,
  findBetaInviteById,
  findPendingBetaInviteByCodeHash,
  insertBetaInvite,
  listAllBetaInvites,
  listBetaInvitesByCreator,
  markBetaInviteRevoked,
  markBetaInviteUsed,
  resolveInviteCodeHash,
} from "./beta-invite.repository.js";
import {
  BetaInviteAdminRequiredError,
  BetaInviteNotFoundError,
  BetaInviteRequiredError,
  BetaInviteValidationError,
} from "./beta-invite.errors.js";
import type { BetaInviteRecord, IssuedBetaInvite } from "./beta-invite.types.js";

type BetaInviteManager = {
  userId: string;
  memberId: string;
  authority: "admin" | "editor";
};

type BetaInviteManagerResolver = (userId: string) => Promise<BetaInviteManager>;
type BetaInviteAuditRecorder = (
  input: AdministrationAuditAppendInput,
) => Promise<AdministrationAuditRecord>;

let managerAssertOverrideForTests: BetaInviteManagerResolver | null = null;
let auditRecorderOverrideForTests: BetaInviteAuditRecorder | null = null;

/** Pack 23E.1 — test seam for authorization without live auth users. */
export function setBetaInviteManagerAssertOverrideForTests(
  override: BetaInviteManagerResolver | null,
): void {
  managerAssertOverrideForTests = override;
}

/** Pack 23E.1 — test seam for audit assertions without live audit Mongo. */
export function setBetaInviteAuditRecorderOverrideForTests(
  override: BetaInviteAuditRecorder | null,
): void {
  auditRecorderOverrideForTests = override;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicInvite(invite: BetaInviteRecord): BetaInvitePublic {
  return {
    inviteId: invite.inviteId,
    email: invite.email,
    status: invite.status,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    createdBy: invite.createdBy,
    usedAt: invite.usedAt,
    revokedAt: invite.revokedAt,
  };
}

function summarizeInviteTransition(
  inviteId: string,
  fromStatus: string,
  toStatus: string,
): string {
  return `inviteId=${inviteId}; status=${fromStatus}→${toStatus}`;
}

async function recordBetaInviteAudit(input: AdministrationAuditAppendInput): Promise<void> {
  if (auditRecorderOverrideForTests) {
    await auditRecorderOverrideForTests(input);
    return;
  }
  await AuditService.record(input);
}

async function assertBetaInviteManager(userId: string): Promise<BetaInviteManager> {
  if (managerAssertOverrideForTests) {
    return managerAssertOverrideForTests(userId);
  }

  const user = await findAuthUserById(userId);

  if (!user || user.status !== "active") {
    throw new BetaInviteAdminRequiredError();
  }

  if (user.role === "admin") {
    return { userId: user.userId, memberId: user.memberId, authority: "admin" };
  }

  // Pack 12B — World Editors with BETA_ACCESS_EDIT may manage their own invites.
  const { assertEditorCapability } = await import("../editor-grants/editor-grant.authorization.js");
  const { findEditorGrantByParticipantId } = await import(
    "../editor-grants/editor-grant.repository.js"
  );
  const { betaAccessCompatibleWithEditorScope } = await import(
    "../editor-grants/editor-content-geography.js"
  );

  await assertEditorCapability({
    actorUserId: userId,
    capability: "BETA_ACCESS_EDIT",
  });
  const grant = await findEditorGrantByParticipantId(user.memberId);
  if (!grant || !betaAccessCompatibleWithEditorScope(grant.geographicScope)) {
    throw new BetaInviteAdminRequiredError();
  }

  return { userId: user.userId, memberId: user.memberId, authority: "editor" };
}

async function refreshInviteStatuses(
  invites: readonly BetaInviteRecord[],
): Promise<BetaInviteRecord[]> {
  const refreshed: BetaInviteRecord[] = [];
  for (const invite of invites) {
    refreshed.push(await expireBetaInviteIfNeeded(invite));
  }
  return refreshed;
}

export async function createBetaInviteForAdmin(input: {
  email: string;
  createdBy: string;
}): Promise<{ invite: BetaInvitePublic; code: string }> {
  const actor = await assertBetaInviteManager(input.createdBy);

  const email = normalizeEmail(input.email);

  if (!email.includes("@")) {
    throw new BetaInviteValidationError("A valid email address is required.");
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + resolveBetaInviteExpiresDays());

  const issued: IssuedBetaInvite = await insertBetaInvite({
    email,
    createdBy: input.createdBy,
    expiresAt: expiresAt.toISOString(),
  });

  await recordBetaInviteAudit({
    actorParticipantId: actor.memberId,
    action: "beta.invite.create",
    targetType: "beta_invite",
    targetId: issued.invite.inviteId,
    afterSummary: summarizeInviteTransition(issued.invite.inviteId, "none", "pending"),
  });

  return {
    invite: toPublicInvite(issued.invite),
    code: issued.code,
  };
}

/**
 * Pack 23E.1 — Administrators see platform-wide inventory; WORLD Editors remain
 * creator-scoped (safer current contract).
 */
export async function listBetaInvitesForAdmin(userId: string): Promise<BetaInvitePublic[]> {
  const actor = await assertBetaInviteManager(userId);

  const invites =
    actor.authority === "admin"
      ? await listAllBetaInvites(200)
      : await listBetaInvitesByCreator(userId);

  const refreshed = await refreshInviteStatuses(invites);
  return refreshed.map(toPublicInvite);
}

/**
 * Pack 23E.1 — Revoke a pending invite. Used/expired cannot be revoked.
 * Already-revoked is idempotent. Editors may revoke only invites they created.
 */
export async function revokeBetaInviteForAdmin(input: {
  inviteId: string;
  actorUserId: string;
}): Promise<BetaInvitePublic> {
  const actor = await assertBetaInviteManager(input.actorUserId);
  const inviteId = input.inviteId.trim();

  if (!inviteId) {
    throw new BetaInviteValidationError("Invite id is required.");
  }

  const existing = await findBetaInviteById(inviteId);
  if (!existing) {
    throw new BetaInviteNotFoundError("Invite not found.");
  }

  if (actor.authority === "editor" && existing.createdBy !== actor.userId) {
    throw new BetaInviteAdminRequiredError(
      "You may only revoke beta invites that you created.",
    );
  }

  const current = await expireBetaInviteIfNeeded(existing);

  if (current.status === "revoked") {
    return toPublicInvite(current);
  }

  if (current.status === "used") {
    throw new BetaInviteValidationError("Used invites cannot be revoked.");
  }

  if (current.status === "expired") {
    throw new BetaInviteValidationError("Expired invites cannot be revoked.");
  }

  if (current.status !== "pending") {
    throw new BetaInviteValidationError("Only pending invites can be revoked.");
  }

  const revokedAt = new Date().toISOString();
  const revoked = await markBetaInviteRevoked(current.inviteId, revokedAt);

  // Race: another actor consumed or expired between read and update.
  if (!revoked) {
    const latest = await findBetaInviteById(current.inviteId);
    if (latest?.status === "revoked") {
      return toPublicInvite(latest);
    }
    throw new BetaInviteValidationError("Only pending invites can be revoked.");
  }

  await recordBetaInviteAudit({
    actorParticipantId: actor.memberId,
    action: "beta.invite.revoke",
    targetType: "beta_invite",
    targetId: revoked.inviteId,
    beforeSummary: "status=pending",
    afterSummary: summarizeInviteTransition(revoked.inviteId, "pending", "revoked"),
  });

  return toPublicInvite(revoked);
}

export async function validateAndConsumeBetaInvite(input: {
  email: string;
  inviteCode?: string;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  const code = input.inviteCode?.trim();

  let invite: BetaInviteRecord | null = null;

  if (code) {
    invite = await findPendingBetaInviteByCodeHash(resolveInviteCodeHash(code));
  } else {
    invite = await findBetaInviteByEmail(email);
  }

  if (!invite) {
    throw new BetaInviteNotFoundError();
  }

  const current = await expireBetaInviteIfNeeded(invite);

  if (current.status !== "pending") {
    throw new BetaInviteNotFoundError();
  }

  if (current.email !== email) {
    throw new BetaInviteNotFoundError();
  }

  await markBetaInviteUsed(current.inviteId, new Date().toISOString());
}

export function assertRegistrationInviteProvided(inviteCode?: string): void {
  if (!inviteCode?.trim()) {
    throw new BetaInviteRequiredError();
  }
}

export async function previewBetaInviteValidation(input: {
  email: string;
  inviteCode: string;
}): Promise<boolean> {
  try {
    const invite = await findPendingBetaInviteByCodeHash(resolveInviteCodeHash(input.inviteCode));

    if (!invite) {
      return false;
    }

    const current = await expireBetaInviteIfNeeded(invite);

    return current.status === "pending" && current.email === normalizeEmail(input.email);
  } catch {
    return false;
  }
}
