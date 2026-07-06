import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativePublicImpactPersistenceSnapshot,
  type InitiativePublicImpactPersistenceAdapter,
  type InitiativePublicImpactPersistenceSnapshot,
} from "./initiative-public-impact-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "initiative-public-impact.json");

function isPersistenceSnapshot(value: unknown): value is InitiativePublicImpactPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativePublicImpactPersistenceSnapshot;

  return (
    record.version === 1 &&
    typeof record.impacts === "object" &&
    record.impacts !== null &&
    typeof record.evidence === "object" &&
    record.evidence !== null
  );
}

export class FileInitiativePublicImpactPersistenceAdapter implements InitiativePublicImpactPersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativePublicImpactPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativePublicImpactPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativePublicImpactPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativePublicImpactPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativePublicImpactPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function resolveInitiativePublicImpactPersistenceFilePath(): string {
  return process.env.INITIATIVE_PUBLIC_IMPACT_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFileInitiativePublicImpactPersistenceAdapter(): FileInitiativePublicImpactPersistenceAdapter {
  return new FileInitiativePublicImpactPersistenceAdapter(
    resolveInitiativePublicImpactPersistenceFilePath(),
  );
}
