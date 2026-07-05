import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativeVersionRevisionPersistenceSnapshot,
  type InitiativeVersionRevisionPersistenceAdapter,
  type InitiativeVersionRevisionPersistenceSnapshot,
} from "./initiative-version-revision-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "initiative-version-revisions.json");

function isPersistenceSnapshot(
  value: unknown,
): value is InitiativeVersionRevisionPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativeVersionRevisionPersistenceSnapshot;

  return (
    record.version === 1 &&
    typeof record.revisions === "object" &&
    record.revisions !== null &&
    typeof record.drafts === "object" &&
    record.drafts !== null
  );
}

export class FileInitiativeVersionRevisionPersistenceAdapter implements InitiativeVersionRevisionPersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativeVersionRevisionPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativeVersionRevisionPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativeVersionRevisionPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativeVersionRevisionPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativeVersionRevisionPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function createFileInitiativeVersionRevisionPersistenceAdapter(): FileInitiativeVersionRevisionPersistenceAdapter {
  return new FileInitiativeVersionRevisionPersistenceAdapter();
}
