import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativePetitionDraftPersistenceSnapshot,
  type InitiativePetitionDraftPersistenceAdapter,
  type InitiativePetitionDraftPersistenceSnapshot,
} from "./initiative-petition-draft-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "initiative-petition-drafts.json");

function isPersistenceSnapshot(value: unknown): value is InitiativePetitionDraftPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativePetitionDraftPersistenceSnapshot;

  return record.version === 1 && typeof record.drafts === "object" && record.drafts !== null;
}

export class FileInitiativePetitionDraftPersistenceAdapter
  implements InitiativePetitionDraftPersistenceAdapter
{
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativePetitionDraftPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativePetitionDraftPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativePetitionDraftPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativePetitionDraftPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativePetitionDraftPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function resolveInitiativePetitionDraftPersistenceFilePath(): string {
  return process.env.INITIATIVE_PETITION_DRAFT_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFileInitiativePetitionDraftPersistenceAdapter(): FileInitiativePetitionDraftPersistenceAdapter {
  return new FileInitiativePetitionDraftPersistenceAdapter(
    resolveInitiativePetitionDraftPersistenceFilePath(),
  );
}
