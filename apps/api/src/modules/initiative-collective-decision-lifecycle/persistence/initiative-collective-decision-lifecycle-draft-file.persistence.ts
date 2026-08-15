import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot,
  type InitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter,
  type InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot,
} from "./initiative-collective-decision-lifecycle-draft-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(
  DEFAULT_RUNTIME_DIR,
  "initiative-collective-decision-lifecycle-drafts.json",
);

function isPersistenceSnapshot(
  value: unknown,
): value is InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot;

  return record.version === 1 && typeof record.drafts === "object" && record.drafts !== null;
}

export class FileInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter
  implements InitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter
{
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativeCollectiveDecisionLifecycleDraftPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function createFileInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter(): FileInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter {
  return new FileInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter(
    process.env.INITIATIVE_COLLECTIVE_DECISION_LIFECYCLE_DRAFT_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH,
  );
}
