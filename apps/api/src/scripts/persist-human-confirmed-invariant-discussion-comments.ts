/**
 * Persist the two human-confirmed French discussion-comment translations.
 *
 * Does not call the provider, enqueue a warm, change outbox rows, or start
 * activation. Both live comments are checked before any write.
 *
 * Usage:
 *   node dist/scripts/persist-human-confirmed-invariant-discussion-comments.js
 */

import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import type { TranslatedContentRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../infrastructure/mongodb/mongo-database.js";
import { buildContentTranslationSourceVersion } from "../modules/language/content-translation-version.js";
import {
  buildHumanConfirmedInvariantTranslationRecord,
  HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS,
  isExactHumanConfirmedInvariantTranslation,
  type HumanConfirmedInvariantDiscussionComment,
} from "../modules/language/human-confirmed-invariant-discussion-comment.js";
import {
  findContentTranslation,
  upsertContentTranslation,
} from "../modules/language/persistence/content-translation.repository.js";

export type LiveDiscussionCommentSnapshot = {
  readonly commentId: string;
  readonly body: string;
  readonly status: string;
  readonly deletedAt: string | null;
  readonly updatedAt: string;
};

export type HumanConfirmedInvariantPersistAbortCode =
  | "missing_source"
  | "not_approved"
  | "deleted"
  | "body_mismatch"
  | "version_mismatch"
  | "conflicting_translation";

export class HumanConfirmedInvariantPersistAbort extends Error {
  readonly code: HumanConfirmedInvariantPersistAbortCode;
  readonly sourceRecordId: string;

  constructor(code: HumanConfirmedInvariantPersistAbortCode, sourceRecordId: string) {
    super(`${code}:${sourceRecordId}`);
    this.name = "HumanConfirmedInvariantPersistAbort";
    this.code = code;
    this.sourceRecordId = sourceRecordId;
  }
}

export type HumanConfirmedInvariantPersistResult = {
  readonly written: number;
  readonly unchanged: number;
  readonly identities: readonly {
    readonly sourceRecordId: string;
    readonly sourceVersion: string;
    readonly outcome: "written" | "unchanged";
  }[];
};

export type HumanConfirmedInvariantPersistDependencies = {
  loadComment: (commentId: string) => Promise<LiveDiscussionCommentSnapshot | null>;
  findFrenchTranslation: (
    target: HumanConfirmedInvariantDiscussionComment,
  ) => Promise<TranslatedContentRecord | null>;
  upsertTranslation: (record: TranslatedContentRecord) => Promise<void>;
  buildSourceVersion?: typeof buildContentTranslationSourceVersion;
  now?: () => string;
  createTranslationId?: () => string;
};

function versionOf(
  comment: LiveDiscussionCommentSnapshot,
  buildSourceVersion: typeof buildContentTranslationSourceVersion,
): string {
  return buildSourceVersion({
    fields: { body: comment.body },
    versionStamp: comment.updatedAt,
  });
}

/**
 * Validate both comments, then insert only missing exact rows.
 * A failed check writes nothing. A second run with both rows present writes nothing.
 */
export async function persistHumanConfirmedInvariantDiscussionComments(
  deps: HumanConfirmedInvariantPersistDependencies,
): Promise<HumanConfirmedInvariantPersistResult> {
  const buildSourceVersion = deps.buildSourceVersion ?? buildContentTranslationSourceVersion;
  const inspected: {
    target: HumanConfirmedInvariantDiscussionComment;
    existing: TranslatedContentRecord | null;
  }[] = [];

  for (const target of HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS) {
    const comment = await deps.loadComment(target.sourceRecordId);
    if (!comment || comment.commentId !== target.sourceRecordId) {
      throw new HumanConfirmedInvariantPersistAbort("missing_source", target.sourceRecordId);
    }
    if (comment.deletedAt) {
      throw new HumanConfirmedInvariantPersistAbort("deleted", target.sourceRecordId);
    }
    if (comment.status !== "approved") {
      throw new HumanConfirmedInvariantPersistAbort("not_approved", target.sourceRecordId);
    }
    if (comment.body !== target.sourceBody) {
      throw new HumanConfirmedInvariantPersistAbort("body_mismatch", target.sourceRecordId);
    }
    if (versionOf(comment, buildSourceVersion) !== target.sourceVersion) {
      throw new HumanConfirmedInvariantPersistAbort("version_mismatch", target.sourceRecordId);
    }
    const existing = await deps.findFrenchTranslation(target);
    if (existing && !isExactHumanConfirmedInvariantTranslation(existing)) {
      throw new HumanConfirmedInvariantPersistAbort(
        "conflicting_translation",
        target.sourceRecordId,
      );
    }
    inspected.push({ target, existing });
  }

  const now = deps.now ?? (() => new Date().toISOString());
  const createTranslationId = deps.createTranslationId ?? (() => `translation-${randomUUID()}`);
  const identities: {
    sourceRecordId: string;
    sourceVersion: string;
    outcome: "written" | "unchanged";
  }[] = [];

  for (const item of inspected) {
    if (item.existing) {
      identities.push({
        sourceRecordId: item.target.sourceRecordId,
        sourceVersion: item.target.sourceVersion,
        outcome: "unchanged",
      });
      continue;
    }
    await deps.upsertTranslation(
      buildHumanConfirmedInvariantTranslationRecord({
        target: item.target,
        translationId: createTranslationId(),
        now: now(),
      }),
    );
    identities.push({
      sourceRecordId: item.target.sourceRecordId,
      sourceVersion: item.target.sourceVersion,
      outcome: "written",
    });
  }

  return {
    written: identities.filter((identity) => identity.outcome === "written").length,
    unchanged: identities.filter((identity) => identity.outcome === "unchanged").length,
    identities,
  };
}

async function loadLiveComment(commentId: string): Promise<LiveDiscussionCommentSnapshot | null> {
  const collection = getMongoCollection<{
    commentId?: string;
    body?: string;
    status?: string;
    deletedAt?: string;
    updatedAt?: string;
  }>(MONGO_COLLECTIONS.initiativeComments);
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

async function productionDependencies(): Promise<HumanConfirmedInvariantPersistDependencies> {
  return {
    loadComment: loadLiveComment,
    findFrenchTranslation: (target) =>
      findContentTranslation({
        sourceKind: target.sourceKind,
        sourceRecordId: target.sourceRecordId,
        sourceVersion: target.sourceVersion,
        targetLanguage: target.targetLanguage,
      }),
    upsertTranslation: async (record) => {
      await upsertContentTranslation(record);
    },
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

/**
 * Connects MongoDB, then persists the two allowlisted rows.
 * Environment loading is silenced. Disconnect always runs.
 */
export async function runHumanConfirmedInvariantPersist(
  deps: {
    loadApiEnvironment: () => void;
    connectMongoClient: () => Promise<unknown>;
    disconnectMongoClient: () => Promise<void>;
    persist: HumanConfirmedInvariantPersistDependencies;
  },
  io: CliIo = defaultIo(),
): Promise<number> {
  const writeStdout = process.stdout.write.bind(process.stdout);
  process.stdout.write = (() => true) as typeof process.stdout.write;
  try {
    deps.loadApiEnvironment();
  } finally {
    process.stdout.write = writeStdout;
  }

  let exitCode = 0;
  let connected = false;
  try {
    await deps.connectMongoClient();
    connected = true;
    const result = await persistHumanConfirmedInvariantDiscussionComments(deps.persist);
    io.stdout(`${JSON.stringify(result)}\n`);
  } catch (error) {
    exitCode = 1;
    if (error instanceof HumanConfirmedInvariantPersistAbort) {
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
  const { loadApiEnvironment } = await import("../config/load-api-environment.js");
  const { connectMongoClient, disconnectMongoClient } = await import(
    "../infrastructure/mongodb/mongo-connection.js"
  );
  const code = await runHumanConfirmedInvariantPersist({
    loadApiEnvironment,
    connectMongoClient,
    disconnectMongoClient,
    persist: await productionDependencies(),
  });
  if (code !== 0) {
    process.exitCode = code;
  }
}
