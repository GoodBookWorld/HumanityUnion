/**
 * Manifest-driven recovery for human-confirmed discussion-comment translations.
 *
 * Readiness does not consult these manifests. Machine unchanged-prose
 * validation is not involved in this write path.
 *
 * Preflight checks every identity before the first write. That preflight is
 * not a MongoDB transaction. A comment or translation row can change after
 * preflight returns and before its write. The write loop therefore reloads
 * the live comment and the translation row immediately before each write
 * and aborts on any mismatch or conflict. The recovery write itself is an
 * insert. A duplicate-key response is reread: an exact human row stays in
 * place, and any other row aborts the run. This path does not replace an
 * existing row. If that recheck fails after an earlier insert in the same
 * run, the earlier exact row remains. A later run leaves an exact row
 * untouched and writes only identities that are still missing.
 *
 * This module does not call a provider, enqueue warm work, change outbox
 * attempts, refresh activation, or write WEB_UI checkpoints.
 */

import { randomUUID } from "node:crypto";

import type { LanguageCode, TranslatedContentRecord } from "@hu/types";

import { buildContentTranslationSourceVersion } from "./content-translation-version.js";

export type HumanConfirmedTranslationTarget = {
  readonly sourceKind: "discussion_comment";
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly sourceBody: string;
  readonly targetLanguage: LanguageCode;
  readonly translatedBody: string;
};

export type LiveDiscussionCommentSnapshot = {
  readonly commentId: string;
  readonly body: string;
  readonly status: string;
  readonly deletedAt: string | null;
  readonly updatedAt: string;
};

export type HumanConfirmedTranslationAbortCode =
  | "empty_manifest"
  | "duplicate_identity"
  | "missing_source"
  | "not_approved"
  | "deleted"
  | "body_mismatch"
  | "version_mismatch"
  | "conflicting_translation";

export class HumanConfirmedTranslationRecoveryAbort extends Error {
  readonly code: HumanConfirmedTranslationAbortCode;
  readonly sourceRecordId: string;

  constructor(code: HumanConfirmedTranslationAbortCode, sourceRecordId: string) {
    super(`${code}:${sourceRecordId}`);
    this.name = "HumanConfirmedTranslationRecoveryAbort";
    this.code = code;
    this.sourceRecordId = sourceRecordId;
  }
}

export type HumanConfirmedTranslationRecoveryResult = {
  readonly written: number;
  readonly unchanged: number;
  readonly identities: readonly {
    readonly sourceRecordId: string;
    readonly sourceVersion: string;
    readonly targetLanguage: LanguageCode;
    readonly outcome: "written" | "unchanged";
  }[];
};

export type HumanConfirmedTranslationRecoveryDependencies = {
  loadComment: (commentId: string) => Promise<LiveDiscussionCommentSnapshot | null>;
  findTranslation: (
    target: HumanConfirmedTranslationTarget,
  ) => Promise<TranslatedContentRecord | null>;
  upsertTranslation: (
    record: TranslatedContentRecord,
  ) => Promise<void | "written" | "unchanged">;
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

function identityKey(target: HumanConfirmedTranslationTarget): string {
  return [
    target.sourceKind,
    target.sourceRecordId,
    target.sourceVersion,
    target.targetLanguage,
  ].join("\0");
}

function translatedBody(record: Pick<TranslatedContentRecord, "translatedContent">): string | null {
  const content = record.translatedContent;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }
  const keys = Object.keys(content);
  if (keys.length !== 1 || keys[0] !== "body") {
    return null;
  }
  const body = content.body;
  return typeof body === "string" ? body : null;
}

/**
 * Exact human row for one manifest entry. Timestamps and translationId may differ.
 * Any other row for the same identity is a conflict. Comparison is exact.
 */
export function isExactHumanConfirmedTranslation(
  record: TranslatedContentRecord,
  target: HumanConfirmedTranslationTarget,
): boolean {
  const body = translatedBody(record);
  if (body === null || body !== target.translatedBody) {
    return false;
  }
  if (record.localizationInputVersion) {
    return false;
  }
  return (
    record.sourceKind === target.sourceKind &&
    record.sourceRecordId === target.sourceRecordId &&
    record.sourceVersion === target.sourceVersion &&
    record.targetLanguage === target.targetLanguage &&
    record.sourceLanguage === "en" &&
    record.translationProvider === "human" &&
    record.translationKind === "human" &&
    record.freshness === "current" &&
    record.stale === false
  );
}

export function buildHumanConfirmedTranslationRecord(input: {
  readonly target: HumanConfirmedTranslationTarget;
  readonly translationId: string;
  readonly now: string;
}): TranslatedContentRecord {
  return {
    translationId: input.translationId,
    sourceKind: input.target.sourceKind,
    sourceRecordId: input.target.sourceRecordId,
    sourceVersion: input.target.sourceVersion,
    sourceLanguage: "en",
    targetLanguage: input.target.targetLanguage,
    translatedContent: { body: input.target.translatedBody },
    translationProvider: "human",
    translationKind: "human",
    createdAt: input.now,
    updatedAt: input.now,
    stale: false,
    freshness: "current",
  };
}

function assertManifest(manifest: readonly HumanConfirmedTranslationTarget[]): void {
  if (manifest.length === 0) {
    throw new HumanConfirmedTranslationRecoveryAbort("empty_manifest", "");
  }
  const seen = new Set<string>();
  for (const target of manifest) {
    const key = identityKey(target);
    if (seen.has(key)) {
      throw new HumanConfirmedTranslationRecoveryAbort(
        "duplicate_identity",
        target.sourceRecordId,
      );
    }
    seen.add(key);
  }
}

function assertLiveComment(
  target: HumanConfirmedTranslationTarget,
  comment: LiveDiscussionCommentSnapshot | null,
  buildSourceVersion: typeof buildContentTranslationSourceVersion,
): void {
  if (!comment || comment.commentId !== target.sourceRecordId) {
    throw new HumanConfirmedTranslationRecoveryAbort("missing_source", target.sourceRecordId);
  }
  if (comment.deletedAt) {
    throw new HumanConfirmedTranslationRecoveryAbort("deleted", target.sourceRecordId);
  }
  if (comment.status !== "approved") {
    throw new HumanConfirmedTranslationRecoveryAbort("not_approved", target.sourceRecordId);
  }
  if (comment.body !== target.sourceBody) {
    throw new HumanConfirmedTranslationRecoveryAbort("body_mismatch", target.sourceRecordId);
  }
  if (versionOf(comment, buildSourceVersion) !== target.sourceVersion) {
    throw new HumanConfirmedTranslationRecoveryAbort("version_mismatch", target.sourceRecordId);
  }
}

async function inspectIdentity(
  target: HumanConfirmedTranslationTarget,
  deps: HumanConfirmedTranslationRecoveryDependencies,
  buildSourceVersion: typeof buildContentTranslationSourceVersion,
): Promise<TranslatedContentRecord | null> {
  const comment = await deps.loadComment(target.sourceRecordId);
  assertLiveComment(target, comment, buildSourceVersion);
  const existing = await deps.findTranslation(target);
  if (existing && !isExactHumanConfirmedTranslation(existing, target)) {
    throw new HumanConfirmedTranslationRecoveryAbort(
      "conflicting_translation",
      target.sourceRecordId,
    );
  }
  return existing;
}

export function isMongoDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}

/**
 * Insert one human row. The unique identity index rejects a concurrent
 * insert. That duplicate is reread: an exact human row is left unchanged,
 * and any other row aborts. This function never replaces a stored row.
 */
export async function insertHumanConfirmedTranslation(
  record: TranslatedContentRecord,
  ports: {
    insertOne: (record: TranslatedContentRecord) => Promise<void>;
    findExisting: () => Promise<TranslatedContentRecord | null>;
  },
): Promise<"written" | "unchanged"> {
  try {
    await ports.insertOne(record);
    return "written";
  } catch (error) {
    if (!isMongoDuplicateKeyError(error)) {
      throw error;
    }
    const existing = await ports.findExisting();
    const body = translatedBody(record);
    if (
      body !== null &&
      record.sourceKind === "discussion_comment" &&
      existing &&
      isExactHumanConfirmedTranslation(existing, {
        sourceKind: "discussion_comment",
        sourceRecordId: record.sourceRecordId,
        sourceVersion: record.sourceVersion,
        targetLanguage: record.targetLanguage,
        sourceBody: body,
        translatedBody: body,
      })
    ) {
      return "unchanged";
    }
    throw new HumanConfirmedTranslationRecoveryAbort(
      "conflicting_translation",
      record.sourceRecordId,
    );
  }
}

/**
 * Validate the whole manifest, then insert only missing exact rows.
 * A failed preflight writes nothing. Immediately before each write the
 * identity is loaded again. A second run with both exact rows present
 * writes nothing.
 */
export async function persistHumanConfirmedTranslations(
  deps: HumanConfirmedTranslationRecoveryDependencies,
  manifest: readonly HumanConfirmedTranslationTarget[],
): Promise<HumanConfirmedTranslationRecoveryResult> {
  assertManifest(manifest);
  const buildSourceVersion = deps.buildSourceVersion ?? buildContentTranslationSourceVersion;

  for (const target of manifest) {
    await inspectIdentity(target, deps, buildSourceVersion);
  }

  const now = deps.now ?? (() => new Date().toISOString());
  const createTranslationId = deps.createTranslationId ?? (() => `translation-${randomUUID()}`);
  const identities: {
    sourceRecordId: string;
    sourceVersion: string;
    targetLanguage: LanguageCode;
    outcome: "written" | "unchanged";
  }[] = [];

  for (const target of manifest) {
    const existing = await inspectIdentity(target, deps, buildSourceVersion);
    if (existing) {
      identities.push({
        sourceRecordId: target.sourceRecordId,
        sourceVersion: target.sourceVersion,
        targetLanguage: target.targetLanguage,
        outcome: "unchanged",
      });
      continue;
    }
    const writeResult = await deps.upsertTranslation(
      buildHumanConfirmedTranslationRecord({
        target,
        translationId: createTranslationId(),
        now: now(),
      }),
    );
    identities.push({
      sourceRecordId: target.sourceRecordId,
      sourceVersion: target.sourceVersion,
      targetLanguage: target.targetLanguage,
      outcome: writeResult === "unchanged" ? "unchanged" : "written",
    });
  }

  return {
    written: identities.filter((identity) => identity.outcome === "written").length,
    unchanged: identities.filter((identity) => identity.outcome === "unchanged").length,
    identities,
  };
}
