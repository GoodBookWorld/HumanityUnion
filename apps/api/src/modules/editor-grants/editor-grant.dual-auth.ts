import type { AuthUserAccountRole, EditorCapabilityId } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { assertEditorCanMutate } from "./editor-grant.authorization.js";
import type { EditorContentGeography } from "./editor-grant.scope.js";

export interface AdminOrEditorActor {
  readonly userId: string;
  readonly participantId: string;
  readonly role: AuthUserAccountRole;
  readonly authority: "admin" | "editor";
}

/**
 * Pack 12B — Admin bypass OR active Editor with capability + content geography.
 */
export async function assertAdminOrEditorCanMutate(input: {
  actorUserId: string;
  capability: EditorCapabilityId;
  content: EditorContentGeography;
}): Promise<AdminOrEditorActor> {
  if (!input.actorUserId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }

  const user = await findAuthUserById(input.actorUserId);
  if (!user || user.status !== "active") {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }

  if (user.role === "admin") {
    return {
      userId: user.userId,
      participantId: user.memberId,
      role: "admin",
      authority: "admin",
    };
  }

  await assertEditorCanMutate({
    actorUserId: input.actorUserId,
    capability: input.capability,
    content: input.content,
  });

  return {
    userId: user.userId,
    participantId: user.memberId,
    role: user.role,
    authority: "editor",
  };
}

export async function assertActiveEditorCapability(input: {
  actorUserId: string;
  capability: EditorCapabilityId;
}): Promise<AdminOrEditorActor> {
  if (!input.actorUserId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }

  const user = await findAuthUserById(input.actorUserId);
  if (!user || user.status !== "active") {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }

  if (user.role === "admin") {
    throw new AdministrationForbiddenError(
      "Administrator accounts use the Admin Panel. Editor Panel tools require an Editor grant.",
    );
  }

  const { assertEditorCapability } = await import("./editor-grant.authorization.js");
  await assertEditorCapability({
    actorUserId: input.actorUserId,
    capability: input.capability,
  });

  return {
    userId: user.userId,
    participantId: user.memberId,
    role: user.role,
    authority: "editor",
  };
}
