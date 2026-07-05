import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyCivicCompatibilityReviewPersistenceSnapshot,
  type CivicCompatibilityReviewPersistenceAdapter,
  type CivicCompatibilityReviewPersistenceSnapshot,
} from "./civic-compatibility-review-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "civic-compatibility-reviews.json");

function isPersistenceSnapshot(
  value: unknown,
): value is CivicCompatibilityReviewPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as CivicCompatibilityReviewPersistenceSnapshot;

  return record.version === 1 && typeof record.reviews === "object" && record.reviews !== null;
}

export class FileCivicCompatibilityReviewPersistenceAdapter implements CivicCompatibilityReviewPersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): CivicCompatibilityReviewPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyCivicCompatibilityReviewPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyCivicCompatibilityReviewPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyCivicCompatibilityReviewPersistenceSnapshot();
    }
  }

  save(snapshot: CivicCompatibilityReviewPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function resolveCivicCompatibilityReviewPersistenceFilePath(): string {
  return process.env.CIVIC_COMPATIBILITY_REVIEW_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFileCivicCompatibilityReviewPersistenceAdapter(): FileCivicCompatibilityReviewPersistenceAdapter {
  return new FileCivicCompatibilityReviewPersistenceAdapter(
    resolveCivicCompatibilityReviewPersistenceFilePath(),
  );
}
