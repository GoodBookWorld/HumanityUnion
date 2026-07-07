import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyPublicCivicArchivePersistenceSnapshot,
  type PublicCivicArchivePersistenceAdapter,
  type PublicCivicArchivePersistenceSnapshot,
} from "./public-civic-archive-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "public-civic-archive.json");

function isPersistenceSnapshot(value: unknown): value is PublicCivicArchivePersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as PublicCivicArchivePersistenceSnapshot;

  return record.version === 1 && typeof record.records === "object" && record.records !== null;
}

export class FilePublicCivicArchivePersistenceAdapter implements PublicCivicArchivePersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): PublicCivicArchivePersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyPublicCivicArchivePersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyPublicCivicArchivePersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyPublicCivicArchivePersistenceSnapshot();
    }
  }

  save(snapshot: PublicCivicArchivePersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function resolvePublicCivicArchivePersistenceFilePath(): string {
  return process.env.PUBLIC_CIVIC_ARCHIVE_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFilePublicCivicArchivePersistenceAdapter(): PublicCivicArchivePersistenceAdapter {
  return new FilePublicCivicArchivePersistenceAdapter(
    resolvePublicCivicArchivePersistenceFilePath(),
  );
}
