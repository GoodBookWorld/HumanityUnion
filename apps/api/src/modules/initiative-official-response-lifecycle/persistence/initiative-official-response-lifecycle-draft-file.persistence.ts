import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativeOfficialResponseLifecycleDraftPersistenceSnapshot,
  type InitiativeOfficialResponseLifecycleDraftPersistenceAdapter,
  type InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot,
} from "./initiative-official-response-lifecycle-draft-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(
  DEFAULT_RUNTIME_DIR,
  "initiative-official-response-lifecycle-drafts.json",
);

function isPersistenceSnapshot(
  value: unknown,
): value is InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot;

  return record.version === 1 && typeof record.drafts === "object" && record.drafts !== null;
}

export class FileInitiativeOfficialResponseLifecycleDraftPersistenceAdapter
  implements InitiativeOfficialResponseLifecycleDraftPersistenceAdapter
{
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativeOfficialResponseLifecycleDraftPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativeOfficialResponseLifecycleDraftPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativeOfficialResponseLifecycleDraftPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativeOfficialResponseLifecycleDraftPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function createFileInitiativeOfficialResponseLifecycleDraftPersistenceAdapter(): FileInitiativeOfficialResponseLifecycleDraftPersistenceAdapter {
  return new FileInitiativeOfficialResponseLifecycleDraftPersistenceAdapter(
    process.env.INITIATIVE_OFFICIAL_RESPONSE_LIFECYCLE_DRAFT_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH,
  );
}
