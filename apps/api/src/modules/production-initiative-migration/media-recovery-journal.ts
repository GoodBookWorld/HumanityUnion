import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ProductionInitiativeMigrationError } from "./errors.js";

/**
 * Durable recovery metadata for R2 objects physically created by a migration run.
 * Survives process death; contains no credentials or private PII.
 */
export interface SafeMediaRecoveryEntry {
  migrationExecutionId: string;
  storageKey: string;
  destinationUrl: string;
  contentSha256: string;
  contentLength: number;
  contentType: string | null;
  createdAt: string;
  status: "created";
}

export interface MediaRecoveryJournal {
  recordCreated(entry: SafeMediaRecoveryEntry): Promise<void>;
  listCreated(migrationExecutionId: string): Promise<SafeMediaRecoveryEntry[]>;
}

export const MEDIA_RECOVERY_JOURNAL_PATH_ENV =
  "PRODUCTION_INITIATIVE_MIGRATION_MEDIA_RECOVERY_JOURNAL_PATH" as const;

/** Crash-safe phase order — Mongo must not commit rewritten public media URLs before E1. */
export const CRASH_SAFE_EXECUTION_ORDER = [
  "A_identity",
  "B_membership",
  "E1_r2_copy_verify",
  "C_initiative_roots",
  "D_civic_artifacts",
  "E2_media_upload_records",
  "F_projections",
] as const;

export function assertSafeRecoveryEntry(entry: SafeMediaRecoveryEntry): void {
  if (!entry.migrationExecutionId?.startsWith("mig_")) {
    throw new ProductionInitiativeMigrationError(
      "Recovery entry missing migrationExecutionId.",
      "RECOVERY_ENTRY_INVALID",
    );
  }
  if (!entry.storageKey || entry.storageKey.includes("..")) {
    throw new ProductionInitiativeMigrationError(
      "Recovery entry invalid storageKey.",
      "RECOVERY_ENTRY_INVALID",
    );
  }
  if (!/^[a-f0-9]{64}$/i.test(entry.contentSha256)) {
    throw new ProductionInitiativeMigrationError(
      "Recovery entry requires contentSha256.",
      "RECOVERY_ENTRY_INVALID",
    );
  }
  const text = JSON.stringify(entry);
  if (/SECRET|ACCESS_KEY|password|shippingAddress/i.test(text)) {
    throw new ProductionInitiativeMigrationError(
      "Recovery entry must not contain credential or private fields.",
      "RECOVERY_ENTRY_UNSAFE",
    );
  }
}

export class InMemoryMediaRecoveryJournal implements MediaRecoveryJournal {
  readonly entries: SafeMediaRecoveryEntry[] = [];

  async recordCreated(entry: SafeMediaRecoveryEntry): Promise<void> {
    assertSafeRecoveryEntry(entry);
    this.entries.push(entry);
  }

  async listCreated(migrationExecutionId: string): Promise<SafeMediaRecoveryEntry[]> {
    return this.entries.filter((row) => row.migrationExecutionId === migrationExecutionId);
  }
}

/**
 * Optional append-only JSONL diagnostic mirror on local disk.
 * NOT the durability mechanism for production execute (use destination Mongo recovery store).
 */
export class JsonlMediaRecoveryJournal implements MediaRecoveryJournal {
  constructor(private readonly filePath: string) {
    if (!filePath.trim()) {
      throw new ProductionInitiativeMigrationError(
        "JSONL recovery journal path empty.",
        "RECOVERY_JOURNAL_PATH_INVALID",
      );
    }
  }

  /** Optional: returns null when env path unset (production uses Mongo durability). */
  static tryFromEnv(env: NodeJS.ProcessEnv = process.env): JsonlMediaRecoveryJournal | null {
    const filePath = env[MEDIA_RECOVERY_JOURNAL_PATH_ENV]?.trim() ?? "";
    if (!filePath) return null;
    return new JsonlMediaRecoveryJournal(filePath);
  }

  async recordCreated(entry: SafeMediaRecoveryEntry): Promise<void> {
    assertSafeRecoveryEntry(entry);
    const dir = path.dirname(this.filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.appendFile(this.filePath, `${JSON.stringify(entry)}\n`, "utf8");
  }

  async listCreated(migrationExecutionId: string): Promise<SafeMediaRecoveryEntry[]> {
    try {
      const raw = await fs.promises.readFile(this.filePath, "utf8");
      return raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as SafeMediaRecoveryEntry)
        .filter((row) => row.migrationExecutionId === migrationExecutionId);
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      if (code === "ENOENT") return [];
      throw error;
    }
  }
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
