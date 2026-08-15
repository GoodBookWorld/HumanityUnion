import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot,
  type InitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter,
  type InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot,
} from "./initiative-implementation-commitment-lifecycle-draft-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(
  DEFAULT_RUNTIME_DIR,
  "initiative-implementation-commitment-lifecycle-drafts.json",
);

function isPersistenceSnapshot(
  value: unknown,
): value is InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot;

  return record.version === 1 && typeof record.drafts === "object" && record.drafts !== null;
}

export class FileInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter
  implements InitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter
{
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativeImplementationCommitmentLifecycleDraftPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function createFileInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter(): FileInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter {
  return new FileInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter(
    process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_LIFECYCLE_DRAFT_PERSISTENCE_PATH ??
      DEFAULT_FILE_PATH,
  );
}
