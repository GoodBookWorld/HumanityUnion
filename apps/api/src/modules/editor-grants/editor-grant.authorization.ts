import type {
  AuthUserAccountRole,
  EditorCapabilityId,
  EditorGrantRecord,
  EditorGrantStatus,
} from "@hu/types";
import { EDITOR_CAPABILITY_IDS } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationInsufficientCapabilityError,
  AdministrationScopeMismatchError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { findEditorGrantByParticipantId } from "./editor-grant.repository.js";
import {
  contentMatchesEditorScope,
  type EditorContentGeography,
} from "./editor-grant.scope.js";

const CAPABILITY_SET = new Set<string>(EDITOR_CAPABILITY_IDS);

export function isEditorCapabilityId(value: string): value is EditorCapabilityId {
  return CAPABILITY_SET.has(value);
}

export function normalizeEditorCapabilities(
  capabilities: readonly string[],
): EditorCapabilityId[] {
  const unique = new Set<EditorCapabilityId>();
  for (const raw of capabilities) {
    if (!isEditorCapabilityId(raw)) {
      throw new AdministrationValidationError(`Unknown Editor capability: ${raw}.`);
    }
    unique.add(raw);
  }
  if (unique.size === 0) {
    throw new AdministrationValidationError("At least one editing permission is required.");
  }
  return EDITOR_CAPABILITY_IDS.filter((id) => unique.has(id));
}

export interface EditorAuthorizationActor {
  readonly userId: string;
  readonly participantId: string;
  readonly role: AuthUserAccountRole;
  readonly grant: EditorGrantRecord | null;
}

/**
 * Loads actor + Editor grant. Does not throw for missing grant
 * (callers decide ACTIVE/capability requirements).
 */
export async function resolveEditorAuthorizationActor(
  userId: string,
): Promise<EditorAuthorizationActor> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }

  const user = await findAuthUserById(userId);
  if (!user || user.status !== "active") {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }

  const grant = await findEditorGrantByParticipantId(user.memberId);

  return {
    userId: user.userId,
    participantId: user.memberId,
    role: user.role,
    grant,
  };
}

function assertActiveEditorGrant(actor: EditorAuthorizationActor): EditorGrantRecord {
  if (actor.role === "admin") {
    // Admin bypass — synthetic unrestricted grant is not required for callers
    // that short-circuit earlier; this path should not be used for admins.
    throw new AdministrationForbiddenError("Use Admin authority path for administrators.");
  }

  if (!actor.grant || actor.grant.status !== "ACTIVE") {
    throw new AdministrationForbiddenError("Active Editor access is required.");
  }

  return actor.grant;
}

/**
 * Asserts the actor may use an Editor capability.
 * Admins bypass grant restrictions entirely.
 */
export async function assertEditorCapability(input: {
  actorUserId: string;
  capability: EditorCapabilityId;
}): Promise<EditorAuthorizationActor> {
  const actor = await resolveEditorAuthorizationActor(input.actorUserId);

  if (actor.role === "admin") {
    return actor;
  }

  const grant = assertActiveEditorGrant(actor);
  if (!grant.capabilities.includes(input.capability)) {
    throw new AdministrationInsufficientCapabilityError(
      input.capability,
      `Editor capability ${input.capability} is required.`,
    );
  }

  return actor;
}

/**
 * Asserts content geography is within the actor's Editor scope.
 * Admins bypass. Content without sufficient geography is denied for scoped Editors.
 */
export async function assertEditorScope(input: {
  actorUserId: string;
  content: EditorContentGeography;
}): Promise<EditorAuthorizationActor> {
  const actor = await resolveEditorAuthorizationActor(input.actorUserId);

  if (actor.role === "admin") {
    return actor;
  }

  const grant = assertActiveEditorGrant(actor);
  if (!contentMatchesEditorScope(grant.geographicScope, input.content)) {
    throw new AdministrationScopeMismatchError(
      "This content is outside your assigned editing area.",
    );
  }

  return actor;
}

/**
 * Combined capability + geography assertion for Editor mutations.
 * Admin always succeeds. Inactive / missing grant denied.
 */
export async function assertEditorCanMutate(input: {
  actorUserId: string;
  capability: EditorCapabilityId;
  content: EditorContentGeography;
}): Promise<EditorAuthorizationActor> {
  const actor = await assertEditorCapability({
    actorUserId: input.actorUserId,
    capability: input.capability,
  });

  if (actor.role === "admin") {
    return actor;
  }

  return assertEditorScope({
    actorUserId: input.actorUserId,
    content: input.content,
  });
}

export function isActiveEditorStatus(status: EditorGrantStatus | null | undefined): boolean {
  return status === "ACTIVE";
}
