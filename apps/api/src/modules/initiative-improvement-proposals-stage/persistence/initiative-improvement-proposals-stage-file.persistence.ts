import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { InitiativeImprovementProposalsCollection } from "@hu/types";

import type { InitiativeImprovementProposalsStagePersistenceAdapter } from "./initiative-improvement-proposals-stage.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(
  DEFAULT_RUNTIME_DIR,
  "initiative-improvement-proposals-collections.json",
);

interface FileSnapshot {
  version: 1;
  collections: Record<string, InitiativeImprovementProposalsCollection>;
}

function createEmptySnapshot(): FileSnapshot {
  return { version: 1, collections: {} };
}

function isSnapshot(value: unknown): value is FileSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as FileSnapshot;
  return record.version === 1 && typeof record.collections === "object" && record.collections !== null;
}

/**
 * Local durable default for non-production. Production/staging force mongodb
 * via production-persistence-contract (durable key).
 */
export class FileInitiativeImprovementProposalsStagePersistenceAdapter
  implements InitiativeImprovementProposalsStagePersistenceAdapter
{
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  private load(): FileSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptySnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      return isSnapshot(parsed) ? parsed : createEmptySnapshot();
    } catch {
      return createEmptySnapshot();
    }
  }

  private save(snapshot: FileSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }

  findById(collectionId: string): Promise<InitiativeImprovementProposalsCollection | null> {
    const collection = this.load().collections[collectionId];
    return Promise.resolve(collection ? structuredClone(collection) : null);
  }

  listByInitiativeAndAuthor(
    initiativeId: string,
    authorId: string,
  ): Promise<InitiativeImprovementProposalsCollection[]> {
    return Promise.resolve(
      Object.values(this.load().collections)
        .filter(
          (collection) =>
            collection.initiativeId === initiativeId && collection.authorId === authorId,
        )
        .map((collection) => structuredClone(collection)),
    );
  }

  listByInitiative(initiativeId: string): Promise<InitiativeImprovementProposalsCollection[]> {
    return Promise.resolve(
      Object.values(this.load().collections)
        .filter((collection) => collection.initiativeId === initiativeId)
        .map((collection) => structuredClone(collection)),
    );
  }

  insert(collection: InitiativeImprovementProposalsCollection): Promise<void> {
    const snapshot = this.load();
    snapshot.collections[collection.collectionId] = structuredClone(collection);
    this.save(snapshot);
    return Promise.resolve();
  }

  update(collection: InitiativeImprovementProposalsCollection): Promise<void> {
    const snapshot = this.load();
    snapshot.collections[collection.collectionId] = structuredClone(collection);
    this.save(snapshot);
    return Promise.resolve();
  }

  deleteByAuthorIdForTests(authorId: string): Promise<number> {
    const snapshot = this.load();
    let deleted = 0;

    for (const [collectionId, collection] of Object.entries(snapshot.collections)) {
      if (collection.authorId === authorId) {
        delete snapshot.collections[collectionId];
        deleted += 1;
      }
    }

    this.save(snapshot);
    return Promise.resolve(deleted);
  }
}

export function resolveInitiativeImprovementProposalsStagePersistenceFilePath(): string {
  return process.env.INITIATIVE_IMPROVEMENT_PROPOSALS_STAGE_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFileInitiativeImprovementProposalsStagePersistenceAdapter(): FileInitiativeImprovementProposalsStagePersistenceAdapter {
  return new FileInitiativeImprovementProposalsStagePersistenceAdapter(
    resolveInitiativeImprovementProposalsStagePersistenceFilePath(),
  );
}
