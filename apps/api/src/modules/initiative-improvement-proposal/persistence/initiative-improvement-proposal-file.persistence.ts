import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createEmptyInitiativeImprovementProposalPersistenceSnapshot,
  type InitiativeImprovementProposalPersistenceAdapter,
  type InitiativeImprovementProposalPersistenceSnapshot,
} from "./initiative-improvement-proposal-persistence.types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUNTIME_DIR = path.resolve(MODULE_DIR, "../../../../.runtime");
const DEFAULT_FILE_PATH = path.join(DEFAULT_RUNTIME_DIR, "initiative-improvement-proposals.json");

function isPersistenceSnapshot(
  value: unknown,
): value is InitiativeImprovementProposalPersistenceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as InitiativeImprovementProposalPersistenceSnapshot;

  return record.version === 1 && typeof record.proposals === "object" && record.proposals !== null;
}

export class FileInitiativeImprovementProposalPersistenceAdapter implements InitiativeImprovementProposalPersistenceAdapter {
  readonly mode = "file" as const;

  constructor(private readonly filePath: string = DEFAULT_FILE_PATH) {}

  load(): InitiativeImprovementProposalPersistenceSnapshot {
    if (!fs.existsSync(this.filePath)) {
      return createEmptyInitiativeImprovementProposalPersistenceSnapshot();
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isPersistenceSnapshot(parsed)) {
        return createEmptyInitiativeImprovementProposalPersistenceSnapshot();
      }

      return parsed;
    } catch {
      return createEmptyInitiativeImprovementProposalPersistenceSnapshot();
    }
  }

  save(snapshot: InitiativeImprovementProposalPersistenceSnapshot): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });

    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    fs.renameSync(tempPath, this.filePath);
  }
}

export function resolveInitiativeImprovementProposalPersistenceFilePath(): string {
  return process.env.INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE_PATH ?? DEFAULT_FILE_PATH;
}

export function createFileInitiativeImprovementProposalPersistenceAdapter(): FileInitiativeImprovementProposalPersistenceAdapter {
  return new FileInitiativeImprovementProposalPersistenceAdapter(
    resolveInitiativeImprovementProposalPersistenceFilePath(),
  );
}
