import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativePersistenceSnapshot,
  type InitiativePersistenceAdapter,
  type InitiativePersistenceSnapshot,
} from "./initiative-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "initiatives.json");

function isPersistenceSnapshot(value: unknown): value is InitiativePersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativePersistenceSnapshot;

  return (
    record.version === 1 && typeof record.initiatives === "object" && record.initiatives !== null
  );
}

export class FileInitiativePersistenceAdapter implements InitiativePersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativePersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativePersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativePersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativePersistenceSnapshot();
    }
  }

  save(snapshot: InitiativePersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function resolveInitiativePersistenceFilePath(): string {
  return process.env.INITIATIVE_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFileInitiativePersistenceAdapter(): FileInitiativePersistenceAdapter {
  return new FileInitiativePersistenceAdapter(resolveInitiativePersistenceFilePath());
}
