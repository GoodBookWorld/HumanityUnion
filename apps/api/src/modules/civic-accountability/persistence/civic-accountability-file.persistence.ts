import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyCivicAccountabilityPersistenceSnapshot,
  type CivicAccountabilityPersistenceAdapter,
  type CivicAccountabilityPersistenceSnapshot,
} from "./civic-accountability-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "civic-accountability.json");

function isPersistenceSnapshot(value: unknown): value is CivicAccountabilityPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as CivicAccountabilityPersistenceSnapshot;

  return (
    record.version === 1 &&
    typeof record.accountabilities === "object" &&
    record.accountabilities !== null &&
    typeof record.events === "object" &&
    record.events !== null
  );
}

export class FileCivicAccountabilityPersistenceAdapter implements CivicAccountabilityPersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): CivicAccountabilityPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyCivicAccountabilityPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyCivicAccountabilityPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyCivicAccountabilityPersistenceSnapshot();
    }
  }

  save(snapshot: CivicAccountabilityPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    const tempPath = `${this.filePath}.tmp`;

    fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}
