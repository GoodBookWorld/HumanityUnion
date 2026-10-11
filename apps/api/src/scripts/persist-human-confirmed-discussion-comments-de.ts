/**
 * Persist the two human-confirmed German discussion-comment translations.
 *
 * No arguments. The manifest is the checked-in German list. This process
 * does not call a provider, enqueue a warm, change outbox rows, refresh
 * activation, or write WEB_UI checkpoints.
 *
 * The preflight inside persistHumanConfirmedTranslations is not a MongoDB
 * transaction. The engine rechecks each identity immediately before its
 * insert. The insert does not replace a row that appears in that window.
 *
 * Release authorization is process-scoped. It is the environment variable
 * on this single command, not a CLI argument, and it is not stored in
 * MongoDB, Render service environment settings, or a file:
 *
 *   HU_APPROVED_RELEASE_SHA=<approved_sha> \
 *   node dist/scripts/persist-human-confirmed-discussion-comments-de.js
 *
 * <approved_sha> must be the exact 40-character SHA of the reviewed and
 * deployed recovery commit. RENDER_GIT_COMMIT must equal it. The previous
 * production SHA d4c25de26e29d0836345314bdab0330ac58c493a is rejected even
 * when both values match it.
 *
 * This prefix is not a one-time token. The same command can be run again
 * in a later process. An exact human row for an identity stays unchanged.
 */

import { pathToFileURL } from "node:url";

import type { TranslatedContentRecord } from "@hu/types";

import { resolveMongoConfig } from "../infrastructure/mongodb/mongo-config.js";
import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../infrastructure/mongodb/mongo-database.js";
import { HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE } from "../modules/language/human-confirmed-discussion-comment-de.js";
import {
  HumanConfirmedTranslationRecoveryAbort,
  insertHumanConfirmedTranslation,
  persistHumanConfirmedTranslations,
  type HumanConfirmedTranslationRecoveryDependencies,
  type LiveDiscussionCommentSnapshot,
} from "../modules/language/human-confirmed-translation-recovery.js";
import { findContentTranslation } from "../modules/language/persistence/content-translation.repository.js";

export const GERMAN_RECOVERY_PRODUCTION_DATABASE = "humanity_union_production" as const;

/** Previous production image. Not an approved release for this script. */
export const GERMAN_RECOVERY_DENIED_BASELINE_SHA =
  "d4c25de26e29d0836345314bdab0330ac58c493a" as const;

const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;

export type GermanRecoveryGuardCode =
  | "refused_arguments"
  | "refused_database"
  | "release_sha_not_finalized"
  | "release_sha_mismatch";

export type GermanRecoveryGuardDecision =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: GermanRecoveryGuardCode };

export function assertGermanRecoveryProductionGuard(input: {
  readonly argv: readonly string[];
  readonly database: string;
  readonly renderGitCommit: string | undefined;
  readonly approvedReleaseSha: string | undefined;
}): GermanRecoveryGuardDecision {
  if (input.argv.length > 0) {
    return { ok: false, code: "refused_arguments" };
  }
  if (input.database !== GERMAN_RECOVERY_PRODUCTION_DATABASE) {
    return { ok: false, code: "refused_database" };
  }
  const approved = input.approvedReleaseSha?.trim().toLowerCase() ?? "";
  const deployed = input.renderGitCommit?.trim().toLowerCase() ?? "";
  if (!RELEASE_SHA_PATTERN.test(approved) || approved === GERMAN_RECOVERY_DENIED_BASELINE_SHA) {
    return { ok: false, code: "release_sha_not_finalized" };
  }
  if (deployed !== approved) {
    return { ok: false, code: "release_sha_mismatch" };
  }
  return { ok: true };
}

export interface GermanRecoveryCollectionPort {
  findOne(
    filter: { commentId: string },
    options?: { projection?: Record<string, number> },
  ): Promise<Record<string, unknown> | null>;
  insertOne?(document: TranslatedContentRecord): Promise<unknown>;
}

export function createGermanRecoveryProductionDependencies(
  getCollection: (name: string) => GermanRecoveryCollectionPort = (name) =>
    getMongoCollection(name) as unknown as GermanRecoveryCollectionPort,
): HumanConfirmedTranslationRecoveryDependencies {
  return {
    loadComment: (commentId) => loadLiveComment(commentId, getCollection),
    findTranslation: (target) =>
      findContentTranslation({
        sourceKind: target.sourceKind,
        sourceRecordId: target.sourceRecordId,
        sourceVersion: target.sourceVersion,
        targetLanguage: target.targetLanguage,
      }),
    upsertTranslation: (record) =>
      insertHumanConfirmedTranslation(record, {
        insertOne: async (document) => {
          const collection = getCollection(MONGO_COLLECTIONS.contentTranslations);
          if (!collection.insertOne) {
            throw new Error("content translation collection cannot insert");
          }
          await collection.insertOne(document);
        },
        findExisting: () =>
          findContentTranslation({
            sourceKind: record.sourceKind,
            sourceRecordId: record.sourceRecordId,
            sourceVersion: record.sourceVersion,
            targetLanguage: record.targetLanguage,
          }),
      }),
  };
}

async function loadLiveComment(
  commentId: string,
  getCollection: (name: string) => GermanRecoveryCollectionPort,
): Promise<LiveDiscussionCommentSnapshot | null> {
  const collection = getCollection(MONGO_COLLECTIONS.initiativeComments);
  const document = await collection.findOne(
    { commentId },
    { projection: { _id: 0, commentId: 1, body: 1, status: 1, deletedAt: 1, updatedAt: 1 } },
  );
  if (!document || document.commentId !== commentId) {
    return null;
  }
  return {
    commentId,
    body: typeof document.body === "string" ? document.body : "",
    status: typeof document.status === "string" ? document.status : "",
    deletedAt: typeof document.deletedAt === "string" ? document.deletedAt : null,
    updatedAt: typeof document.updatedAt === "string" ? document.updatedAt : "",
  };
}

type CliIo = {
  stdout: (chunk: string) => void;
  stderr: (chunk: string) => void;
};

function defaultIo(): CliIo {
  return {
    stdout: (chunk) => {
      process.stdout.write(chunk);
    },
    stderr: (chunk) => {
      process.stderr.write(chunk);
    },
  };
}

export async function runGermanConfirmedDiscussionCommentRecovery(
  deps: {
    argv: readonly string[];
    database: string;
    renderGitCommit: string | undefined;
    approvedReleaseSha: string | undefined;
    loadApiEnvironment?: () => void;
    connectMongoClient: () => Promise<unknown>;
    disconnectMongoClient: () => Promise<void>;
    persist: HumanConfirmedTranslationRecoveryDependencies;
  },
  io: CliIo = defaultIo(),
): Promise<number> {
  const guard = assertGermanRecoveryProductionGuard({
    argv: deps.argv,
    database: deps.database,
    renderGitCommit: deps.renderGitCommit,
    approvedReleaseSha: deps.approvedReleaseSha,
  });
  if (!guard.ok) {
    io.stderr(`${JSON.stringify({ aborted: true, code: guard.code })}\n`);
    return 1;
  }

  if (deps.loadApiEnvironment) {
    const writeStdout = process.stdout.write.bind(process.stdout);
    process.stdout.write = (() => true) as typeof process.stdout.write;
    try {
      deps.loadApiEnvironment();
    } finally {
      process.stdout.write = writeStdout;
    }
  }

  let exitCode = 0;
  let connected = false;
  try {
    await deps.connectMongoClient();
    connected = true;
    const result = await persistHumanConfirmedTranslations(
      deps.persist,
      HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE,
    );
    io.stdout(`${JSON.stringify(result)}\n`);
  } catch (error) {
    exitCode = 1;
    if (error instanceof HumanConfirmedTranslationRecoveryAbort) {
      io.stderr(
        `${JSON.stringify({ aborted: true, code: error.code, sourceRecordId: error.sourceRecordId })}\n`,
      );
    } else {
      io.stderr(
        `${JSON.stringify({ aborted: true, code: error instanceof Error ? error.name : "Error" })}\n`,
      );
    }
  } finally {
    if (connected) {
      await deps.disconnectMongoClient();
    }
  }
  return exitCode;
}

function isDirectCliProcess(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectCliProcess()) {
  const argv = process.argv.slice(2);
  const guard = assertGermanRecoveryProductionGuard({
    argv,
    database: "",
    renderGitCommit: undefined,
    approvedReleaseSha: undefined,
  });
  if (!guard.ok && guard.code === "refused_arguments") {
    process.stderr.write(`${JSON.stringify({ aborted: true, code: guard.code })}\n`);
    process.exitCode = 1;
  } else {
    const { loadApiEnvironment } = await import("../config/load-api-environment.js");
    const writeStdout = process.stdout.write.bind(process.stdout);
    process.stdout.write = (() => true) as typeof process.stdout.write;
    try {
      loadApiEnvironment();
    } finally {
      process.stdout.write = writeStdout;
    }
    const { connectMongoClient, disconnectMongoClient } = await import(
      "../infrastructure/mongodb/mongo-connection.js"
    );
    const code = await runGermanConfirmedDiscussionCommentRecovery({
      argv,
      database: resolveMongoConfig().database,
      renderGitCommit: process.env.RENDER_GIT_COMMIT,
      approvedReleaseSha: process.env.HU_APPROVED_RELEASE_SHA,
      connectMongoClient,
      disconnectMongoClient,
      persist: createGermanRecoveryProductionDependencies(),
    });
    if (code !== 0) {
      process.exitCode = code;
    }
  }
}
