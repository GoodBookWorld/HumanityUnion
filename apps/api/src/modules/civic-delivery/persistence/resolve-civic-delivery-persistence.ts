import { MemoryCivicDeliveryPersistenceAdapter } from "./civic-delivery-memory.persistence.js";
import { FileCivicDeliveryPersistenceAdapter } from "./civic-delivery-file.persistence.js";
import { createMongoCivicDeliveryPersistenceAdapter } from "./civic-delivery-mongo.persistence.js";
import type { CivicDeliveryPersistenceAdapter } from "./civic-delivery-persistence.types.js";

export function resolveCivicDeliveryPersistenceAdapter(): CivicDeliveryPersistenceAdapter {
  const mode = process.env.CIVIC_DELIVERY_PERSISTENCE ?? "file";

  switch (mode) {
    case "memory":
      return new MemoryCivicDeliveryPersistenceAdapter();
    case "mongodb":
      return createMongoCivicDeliveryPersistenceAdapter();
    case "file":
    default: {
      const filePath = process.env.CIVIC_DELIVERY_PERSISTENCE_PATH;

      return filePath
        ? new FileCivicDeliveryPersistenceAdapter(filePath)
        : new FileCivicDeliveryPersistenceAdapter();
    }
  }
}
