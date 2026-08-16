import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  APPROVED_INITIATIVE_IDS,
  PORTABLE_RECONCILIATION_SOURCE_RELATIVE_PATH,
} from "./constants.js";
import { StagingReconciliationError } from "./guards.js";

export interface AuthRecoveryParticipantMeta {
  key: string;
  userId: string;
  memberId: string;
  emailDomain: string | null;
  displayName: string;
  role: string;
  status: string;
  sourceEmailVerificationStatus: "pending" | "verified" | string;
  sourceEmailVerifiedAt: string | null;
  hashAlgorithmExpected: string;
}

export interface ReconciliationPortableBundle {
  bundleDir: string;
  manifest: {
    version: number;
    pack: string;
    counts: Record<string, number>;
    byInitiative: Record<string, Record<string, number>>;
    files: Record<string, string>;
    approvedInitiativeIds: string[];
  };
  authRecovery: { version: number; strategy: string; participants: AuthRecoveryParticipantMeta[] };
  comments: { version: number; records: Array<Record<string, unknown>> };
  commentReactions: { version: number; records: Array<Record<string, unknown>> };
  analysisReactions: { version: number; records: Array<Record<string, unknown>> };
  supportSignals: {
    version: number;
    registered: Array<Record<string, unknown>>;
    visitor: Array<Record<string, unknown>>;
  };
  bookmarks: { version: number; records: Array<Record<string, unknown>> };
  views: { version: number; records: Array<Record<string, unknown>> };
  participantActions: { version: number; records: Array<Record<string, unknown>>; note?: string };
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function resolveRepoRoot(fromDir: string): string {
  let current = path.resolve(fromDir);
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(fromDir, "../../..");
}

export function resolveReconciliationBundleDir(
  repoRoot: string,
  overrideDir?: string,
): string {
  if (overrideDir?.trim()) {
    return path.resolve(overrideDir);
  }
  return path.join(repoRoot, PORTABLE_RECONCILIATION_SOURCE_RELATIVE_PATH);
}

export function loadAndValidateReconciliationBundle(
  bundleDir: string,
): ReconciliationPortableBundle {
  const manifestPath = path.join(bundleDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new StagingReconciliationError(
      `Portable reconciliation bundle missing (expected ${PORTABLE_RECONCILIATION_SOURCE_RELATIVE_PATH}/manifest.json).`,
    );
  }

  const manifest = readJson<ReconciliationPortableBundle["manifest"]>(manifestPath);

  for (const [name, expected] of Object.entries(manifest.files ?? {})) {
    const filePath = path.join(bundleDir, name);
    if (!fs.existsSync(filePath)) {
      throw new StagingReconciliationError(`Missing reconciliation bundle file: ${name}`);
    }
    const actual = sha256File(filePath);
    if (actual !== expected) {
      throw new StagingReconciliationError(
        `Checksum mismatch for ${name}: expected ${expected.slice(0, 12)}… got ${actual.slice(0, 12)}…`,
      );
    }
  }

  const approved = new Set(manifest.approvedInitiativeIds ?? [...APPROVED_INITIATIVE_IDS]);

  const comments = readJson<ReconciliationPortableBundle["comments"]>(
    path.join(bundleDir, "initiative-comments.json"),
  );
  const commentReactions = readJson<ReconciliationPortableBundle["commentReactions"]>(
    path.join(bundleDir, "initiative-comment-reactions.json"),
  );
  const analysisReactions = readJson<ReconciliationPortableBundle["analysisReactions"]>(
    path.join(bundleDir, "initiative-analysis-reactions.json"),
  );
  const supportSignals = readJson<ReconciliationPortableBundle["supportSignals"]>(
    path.join(bundleDir, "initiative-support-signals.json"),
  );
  const bookmarks = readJson<ReconciliationPortableBundle["bookmarks"]>(
    path.join(bundleDir, "initiative-bookmarks.json"),
  );
  const views = readJson<ReconciliationPortableBundle["views"]>(
    path.join(bundleDir, "initiative-views.json"),
  );
  const participantActions = readJson<ReconciliationPortableBundle["participantActions"]>(
    path.join(bundleDir, "participant-actions.json"),
  );
  const authRecovery = readJson<ReconciliationPortableBundle["authRecovery"]>(
    path.join(bundleDir, "auth-recovery.json"),
  );

  const assertScoped = (label: string, records: Array<Record<string, unknown>>) => {
    for (const record of records) {
      const initiativeId = String(record.initiativeId ?? "");
      if (initiativeId && !approved.has(initiativeId)) {
        throw new StagingReconciliationError(
          `${label} contains non-approved initiativeId ${initiativeId}`,
        );
      }
    }
  };

  assertScoped("comments", comments.records);
  assertScoped("commentReactions", commentReactions.records);
  assertScoped("analysisReactions", analysisReactions.records);
  assertScoped("supportRegistered", supportSignals.registered);
  assertScoped("supportVisitor", supportSignals.visitor);
  assertScoped("bookmarks", bookmarks.records);
  assertScoped("views", views.records);

  if (authRecovery.participants.some((p) => "passwordHash" in (p as object))) {
    throw new StagingReconciliationError(
      "auth-recovery.json must never contain passwordHash fields.",
    );
  }

  return {
    bundleDir,
    manifest,
    authRecovery,
    comments,
    commentReactions,
    analysisReactions,
    supportSignals,
    bookmarks,
    views,
    participantActions,
  };
}
