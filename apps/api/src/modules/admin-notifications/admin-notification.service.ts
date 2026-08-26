/**
 * Pack 22E.1 — Admin notification inbox service (list/count/delete + fan-out projection).
 */
import { randomUUID } from "node:crypto";

import type { AdminNotification, AdminNotificationSeverity, AdminNotificationType } from "@hu/types";

import { listAuthUsersForAdmin } from "../auth/auth-user.repository.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import type { AdminNotificationPersistenceAdapter } from "./admin-notification.types.js";
import {
  ADMIN_NOTIFICATION_DEFAULT_LIST_LIMIT,
  ADMIN_NOTIFICATION_MAX_LIST_LIMIT,
} from "./admin-notification.types.js";
import { resolveAdminNotificationPersistenceAdapter } from "./persistence/resolve-admin-notification-persistence.js";

export interface ProjectAdminNotificationInput {
  type: AdminNotificationType;
  title: string;
  createdAt?: string;
  actorLabel?: string;
  targetLabel?: string;
  targetHref?: string;
  sourceEventId: string;
  dedupeKey?: string;
  severity?: AdminNotificationSeverity;
}

/** Pack 22E.3 — uncleared Admin inbox retention (90 days). */
export const ADMIN_NOTIFICATION_RETENTION_DAYS = 90;

export function computeAdminNotificationExpireAt(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  const base = Number.isFinite(created) ? created : Date.now();
  return new Date(base + ADMIN_NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export interface AdminNotificationProjectionDeps {
  listActiveAdminUserIds?: () => Promise<string[]>;
  persistence?: AdminNotificationPersistenceAdapter;
}

async function assertAdminActor(userId: string): Promise<{ userId: string }> {
  const user = await findAuthUserById(userId);
  if (!user) {
    throw new AdministrationUnauthorizedError();
  }
  if (user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  return { userId: user.userId };
}

export async function listActiveAdminUserIds(): Promise<string[]> {
  const { items } = await listAuthUsersForAdmin({
    role: "admin",
    status: "active",
    sort: "createdAt",
    order: "asc",
    limit: 200,
    offset: 0,
  });
  return items.map((admin) => admin.userId);
}

/**
 * Fan-out one inbox row per active Admin. Idempotent per (recipient, sourceEventId).
 */
export async function projectAdminNotificationForAdmins(
  input: ProjectAdminNotificationInput,
  deps: AdminNotificationProjectionDeps = {},
): Promise<{ created: number; skipped: number }> {
  const persistence = deps.persistence ?? resolveAdminNotificationPersistenceAdapter();
  const adminUserIds = deps.listActiveAdminUserIds
    ? await deps.listActiveAdminUserIds()
    : await listActiveAdminUserIds();

  const createdAt = input.createdAt ?? new Date().toISOString();
  let created = 0;
  let skipped = 0;

  for (const recipientAdminUserId of adminUserIds) {
    const notification: AdminNotification = {
      adminNotificationId: randomUUID(),
      recipientAdminUserId,
      type: input.type,
      createdAt,
      title: input.title,
      ...(input.actorLabel ? { actorLabel: input.actorLabel } : {}),
      ...(input.targetLabel ? { targetLabel: input.targetLabel } : {}),
      ...(input.targetHref ? { targetHref: input.targetHref } : {}),
      sourceEventId: input.sourceEventId,
      ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
      ...(input.severity ? { severity: input.severity } : {}),
      expireAt: computeAdminNotificationExpireAt(createdAt),
    };

    const inserted = await persistence.insertIfAbsent(notification);
    if (inserted) {
      created += 1;
    } else {
      skipped += 1;
    }
  }

  return { created, skipped };
}

/**
 * Pack 22E.3 — escalate presentation on existing inbox rows for an active incident.
 */
export async function updateAdminNotificationsBySourceEventId(
  input: {
    sourceEventId: string;
    title?: string;
    targetLabel?: string;
    severity?: AdminNotificationSeverity;
  },
  deps: AdminNotificationProjectionDeps = {},
): Promise<number> {
  const persistence = deps.persistence ?? resolveAdminNotificationPersistenceAdapter();
  if (!persistence.updateBySourceEventId) {
    return 0;
  }
  return persistence.updateBySourceEventId(input);
}

export async function listAdminNotificationsForActor(input: {
  actorUserId: string;
  limit?: number;
  offset?: number;
}): Promise<{ notifications: AdminNotification[] }> {
  const actor = await assertAdminActor(input.actorUserId);
  const persistence = resolveAdminNotificationPersistenceAdapter();
  const rawLimit = input.limit ?? ADMIN_NOTIFICATION_DEFAULT_LIST_LIMIT;
  const limit = Math.min(
    ADMIN_NOTIFICATION_MAX_LIST_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) ? rawLimit : ADMIN_NOTIFICATION_DEFAULT_LIST_LIMIT),
  );
  const offset = Math.max(0, input.offset ?? 0);

  const notifications = await persistence.list({
    recipientAdminUserId: actor.userId,
    limit,
    offset,
  });

  return { notifications };
}

export async function countAdminNotificationsForActor(input: {
  actorUserId: string;
}): Promise<{ count: number }> {
  const actor = await assertAdminActor(input.actorUserId);
  const persistence = resolveAdminNotificationPersistenceAdapter();
  const count = await persistence.countByRecipient(actor.userId);
  return { count };
}

export async function deleteAdminNotificationForActor(input: {
  actorUserId: string;
  adminNotificationId: string;
}): Promise<{ deleted: boolean }> {
  const actor = await assertAdminActor(input.actorUserId);
  const adminNotificationId = input.adminNotificationId.trim();
  if (!adminNotificationId) {
    throw new AdministrationValidationError("adminNotificationId is required.");
  }

  const persistence = resolveAdminNotificationPersistenceAdapter();
  const deleted = await persistence.deleteOwned({
    adminNotificationId,
    recipientAdminUserId: actor.userId,
  });

  // Idempotent: missing/non-owned rows return deleted:false without error.
  return { deleted };
}
