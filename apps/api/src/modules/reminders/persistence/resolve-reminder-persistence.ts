import type { ReminderPersistenceAdapter } from "../reminder.types.js";
import { createMemoryReminderPersistenceAdapter } from "./reminder-memory.persistence.js";
import { createMongoReminderPersistenceAdapter } from "./reminder-mongo.persistence.js";
import { resolvePersistenceMode } from "../../../config/production-persistence-contract.js";


/** Mirrors `resolve-notification-persistence.ts` — same env-driven memory/mongodb selection, same default. */
export function resolveReminderPersistenceAdapter(): ReminderPersistenceAdapter {
  const mode = resolvePersistenceMode("REMINDER_PERSISTENCE", "memory");

  if (mode === "mongodb") {
    return createMongoReminderPersistenceAdapter();
  }

  return createMemoryReminderPersistenceAdapter();
}
