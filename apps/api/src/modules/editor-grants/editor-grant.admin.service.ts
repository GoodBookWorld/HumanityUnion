import { randomUUID } from "node:crypto";

import type {
  AdminEditorDirectoryItem,
  AdminEditorDirectoryResponse,
  AdminEditorSummary,
  AssignEditorGrantInput,
  EditorCapabilityId,
  EditorGrantRecord,
  EditorGrantStatus,
  EditorViewerState,
  UpdateEditorGrantInput,
} from "@hu/types";
import { EDITOR_CAPABILITY_LABELS } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { AuditService } from "../administration/audit.service.js";
import { findAuthUserById, findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { findMemberById } from "../member/infrastructure/member.repository.js";
import { normalizeEditorCapabilities } from "./editor-grant.authorization.js";
import {
  countEditorGrantsByStatus,
  findEditorGrantById,
  findEditorGrantByParticipantId,
  insertEditorGrant,
  listEditorGrants,
  replaceEditorGrant,
} from "./editor-grant.repository.js";
import {
  formatEditorGeographicScope,
  normalizeEditorGeographicScope,
} from "./editor-grant.scope.js";

async function assertAdminActor(userId: string): Promise<{
  userId: string;
  participantId: string;
}> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }

  const user = await findAuthUserById(userId);
  if (!user || user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }

  return { userId: user.userId, participantId: user.memberId };
}

function capabilityLabels(capabilities: readonly EditorCapabilityId[]): string[] {
  return capabilities.map((id) => EDITOR_CAPABILITY_LABELS[id]);
}

async function toDirectoryItem(grant: EditorGrantRecord): Promise<AdminEditorDirectoryItem> {
  const authUser = await findAuthUserByMemberId(grant.participantId);
  let uniqueName: string | undefined;
  let memberDisplayName: string | undefined;

  try {
    const member = await findMemberById(grant.participantId);
    uniqueName = member?.uniqueName;
    memberDisplayName = member?.displayName;
  } catch {
    // Member aggregate may be unavailable in some test/bootstrap paths; Profile/Auth remain authoritative.
  }

  const profile = authUser ? await findMemberProfileByUserId(authUser.userId) : null;

  const displayName =
    profile?.displayName?.trim() ||
    authUser?.displayName?.trim() ||
    memberDisplayName?.trim() ||
    authUser?.email ||
    grant.participantId;

  return {
    editorGrantId: grant.editorGrantId,
    participantId: grant.participantId,
    displayName,
    ...(uniqueName ? { uniqueName } : {}),
    email: authUser?.email ?? "",
    ...(profile?.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
    status: grant.status,
    capabilities: grant.capabilities,
    capabilityLabels: capabilityLabels(grant.capabilities),
    geographicScope: formatEditorGeographicScope(grant.geographicScope),
    assignedByAdminParticipantId: grant.assignedByAdminParticipantId,
    createdAt: grant.createdAt,
    updatedAt: grant.updatedAt,
    ...(grant.activatedAt ? { activatedAt: grant.activatedAt } : {}),
    ...(grant.deactivatedAt ? { deactivatedAt: grant.deactivatedAt } : {}),
  };
}

function summarizeGrant(grant: EditorGrantRecord): string {
  return [
    `status=${grant.status}`,
    `caps=${grant.capabilities.join(",")}`,
    `scope=${grant.geographicScope.level}`,
    grant.geographicScope.countryCode ? `country=${grant.geographicScope.countryCode}` : "",
    grant.geographicScope.regionCode ? `region=${grant.geographicScope.regionCode}` : "",
    grant.geographicScope.communityCode ? `city=${grant.geographicScope.communityCode}` : "",
  ]
    .filter(Boolean)
    .join(";");
}

export async function getAdminEditorSummary(input: {
  actorUserId: string;
}): Promise<AdminEditorSummary> {
  await assertAdminActor(input.actorUserId);
  return countEditorGrantsByStatus();
}

export async function listAdminEditors(input: {
  actorUserId: string;
  status?: EditorGrantStatus;
  limit?: number;
  offset?: number;
}): Promise<AdminEditorDirectoryResponse> {
  await assertAdminActor(input.actorUserId);

  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 25), 1), 100);
  const offset = Math.max(Math.trunc(input.offset ?? 0), 0);

  const listed = await listEditorGrants({
    status: input.status,
    limit,
    offset,
  });

  const editors = await Promise.all(listed.items.map((grant) => toDirectoryItem(grant)));

  return {
    editors,
    total: listed.total,
    activeCount: listed.activeCount,
    limit,
    offset,
    hasMore: offset + editors.length < listed.total,
  };
}

export async function getAdminEditor(input: {
  actorUserId: string;
  editorGrantId: string;
}): Promise<AdminEditorDirectoryItem> {
  await assertAdminActor(input.actorUserId);
  const grant = await findEditorGrantById(input.editorGrantId);
  if (!grant) {
    throw new AdministrationValidationError("Editor grant not found.");
  }
  return toDirectoryItem(grant);
}

export async function assignEditorGrant(input: {
  actorUserId: string;
  body: AssignEditorGrantInput;
}): Promise<AdminEditorDirectoryItem> {
  const admin = await assertAdminActor(input.actorUserId);
  const participantId = input.body.participantId?.trim();
  if (!participantId) {
    throw new AdministrationValidationError("Participant is required.");
  }

  const authUser = await findAuthUserByMemberId(participantId);
  if (!authUser) {
    throw new AdministrationValidationError(
      "Select an existing registered Participant. No matching account was found.",
    );
  }

  if (authUser.status !== "active") {
    throw new AdministrationValidationError("Cannot assign Editor access to a disabled account.");
  }

  const capabilities = normalizeEditorCapabilities(input.body.capabilities ?? []);
  const geographicScope = normalizeEditorGeographicScope(input.body.geographicScope);
  const status: EditorGrantStatus = input.body.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  const now = new Date().toISOString();

  const existing = await findEditorGrantByParticipantId(participantId);
  if (existing) {
    throw new AdministrationValidationError(
      "This Participant already has an Editor grant. Update the existing grant instead.",
    );
  }

  const grant: EditorGrantRecord = {
    editorGrantId: `edg_${randomUUID()}`,
    participantId,
    status,
    capabilities,
    geographicScope,
    assignedByAdminParticipantId: admin.participantId,
    createdAt: now,
    updatedAt: now,
    ...(status === "ACTIVE" ? { activatedAt: now } : { deactivatedAt: now }),
  };

  await insertEditorGrant(grant);

  await AuditService.record({
    actorParticipantId: admin.participantId,
    action: "editor.assign",
    targetType: "editor_grant",
    targetId: grant.editorGrantId,
    afterSummary: summarizeGrant(grant),
  });

  return toDirectoryItem(grant);
}

export async function updateEditorGrant(input: {
  actorUserId: string;
  editorGrantId: string;
  body: UpdateEditorGrantInput;
}): Promise<AdminEditorDirectoryItem> {
  const admin = await assertAdminActor(input.actorUserId);
  const existing = await findEditorGrantById(input.editorGrantId);
  if (!existing) {
    throw new AdministrationValidationError("Editor grant not found.");
  }

  const now = new Date().toISOString();
  let capabilities = existing.capabilities;
  let geographicScope = existing.geographicScope;
  let status = existing.status;
  let activatedAt = existing.activatedAt;
  let deactivatedAt = existing.deactivatedAt;

  const before = summarizeGrant(existing);
  const auditActions: Array<
    "editor.update_permissions" | "editor.update_scope" | "editor.activate" | "editor.deactivate"
  > = [];

  if (input.body.capabilities !== undefined) {
    capabilities = normalizeEditorCapabilities(input.body.capabilities);
    if (capabilities.join(",") !== existing.capabilities.join(",")) {
      auditActions.push("editor.update_permissions");
    }
  }

  if (input.body.geographicScope !== undefined) {
    geographicScope = normalizeEditorGeographicScope(input.body.geographicScope);
    const beforeScope = JSON.stringify(existing.geographicScope);
    const afterScope = JSON.stringify(geographicScope);
    if (beforeScope !== afterScope) {
      auditActions.push("editor.update_scope");
    }
  }

  if (input.body.status !== undefined) {
    if (input.body.status !== "ACTIVE" && input.body.status !== "INACTIVE") {
      throw new AdministrationValidationError("Invalid Editor status.");
    }
    if (input.body.status !== existing.status) {
      status = input.body.status;
      if (status === "ACTIVE") {
        activatedAt = now;
        deactivatedAt = undefined;
        auditActions.push("editor.activate");
      } else {
        deactivatedAt = now;
        auditActions.push("editor.deactivate");
      }
    }
  }

  const updated: EditorGrantRecord = {
    ...existing,
    capabilities,
    geographicScope,
    status,
    assignedByAdminParticipantId: admin.participantId,
    updatedAt: now,
    ...(activatedAt ? { activatedAt } : {}),
    ...(deactivatedAt ? { deactivatedAt } : {}),
  };

  // Clear deactivatedAt when activating (spread may keep stale field).
  const persisted: EditorGrantRecord =
    status === "ACTIVE"
      ? {
          editorGrantId: updated.editorGrantId,
          participantId: updated.participantId,
          status: "ACTIVE",
          capabilities: updated.capabilities,
          geographicScope: updated.geographicScope,
          assignedByAdminParticipantId: updated.assignedByAdminParticipantId,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          activatedAt: activatedAt ?? now,
        }
      : {
          editorGrantId: updated.editorGrantId,
          participantId: updated.participantId,
          status: "INACTIVE",
          capabilities: updated.capabilities,
          geographicScope: updated.geographicScope,
          assignedByAdminParticipantId: updated.assignedByAdminParticipantId,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          ...(updated.activatedAt ? { activatedAt: updated.activatedAt } : {}),
          deactivatedAt: deactivatedAt ?? now,
        };

  await replaceEditorGrant(persisted);

  const after = summarizeGrant(persisted);
  if (auditActions.length === 0) {
    // No meaningful change — still allow idempotent PATCH.
    return toDirectoryItem(persisted);
  }

  for (const action of auditActions) {
    await AuditService.record({
      actorParticipantId: admin.participantId,
      action,
      targetType: "editor_grant",
      targetId: persisted.editorGrantId,
      beforeSummary: before,
      afterSummary: after,
    });
  }

  return toDirectoryItem(persisted);
}

export async function activateEditorGrant(input: {
  actorUserId: string;
  editorGrantId: string;
}): Promise<AdminEditorDirectoryItem> {
  return updateEditorGrant({
    actorUserId: input.actorUserId,
    editorGrantId: input.editorGrantId,
    body: { status: "ACTIVE" },
  });
}

export async function deactivateEditorGrant(input: {
  actorUserId: string;
  editorGrantId: string;
}): Promise<AdminEditorDirectoryItem> {
  return updateEditorGrant({
    actorUserId: input.actorUserId,
    editorGrantId: input.editorGrantId,
    body: { status: "INACTIVE" },
  });
}

/** Safe /me Editor projection — no assignedBy or audit metadata. */
export async function resolveEditorViewerState(
  participantId: string,
): Promise<EditorViewerState> {
  const grant = await findEditorGrantByParticipantId(participantId);
  if (!grant) {
    return { isEditor: false };
  }

  return {
    isEditor: true,
    status: grant.status,
    capabilities: grant.capabilities,
    geographicScope: formatEditorGeographicScope(grant.geographicScope),
  };
}
