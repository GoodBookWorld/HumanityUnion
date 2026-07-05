import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativeCollaborativeAnalysisPersistenceSnapshot,
  type InitiativeCollaborativeAnalysisPersistenceAdapter,
  type InitiativeCollaborativeAnalysisPersistenceSnapshot,
} from "./initiative-collaborative-analysis-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "initiative-analyses.json");

function isPersistenceSnapshot(
  value: unknown,
): value is InitiativeCollaborativeAnalysisPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativeCollaborativeAnalysisPersistenceSnapshot;

  return record.version === 1 && typeof record.analyses === "object" && record.analyses !== null;
}

export class FileInitiativeCollaborativeAnalysisPersistenceAdapter implements InitiativeCollaborativeAnalysisPersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativeCollaborativeAnalysisPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativeCollaborativeAnalysisPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativeCollaborativeAnalysisPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativeCollaborativeAnalysisPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativeCollaborativeAnalysisPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function resolveInitiativeCollaborativeAnalysisPersistenceFilePath(): string {
  return process.env.INITIATIVE_ANALYSIS_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFileInitiativeCollaborativeAnalysisPersistenceAdapter(): FileInitiativeCollaborativeAnalysisPersistenceAdapter {
  return new FileInitiativeCollaborativeAnalysisPersistenceAdapter(
    resolveInitiativeCollaborativeAnalysisPersistenceFilePath(),
  );
}
