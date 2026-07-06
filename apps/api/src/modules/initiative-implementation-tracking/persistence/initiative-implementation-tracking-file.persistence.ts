import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativeImplementationTrackingPersistenceSnapshot,
  type InitiativeImplementationTrackingPersistenceAdapter,
  type InitiativeImplementationTrackingPersistenceSnapshot,
} from "./initiative-implementation-tracking-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "initiative-implementation-tracking.json");

function isPersistenceSnapshot(
  value: unknown,
): value is InitiativeImplementationTrackingPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativeImplementationTrackingPersistenceSnapshot;

  return (
    record.version === 1 &&
    typeof record.trackings === "object" &&
    record.trackings !== null &&
    typeof record.updates === "object" &&
    record.updates !== null
  );
}

export class FileInitiativeImplementationTrackingPersistenceAdapter implements InitiativeImplementationTrackingPersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativeImplementationTrackingPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativeImplementationTrackingPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativeImplementationTrackingPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativeImplementationTrackingPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativeImplementationTrackingPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function resolveInitiativeImplementationTrackingPersistenceFilePath(): string {
  return process.env.INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFileInitiativeImplementationTrackingPersistenceAdapter(): FileInitiativeImplementationTrackingPersistenceAdapter {
  return new FileInitiativeImplementationTrackingPersistenceAdapter(
    resolveInitiativeImplementationTrackingPersistenceFilePath(),
  );
}
