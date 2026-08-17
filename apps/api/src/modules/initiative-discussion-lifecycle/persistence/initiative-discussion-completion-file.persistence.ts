import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativeDiscussionCompletionPersistenceSnapshot,
  type InitiativeDiscussionCompletionPersistenceAdapter,
  type InitiativeDiscussionCompletionPersistenceSnapshot,
} from "./initiative-discussion-completion-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "initiative-discussion-completions.json");

function isPersistenceSnapshot(
  value: unknown,
): value is InitiativeDiscussionCompletionPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativeDiscussionCompletionPersistenceSnapshot;
  return record.version === 1 && typeof record.completions === "object" && record.completions !== null;
}

export class FileInitiativeDiscussionCompletionPersistenceAdapter
  implements InitiativeDiscussionCompletionPersistenceAdapter
{
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativeDiscussionCompletionPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativeDiscussionCompletionPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativeDiscussionCompletionPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativeDiscussionCompletionPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativeDiscussionCompletionPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function resolveInitiativeDiscussionCompletionPersistenceFilePath(): string {
  return process.env.INITIATIVE_DISCUSSION_LIFECYCLE_COMPLETION_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFileInitiativeDiscussionCompletionPersistenceAdapter(): FileInitiativeDiscussionCompletionPersistenceAdapter {
  return new FileInitiativeDiscussionCompletionPersistenceAdapter(
    resolveInitiativeDiscussionCompletionPersistenceFilePath(),
  );
}
