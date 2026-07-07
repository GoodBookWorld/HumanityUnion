import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyOfficialResponsePersistenceSnapshot,
  type OfficialResponsePersistenceAdapter,
  type OfficialResponsePersistenceSnapshot,
} from "./official-response-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "official-responses.json");

function isPersistenceSnapshot(value: unknown): value is OfficialResponsePersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as OfficialResponsePersistenceSnapshot;

  return (
    record.version === 1 &&
    typeof record.responses === "object" &&
    record.responses !== null &&
    typeof record.identities === "object" &&
    record.identities !== null
  );
}

export class FileOfficialResponsePersistenceAdapter implements OfficialResponsePersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): OfficialResponsePersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyOfficialResponsePersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyOfficialResponsePersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyOfficialResponsePersistenceSnapshot();
    }
  }

  save(snapshot: OfficialResponsePersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    const tempPath = `${this.filePath}.tmp`;

    fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}
