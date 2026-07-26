import type { NotificationPersistenceAdapter } from "../notification.types.js";
import { createMemoryNotificationPersistenceAdapter } from "./notification-memory.persistence.js";
import { createMongoNotificationPersistenceAdapter } from "./notification-mongo.persistence.js";

export function resolveNotificationPersistenceAdapter(): NotificationPersistenceAdapter {
  const mode = process.env.NOTIFICATION_PERSISTENCE ?? "memory";

  if (mode === "mongodb") {
    return createMongoNotificationPersistenceAdapter();
  }

  return createMemoryNotificationPersistenceAdapter();
}
