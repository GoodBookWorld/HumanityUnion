import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativeCivicArchiveLifecycleDraftPersistenceSnapshot,
  type InitiativeCivicArchiveLifecycleDraftPersistenceAdapter,
  type InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot,
} from "./initiative-civic-archive-lifecycle-draft-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(
  DEFAULT_RUNTIME_DIR,
  "initiative-civic-archive-lifecycle-drafts.json",
);

function isPersistenceSnapshot(
  value: unknown,
): value is InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot;

  return record.version === 1 && typeof record.drafts === "object" && record.drafts !== null;
}

export class FileInitiativeCivicArchiveLifecycleDraftPersistenceAdapter
  implements InitiativeCivicArchiveLifecycleDraftPersistenceAdapter
{
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativeCivicArchiveLifecycleDraftPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativeCivicArchiveLifecycleDraftPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativeCivicArchiveLifecycleDraftPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativeCivicArchiveLifecycleDraftPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function createFileInitiativeCivicArchiveLifecycleDraftPersistenceAdapter(): FileInitiativeCivicArchiveLifecycleDraftPersistenceAdapter {
  return new FileInitiativeCivicArchiveLifecycleDraftPersistenceAdapter(
    process.env.INITIATIVE_CIVIC_ARCHIVE_LIFECYCLE_DRAFT_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH,
  );
}
