import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativeDecisionVotePersistenceSnapshot,
  type InitiativeDecisionVotePersistenceAdapter,
  type InitiativeDecisionVotePersistenceSnapshot,
} from "./initiative-decision-vote-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "initiative-decision-votes.json");

function isPersistenceSnapshot(value: unknown): value is InitiativeDecisionVotePersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativeDecisionVotePersistenceSnapshot;

  return (
    record.version === 1 &&
    typeof record.votes === "object" &&
    record.votes !== null &&
    typeof record.history === "object" &&
    record.history !== null
  );
}

export class FileInitiativeDecisionVotePersistenceAdapter implements InitiativeDecisionVotePersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativeDecisionVotePersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativeDecisionVotePersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativeDecisionVotePersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativeDecisionVotePersistenceSnapshot();
    }
  }

  save(snapshot: InitiativeDecisionVotePersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function resolveInitiativeDecisionVotePersistenceFilePath(): string {
  return process.env.INITIATIVE_DECISION_VOTE_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFileInitiativeDecisionVotePersistenceAdapter(): FileInitiativeDecisionVotePersistenceAdapter {
  return new FileInitiativeDecisionVotePersistenceAdapter(
    resolveInitiativeDecisionVotePersistenceFilePath(),
  );
}
