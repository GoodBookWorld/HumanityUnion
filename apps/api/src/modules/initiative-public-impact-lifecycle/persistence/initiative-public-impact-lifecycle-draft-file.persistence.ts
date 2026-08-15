import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativePublicImpactLifecycleDraftPersistenceSnapshot,
  type InitiativePublicImpactLifecycleDraftPersistenceAdapter,
  type InitiativePublicImpactLifecycleDraftPersistenceSnapshot,
} from "./initiative-public-impact-lifecycle-draft-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(
  DEFAULT_RUNTIME_DIR,
  "initiative-public-impact-lifecycle-drafts.json",
);

function isPersistenceSnapshot(
  value: unknown,
): value is InitiativePublicImpactLifecycleDraftPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativePublicImpactLifecycleDraftPersistenceSnapshot;

  return record.version === 1 && typeof record.drafts === "object" && record.drafts !== null;
}

export class FileInitiativePublicImpactLifecycleDraftPersistenceAdapter
  implements InitiativePublicImpactLifecycleDraftPersistenceAdapter
{
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativePublicImpactLifecycleDraftPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativePublicImpactLifecycleDraftPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativePublicImpactLifecycleDraftPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativePublicImpactLifecycleDraftPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativePublicImpactLifecycleDraftPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function createFileInitiativePublicImpactLifecycleDraftPersistenceAdapter(): FileInitiativePublicImpactLifecycleDraftPersistenceAdapter {
  return new FileInitiativePublicImpactLifecycleDraftPersistenceAdapter(
    process.env.INITIATIVE_PUBLIC_IMPACT_LIFECYCLE_DRAFT_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH,
  );
}
