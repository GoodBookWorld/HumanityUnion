import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyCivicDeliveryPersistenceSnapshot,
  type CivicDeliveryPersistenceAdapter,
  type CivicDeliveryPersistenceSnapshot,
} from "./civic-delivery-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "civic-deliveries.json");

function isPersistenceSnapshot(value: unknown): value is CivicDeliveryPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as CivicDeliveryPersistenceSnapshot;

  return (
    record.version === 1 &&
    typeof record.deliveries === "object" &&
    record.deliveries !== null &&
    typeof record.recipients === "object" &&
    record.recipients !== null
  );
}

export class FileCivicDeliveryPersistenceAdapter implements CivicDeliveryPersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): CivicDeliveryPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyCivicDeliveryPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyCivicDeliveryPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyCivicDeliveryPersistenceSnapshot();
    }
  }

  save(snapshot: CivicDeliveryPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    const tempPath = `${this.filePath}.tmp`;

    fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}
