import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyCivicActionPackagePersistenceSnapshot,
  type CivicActionPackagePersistenceAdapter,
  type CivicActionPackagePersistenceSnapshot,
} from "./civic-action-package-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "civic-action-packages.json");

function isPersistenceSnapshot(value: unknown): value is CivicActionPackagePersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as CivicActionPackagePersistenceSnapshot;

  return record.version === 1 && typeof record.packages === "object" && record.packages !== null;
}

export class FileCivicActionPackagePersistenceAdapter implements CivicActionPackagePersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): CivicActionPackagePersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyCivicActionPackagePersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyCivicActionPackagePersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyCivicActionPackagePersistenceSnapshot();
    }
  }

  save(snapshot: CivicActionPackagePersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    const tempPath = `${this.filePath}.tmp`;

    fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}
