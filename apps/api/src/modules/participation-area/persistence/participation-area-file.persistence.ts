import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyParticipationAreaPersistenceSnapshot,
  type ParticipationAreaPersistenceAdapter,
  type ParticipationAreaPersistenceSnapshot,
} from "./participation-area-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "participation-areas.json");

function isPersistenceSnapshot(value: unknown): value is ParticipationAreaPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as ParticipationAreaPersistenceSnapshot;

  return (
    record.version === 1 &&
    typeof record.areas === "object" &&
    record.areas !== null &&
    typeof record.transitions === "object" &&
    record.transitions !== null
  );
}

export class FileParticipationAreaPersistenceAdapter implements ParticipationAreaPersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): ParticipationAreaPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyParticipationAreaPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyParticipationAreaPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyParticipationAreaPersistenceSnapshot();
    }
  }

  save(snapshot: ParticipationAreaPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function resolveParticipationAreaPersistenceFilePath(): string {
  return process.env.PARTICIPATION_AREA_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFileParticipationAreaPersistenceAdapter(): FileParticipationAreaPersistenceAdapter {
  return new FileParticipationAreaPersistenceAdapter(resolveParticipationAreaPersistenceFilePath());
}
