import { MemoryCivicDeliveryPersistenceAdapter } from "./civic-delivery-memory.persistence.js";
import { FileCivicDeliveryPersistenceAdapter } from "./civic-delivery-file.persistence.js";
import type { CivicDeliveryPersistenceAdapter } from "./civic-delivery-persistence.types.js";

export function resolveCivicDeliveryPersistenceAdapter(): CivicDeliveryPersistenceAdapter {
  const mode = process.env.CIVIC_DELIVERY_PERSISTENCE ?? "file";

  if (mode === "memory") {
    return new MemoryCivicDeliveryPersistenceAdapter();
  }

  const filePath = process.env.CIVIC_DELIVERY_PERSISTENCE_PATH;

  return filePath
    ? new FileCivicDeliveryPersistenceAdapter(filePath)
    : new FileCivicDeliveryPersistenceAdapter();
}
