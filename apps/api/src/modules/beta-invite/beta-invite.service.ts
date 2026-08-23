import type { BetaInvitePublic } from "@hu/types";

import { resolveBetaInviteExpiresDays } from "../../config/platform.config.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  expireBetaInviteIfNeeded,
  findBetaInviteByEmail,
  findPendingBetaInviteByCodeHash,
  insertBetaInvite,
  listBetaInvitesByCreator,
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
    usedAt: invite.usedAt,
  };
}

async function assertAdminUser(userId: string): Promise<void> {
  const user = await findAuthUserById(userId);

  if (!user || user.status !== "active") {
    throw new BetaInviteAdminRequiredError();
  }

  if (user.role === "admin") {
    return;
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
}

export async function createBetaInviteForAdmin(input: {
  email: string;
  createdBy: string;
}): Promise<{ invite: BetaInvitePublic; code: string }> {
  await assertAdminUser(input.createdBy);

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

  return {
    invite: toPublicInvite(issued.invite),
    code: issued.code,
  };
}

export async function listBetaInvitesForAdmin(userId: string): Promise<BetaInvitePublic[]> {
  await assertAdminUser(userId);

  const invites = await listBetaInvitesByCreator(userId);
  return invites.map(toPublicInvite);
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
