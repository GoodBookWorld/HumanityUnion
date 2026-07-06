import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativeCollectiveDecisionPersistenceSnapshot,
  type InitiativeCollectiveDecisionPersistenceAdapter,
  type InitiativeCollectiveDecisionPersistenceSnapshot,
} from "./initiative-collective-decision-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "initiative-collective-decisions.json");

function isPersistenceSnapshot(
  value: unknown,
): value is InitiativeCollectiveDecisionPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativeCollectiveDecisionPersistenceSnapshot;

  return record.version === 1 && typeof record.decisions === "object" && record.decisions !== null;
}

export class FileInitiativeCollectiveDecisionPersistenceAdapter implements InitiativeCollectiveDecisionPersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativeCollectiveDecisionPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativeCollectiveDecisionPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativeCollectiveDecisionPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativeCollectiveDecisionPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativeCollectiveDecisionPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function resolveInitiativeCollectiveDecisionPersistenceFilePath(): string {
  return process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFileInitiativeCollectiveDecisionPersistenceAdapter(): FileInitiativeCollectiveDecisionPersistenceAdapter {
  return new FileInitiativeCollectiveDecisionPersistenceAdapter(
    resolveInitiativeCollectiveDecisionPersistenceFilePath(),
  );
}
