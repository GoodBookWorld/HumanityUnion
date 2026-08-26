import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";
import type { AdminNotificationPersistenceAdapter } from "../admin-notification.types.js";
import { createMemoryAdminNotificationPersistenceAdapter } from "./admin-notification-memory.persistence.js";
import { createMongoAdminNotificationPersistenceAdapter } from "./admin-notification-mongo.persistence.js";

let cachedAdapter: AdminNotificationPersistenceAdapter | null = null;

export function resolveAdminNotificationPersistenceAdapter(): AdminNotificationPersistenceAdapter {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  const mode = resolvePersistenceMode("ADMIN_NOTIFICATION_PERSISTENCE", "memory");
  cachedAdapter =
    mode === "mongodb"
      ? createMongoAdminNotificationPersistenceAdapter()
      : createMemoryAdminNotificationPersistenceAdapter();
  return cachedAdapter;
}

/** Test helper — drop cached adapter so the next resolve re-reads env. */
export function resetAdminNotificationPersistenceResolverForTests(): void {
  cachedAdapter = null;
}
