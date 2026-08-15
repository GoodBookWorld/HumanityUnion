import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot,
  type InitiativeImplementationTrackingLifecycleDraftPersistenceAdapter,
  type InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot,
} from "./initiative-implementation-tracking-lifecycle-draft-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(
  DEFAULT_RUNTIME_DIR,
  "initiative-implementation-tracking-lifecycle-drafts.json",
);

function isPersistenceSnapshot(
  value: unknown,
): value is InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot;

  return record.version === 1 && typeof record.drafts === "object" && record.drafts !== null;
}

export class FileInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter
  implements InitiativeImplementationTrackingLifecycleDraftPersistenceAdapter
{
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativeImplementationTrackingLifecycleDraftPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function createFileInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter(): FileInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter {
  return new FileInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter(
    process.env.INITIATIVE_IMPLEMENTATION_TRACKING_LIFECYCLE_DRAFT_PERSISTENCE_PATH ??
      DEFAULT_FILE_PATH,
  );
}
