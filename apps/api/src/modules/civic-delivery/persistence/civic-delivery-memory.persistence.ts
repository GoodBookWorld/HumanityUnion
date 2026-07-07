import {
  createEmptyCivicDeliveryPersistenceSnapshot,
  type CivicDeliveryPersistenceAdapter,
} from "./civic-delivery-persistence.types.js";

export class MemoryCivicDeliveryPersistenceAdapter implements CivicDeliveryPersistenceAdapter {
  readonly mode = "memory" as const;

  private snapshot = createEmptyCivicDeliveryPersistenceSnapshot();

  load() {
    return structuredClone(this.snapshot);
  }

  save(snapshot: ReturnType<MemoryCivicDeliveryPersistenceAdapter["load"]>): void {
    this.snapshot = structuredClone(snapshot);
  }
}
