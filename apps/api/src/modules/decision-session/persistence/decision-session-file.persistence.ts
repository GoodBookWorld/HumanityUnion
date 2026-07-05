import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyDecisionSessionPersistenceSnapshot,
  type DecisionSessionPersistenceAdapter,
  type DecisionSessionPersistenceSnapshot,
} from "./decision-session-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "decision-sessions.json");

function isPersistenceSnapshot(value: unknown): value is DecisionSessionPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as DecisionSessionPersistenceSnapshot;

  return record.version === 1 && typeof record.sessions === "object" && record.sessions !== null;
}

export class FileDecisionSessionPersistenceAdapter implements DecisionSessionPersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): DecisionSessionPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyDecisionSessionPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyDecisionSessionPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyDecisionSessionPersistenceSnapshot();
    }
  }

  save(snapshot: DecisionSessionPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function createFileDecisionSessionPersistenceAdapter(): FileDecisionSessionPersistenceAdapter {
  return new FileDecisionSessionPersistenceAdapter();
}
