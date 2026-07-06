import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativeImplementationCommitmentPersistenceSnapshot,
  type InitiativeImplementationCommitmentPersistenceAdapter,
  type InitiativeImplementationCommitmentPersistenceSnapshot,
} from "./initiative-implementation-commitment-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(
  DEFAULT_RUNTIME_DIR,
  "initiative-implementation-commitments.json",
);

function isPersistenceSnapshot(
  value: unknown,
): value is InitiativeImplementationCommitmentPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativeImplementationCommitmentPersistenceSnapshot;

  return (
    record.version === 1 && typeof record.commitments === "object" && record.commitments !== null
  );
}

export class FileInitiativeImplementationCommitmentPersistenceAdapter implements InitiativeImplementationCommitmentPersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativeImplementationCommitmentPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativeImplementationCommitmentPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativeImplementationCommitmentPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativeImplementationCommitmentPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativeImplementationCommitmentPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function resolveInitiativeImplementationCommitmentPersistenceFilePath(): string {
  return process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFileInitiativeImplementationCommitmentPersistenceAdapter(): FileInitiativeImplementationCommitmentPersistenceAdapter {
  return new FileInitiativeImplementationCommitmentPersistenceAdapter(
    resolveInitiativeImplementationCommitmentPersistenceFilePath(),
  );
}
