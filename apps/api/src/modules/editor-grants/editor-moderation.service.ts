/**
 * Pack 12C — Editor soft-block / soft-unblock with EDITOR provenance.
 *
 * Unblock policy: any ACTIVE Editor with matching moderation capability + scope
 * may remove an EDITOR-level block. Never ADMIN blocks.
 * Client cannot supply authority or blockedByParticipantId.
 */
import type { Initiative, PublicChoiceCandidate } from "@hu/types";
import {
  MODERATION_ADMIN_BLOCK_CONTACT_MESSAGE,
  resolveEffectiveModerationBlock,
  resolveInitiativeLifecycleProfile,
} from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { record } from "../administration/audit.service.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { getInitiativeById, updateInitiative } from "../initiatives/initiative.store.js";
import {
  getPublicChoiceCandidateById,
  updatePublicChoiceCandidate,
} from "../public-choice-candidate/persistence/public-choice-candidate.repository.js";
import { assertEditorCanMutate } from "./editor-grant.authorization.js";
import { initiativeContentGeography } from "./editor-content-geography.js";
import { findEditorGrantByParticipantId } from "./editor-grant.repository.js";

export interface EditorModerationCommandResult {
  readonly targetType: "initiative" | "public_choice_candidate";
  readonly targetId: string;
  readonly initiativeId: string;
  readonly isBlocked: boolean;
  readonly authority: "EDITOR" | null;
  readonly auditId: string;
}

function normalizeReason(reason: string | undefined): string | undefined {
  const trimmed = reason?.trim() || undefined;
  if (trimmed && trimmed.length > 500) {
    throw new AdministrationValidationError("Reason must be at most 500 characters.");
  }
  return trimmed;
}

async function requireActiveEditorActor(actorUserId: string): Promise<{
  userId: string;
  participantId: string;
}> {
  if (!actorUserId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  const user = await findAuthUserById(actorUserId);
  if (!user || user.status !== "active") {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  const grant = await findEditorGrantByParticipantId(user.memberId);
  if (!grant || grant.status !== "ACTIVE") {
    throw new AdministrationForbiddenError("Active Editor access is required.");
  }
  return { userId: user.userId, participantId: user.memberId };
}

function assertNotAdminBlocked(record: {
  administrativelyBlocked?: boolean;
  administrativeBlockAuthority?: "ADMIN" | "EDITOR";
}): void {
  const resolved = resolveEffectiveModerationBlock(record);
  if (resolved.isBlocked && resolved.authority === "ADMIN") {
    throw new AdministrationForbiddenError(MODERATION_ADMIN_BLOCK_CONTACT_MESSAGE);
  }
}

async function assertInitiativeModerationScope(input: {
  actorUserId: string;
  initiative: Initiative;
  capability: "INITIATIVE_MODERATE" | "PUBLIC_CHOICE_MODERATE";
}): Promise<void> {
  await assertEditorCanMutate({
    actorUserId: input.actorUserId,
    capability: input.capability,
    content: initiativeContentGeography({
      countrySlug: input.initiative.metadata.countrySlug,
      regionSlug: input.initiative.metadata.regionSlug,
      communitySlug: input.initiative.metadata.communitySlug,
    }),
  });
}

function moderationCapabilityForInitiative(
  initiative: Initiative,
): "INITIATIVE_MODERATE" | "PUBLIC_CHOICE_MODERATE" {
  return resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) === "PUBLIC_CHOICE"
    ? "PUBLIC_CHOICE_MODERATE"
    : "INITIATIVE_MODERATE";
}

export async function blockInitiativeAsEditor(input: {
  actorUserId: string;
  initiativeId: string;
  reason?: string;
}): Promise<EditorModerationCommandResult> {
  const actor = await requireActiveEditorActor(input.actorUserId);
  const initiative = getInitiativeById(input.initiativeId);
  if (!initiative) {
    throw new AdministrationValidationError("Initiative not found.");
  }

  const capability = moderationCapabilityForInitiative(initiative);
  await assertInitiativeModerationScope({
    actorUserId: actor.userId,
    initiative,
    capability,
  });

  assertNotAdminBlocked(initiative);
  const existing = resolveEffectiveModerationBlock(initiative);
  if (existing.isBlocked && existing.authority === "EDITOR") {
    throw new AdministrationValidationError("Content is already blocked.");
  }

  const reason = normalizeReason(input.reason);
  const now = new Date().toISOString();
  const updated = updateInitiative(initiative.initiativeId, {
    administrativelyBlocked: true,
    administrativeBlockAuthority: "EDITOR",
    administrativelyBlockedAt: now,
    administrativelyBlockedByParticipantId: actor.participantId,
    administrativeBlockReason: reason ?? null,
  });
  if (!updated) {
    throw new AdministrationValidationError("Initiative not found.");
  }

  const audit = await record({
    actorParticipantId: actor.participantId,
    action: "editor.moderation.block",
    targetType: "initiative",
    targetId: initiative.initiativeId,
    reason,
    beforeSummary: "administrativelyBlocked=false",
    afterSummary: "administrativelyBlocked=true;authority=EDITOR",
  });

  return {
    targetType: "initiative",
    targetId: initiative.initiativeId,
    initiativeId: initiative.initiativeId,
    isBlocked: true,
    authority: "EDITOR",
    auditId: audit.auditId,
  };
}

export async function unblockInitiativeAsEditor(input: {
  actorUserId: string;
  initiativeId: string;
  reason?: string;
}): Promise<EditorModerationCommandResult> {
  const actor = await requireActiveEditorActor(input.actorUserId);
  const initiative = getInitiativeById(input.initiativeId);
  if (!initiative) {
    throw new AdministrationValidationError("Initiative not found.");
  }

  const capability = moderationCapabilityForInitiative(initiative);
  await assertInitiativeModerationScope({
    actorUserId: actor.userId,
    initiative,
    capability,
  });

  const existing = resolveEffectiveModerationBlock(initiative);
  if (!existing.isBlocked) {
    throw new AdministrationValidationError("Content is not blocked.");
  }
  if (existing.authority === "ADMIN") {
    throw new AdministrationForbiddenError(MODERATION_ADMIN_BLOCK_CONTACT_MESSAGE);
  }

  const reason = normalizeReason(input.reason);
  const updated = updateInitiative(initiative.initiativeId, {
    administrativelyBlocked: false,
  });
  if (!updated) {
    throw new AdministrationValidationError("Initiative not found.");
  }

  const audit = await record({
    actorParticipantId: actor.participantId,
    action: "editor.moderation.unblock",
    targetType: "initiative",
    targetId: initiative.initiativeId,
    reason,
    beforeSummary: "administrativelyBlocked=true;authority=EDITOR",
    afterSummary: "administrativelyBlocked=false",
  });

  return {
    targetType: "initiative",
    targetId: initiative.initiativeId,
    initiativeId: initiative.initiativeId,
    isBlocked: false,
    authority: null,
    auditId: audit.auditId,
  };
}

export async function blockPublicChoiceCandidateAsEditor(input: {
  actorUserId: string;
  initiativeId: string;
  candidateId: string;
  reason?: string;
}): Promise<EditorModerationCommandResult> {
  const actor = await requireActiveEditorActor(input.actorUserId);
  const initiative = getInitiativeById(input.initiativeId);
  if (
    !initiative ||
    resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== "PUBLIC_CHOICE"
  ) {
    throw new AdministrationValidationError("Public Choice election not found.");
  }

  await assertInitiativeModerationScope({
    actorUserId: actor.userId,
    initiative,
    capability: "PUBLIC_CHOICE_MODERATE",
  });

  assertNotAdminBlocked(initiative);

  const existing = await getPublicChoiceCandidateById(input.candidateId);
  if (!existing || existing.initiativeId !== input.initiativeId) {
    throw new AdministrationValidationError("Candidate not found.");
  }

  assertNotAdminBlocked(existing);
  const resolved = resolveEffectiveModerationBlock(existing);
  if (resolved.isBlocked && resolved.authority === "EDITOR") {
    throw new AdministrationValidationError("Candidate is already blocked.");
  }

  const reason = normalizeReason(input.reason);
  const now = new Date().toISOString();
  const updated: PublicChoiceCandidate = {
    candidateId: existing.candidateId,
    initiativeId: existing.initiativeId,
    name: existing.name,
    photoUrl: existing.photoUrl,
    campaignPageUrl: existing.campaignPageUrl,
    sortOrder: existing.sortOrder,
    submittedByParticipantId: existing.submittedByParticipantId,
    administrativelyBlocked: true,
    administrativeBlockAuthority: "EDITOR",
    administrativelyBlockedAt: now,
    administrativelyBlockedByParticipantId: actor.participantId,
    ...(reason ? { administrativeBlockReason: reason } : {}),
    createdAt: existing.createdAt,
    updatedAt: now,
  };
  await updatePublicChoiceCandidate(updated);

  const audit = await record({
    actorParticipantId: actor.participantId,
    action: "editor.moderation.block",
    targetType: "public_choice_candidate",
    targetId: existing.candidateId,
    reason,
    beforeSummary: "administrativelyBlocked=false",
    afterSummary: "administrativelyBlocked=true;authority=EDITOR",
  });

  return {
    targetType: "public_choice_candidate",
    targetId: existing.candidateId,
    initiativeId: input.initiativeId,
    isBlocked: true,
    authority: "EDITOR",
    auditId: audit.auditId,
  };
}

export async function unblockPublicChoiceCandidateAsEditor(input: {
  actorUserId: string;
  initiativeId: string;
  candidateId: string;
  reason?: string;
}): Promise<EditorModerationCommandResult> {
  const actor = await requireActiveEditorActor(input.actorUserId);
  const initiative = getInitiativeById(input.initiativeId);
  if (
    !initiative ||
    resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== "PUBLIC_CHOICE"
  ) {
    throw new AdministrationValidationError("Public Choice election not found.");
  }

  await assertInitiativeModerationScope({
    actorUserId: actor.userId,
    initiative,
    capability: "PUBLIC_CHOICE_MODERATE",
  });

  const existing = await getPublicChoiceCandidateById(input.candidateId);
  if (!existing || existing.initiativeId !== input.initiativeId) {
    throw new AdministrationValidationError("Candidate not found.");
  }

  const resolved = resolveEffectiveModerationBlock(existing);
  if (!resolved.isBlocked) {
    throw new AdministrationValidationError("Candidate is not blocked.");
  }
  if (resolved.authority === "ADMIN") {
    throw new AdministrationForbiddenError(MODERATION_ADMIN_BLOCK_CONTACT_MESSAGE);
  }

  const reason = normalizeReason(input.reason);
  const cleared: PublicChoiceCandidate = {
    candidateId: existing.candidateId,
    initiativeId: existing.initiativeId,
    name: existing.name,
    photoUrl: existing.photoUrl,
    campaignPageUrl: existing.campaignPageUrl,
    sortOrder: existing.sortOrder,
    submittedByParticipantId: existing.submittedByParticipantId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await updatePublicChoiceCandidate(cleared);

  const audit = await record({
    actorParticipantId: actor.participantId,
    action: "editor.moderation.unblock",
    targetType: "public_choice_candidate",
    targetId: existing.candidateId,
    reason,
    beforeSummary: "administrativelyBlocked=true;authority=EDITOR",
    afterSummary: "administrativelyBlocked=false",
  });

  return {
    targetType: "public_choice_candidate",
    targetId: existing.candidateId,
    initiativeId: input.initiativeId,
    isBlocked: false,
    authority: null,
    auditId: audit.auditId,
  };
}
