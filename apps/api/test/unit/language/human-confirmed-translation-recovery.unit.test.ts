/**
 * German human-confirmed discussion-comment recovery.
 * No provider calls and no database connection.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TranslatedContentRecord } from "@hu/types";

import { ContentTranslationValidationError } from "../../../src/modules/language/content-translation-failure-metadata.js";
import { assertTranslatedProseChangedFromSource } from "../../../src/modules/language/content-translation-output-validation.js";
import { classifyContentTranslationValidity } from "../../../src/modules/language/content-translation-validity.js";
import { HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE } from "../../../src/modules/language/human-confirmed-discussion-comment-de.js";
import { buildContentTranslationSourceVersion } from "../../../src/modules/language/content-translation-version.js";
import {
  buildHumanConfirmedTranslationRecord,
  HumanConfirmedTranslationRecoveryAbort,
  insertHumanConfirmedTranslation,
  isExactHumanConfirmedTranslation,
  persistHumanConfirmedTranslations,
  type HumanConfirmedTranslationRecoveryDependencies,
  type HumanConfirmedTranslationTarget,
  type LiveDiscussionCommentSnapshot,
} from "../../../src/modules/language/human-confirmed-translation-recovery.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { resetContentTranslationMemoryStoreForTests } from "../../../src/modules/language/persistence/content-translation.memory.store.js";
import {
  findContentTranslation,
  upsertContentTranslation,
} from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  assertGermanRecoveryProductionGuard,
  createGermanRecoveryProductionDependencies,
  GERMAN_RECOVERY_DENIED_BASELINE_SHA,
  GERMAN_RECOVERY_PRODUCTION_DATABASE,
  runGermanConfirmedDiscussionCommentRecovery,
  type GermanRecoveryCollectionPort,
} from "../../../src/scripts/persist-human-confirmed-discussion-comments-de.js";

const TARGET_A = HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE[0];
const TARGET_B = HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE[1];
const APPROVED_SHA = "a".repeat(40);

function humanRow(
  target: HumanConfirmedTranslationTarget,
  overrides: Partial<TranslatedContentRecord> = {},
): TranslatedContentRecord {
  return {
    ...buildHumanConfirmedTranslationRecord({
      target,
      translationId: `t-${target.targetLanguage}-${target.sourceRecordId}`,
      now: "2026-10-11T00:00:00.000Z",
    }),
    ...overrides,
  };
}

function liveComment(
  target: HumanConfirmedTranslationTarget,
  overrides: Partial<LiveDiscussionCommentSnapshot> = {},
): LiveDiscussionCommentSnapshot {
  return {
    commentId: target.sourceRecordId,
    body: target.sourceBody,
    status: "approved",
    deletedAt: null,
    updatedAt: "stamp",
    ...overrides,
  };
}

function versionForManifest(
  manifest: readonly HumanConfirmedTranslationTarget[],
): typeof buildContentTranslationSourceVersion {
  return (input) => {
    const target = manifest.find(
      (candidate) => candidate.sourceBody === input.fields.body && input.versionStamp === "stamp",
    );
    return target?.sourceVersion ?? buildContentTranslationSourceVersion(input);
  };
}

function translationKey(target: {
  sourceKind: string;
  sourceRecordId: string;
  sourceVersion: string;
  targetLanguage: string;
}): string {
  return `${target.sourceKind}|${target.sourceRecordId}|${target.sourceVersion}|${target.targetLanguage}`;
}

describe("German human-confirmed discussion-comment recovery", () => {
  it("keeps the checked-in manifest to the two confirmed German identities", () => {
    assert.equal(HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE.length, 2);
    assert.deepEqual(
      HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE.map((target) => target.targetLanguage),
      ["de", "de"],
    );
    assert.deepEqual(
      HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE.map((target) => [
        target.sourceRecordId,
        target.sourceVersion,
        target.sourceBody,
        target.translatedBody,
      ]),
      [
        ["ff0345b3-47ba-43f8-8d46-2e8368ada089", "v-40261791a2c14050", "Test", "Test"],
        ["3054799b-3b9b-4d59-ac17-638ae7fbf117", "v-42b3253b643dddbe", "test", "test"],
      ],
    );
  });

  it("writes two rows on the first run and zero on the second", async () => {
    const stored = new Map<string, TranslatedContentRecord>();
    let upserts = 0;
    const deps: HumanConfirmedTranslationRecoveryDependencies = {
      loadComment: async (commentId) =>
        liveComment(commentId === TARGET_A.sourceRecordId ? TARGET_A : TARGET_B),
      findTranslation: async (target) => stored.get(translationKey(target)) ?? null,
      upsertTranslation: async (record) => {
        upserts += 1;
        stored.set(translationKey(record), record);
      },
      buildSourceVersion: versionForManifest(HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE),
      now: () => "2026-10-11T16:00:00.000Z",
      createTranslationId: () => "translation-fixed",
    };

    const first = await persistHumanConfirmedTranslations(
      deps,
      HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE,
    );
    assert.equal(first.written, 2);
    assert.equal(first.unchanged, 0);
    assert.equal(upserts, 2);
    for (const target of HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE) {
      const row = stored.get(translationKey(target));
      assert.ok(row);
      assert.equal(isExactHumanConfirmedTranslation(row, target), true);
      assert.deepEqual(row.translatedContent, { body: target.translatedBody });
      assert.equal(row.translationKind, "human");
      assert.equal(row.translationProvider, "human");
      assert.equal(row.targetLanguage, "de");
    }

    const second = await persistHumanConfirmedTranslations(
      {
        ...deps,
        now: () => "2026-10-12T00:00:00.000Z",
        createTranslationId: () => "translation-rewritten",
      },
      HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE,
    );
    assert.equal(second.written, 0);
    assert.equal(second.unchanged, 2);
    assert.equal(upserts, 2);
    for (const target of HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE) {
      const row = stored.get(translationKey(target));
      assert.equal(row?.translationId, "translation-fixed");
      assert.equal(row?.updatedAt, "2026-10-11T16:00:00.000Z");
    }
  });

  it("writes nothing when preflight fails for either identity", async () => {
    const cases: {
      code: string;
      sourceRecordId: string;
      loadComment: HumanConfirmedTranslationRecoveryDependencies["loadComment"];
      findTranslation: HumanConfirmedTranslationRecoveryDependencies["findTranslation"];
      buildSourceVersion?: typeof buildContentTranslationSourceVersion;
    }[] = [
      {
        code: "missing_source",
        sourceRecordId: TARGET_B.sourceRecordId,
        loadComment: async (commentId) =>
          commentId === TARGET_A.sourceRecordId ? liveComment(TARGET_A) : null,
        findTranslation: async () => null,
      },
      {
        code: "not_approved",
        sourceRecordId: TARGET_B.sourceRecordId,
        loadComment: async (commentId) =>
          liveComment(commentId === TARGET_A.sourceRecordId ? TARGET_A : TARGET_B, {
            status: commentId === TARGET_B.sourceRecordId ? "pending" : "approved",
          }),
        findTranslation: async () => null,
      },
      {
        code: "deleted",
        sourceRecordId: TARGET_A.sourceRecordId,
        loadComment: async (commentId) =>
          liveComment(commentId === TARGET_A.sourceRecordId ? TARGET_A : TARGET_B, {
            deletedAt: commentId === TARGET_A.sourceRecordId ? "2026-10-11T00:00:00.000Z" : null,
          }),
        findTranslation: async () => null,
      },
      {
        code: "body_mismatch",
        sourceRecordId: TARGET_A.sourceRecordId,
        loadComment: async (commentId) =>
          liveComment(commentId === TARGET_A.sourceRecordId ? TARGET_A : TARGET_B, {
            body: commentId === TARGET_A.sourceRecordId ? "test" : TARGET_B.sourceBody,
          }),
        findTranslation: async () => null,
      },
      {
        code: "version_mismatch",
        sourceRecordId: TARGET_A.sourceRecordId,
        loadComment: async (commentId) =>
          liveComment(commentId === TARGET_A.sourceRecordId ? TARGET_A : TARGET_B),
        findTranslation: async () => null,
        buildSourceVersion: buildContentTranslationSourceVersion,
      },
      {
        code: "conflicting_translation",
        sourceRecordId: TARGET_A.sourceRecordId,
        loadComment: async (commentId) =>
          liveComment(commentId === TARGET_A.sourceRecordId ? TARGET_A : TARGET_B),
        findTranslation: async (target) =>
          target.sourceRecordId === TARGET_A.sourceRecordId
            ? humanRow(TARGET_A, { translationKind: "machine", translationProvider: "gemini" })
            : null,
      },
    ];

    for (const entry of cases) {
      const writes: TranslatedContentRecord[] = [];
      await assert.rejects(
        () =>
          persistHumanConfirmedTranslations(
            {
              loadComment: entry.loadComment,
              findTranslation: entry.findTranslation,
              upsertTranslation: async (record) => {
                writes.push(record);
              },
              buildSourceVersion:
                entry.buildSourceVersion ?? versionForManifest(HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE),
            },
            HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE,
          ),
        (error: unknown) => {
          assert.ok(error instanceof HumanConfirmedTranslationRecoveryAbort);
          assert.equal(error.code, entry.code);
          assert.equal(error.sourceRecordId, entry.sourceRecordId);
          return true;
        },
      );
      assert.equal(writes.length, 0, entry.code);
    }
  });

  it("aborts a conflicting German row with a different body or provenance", async () => {
    const writes: TranslatedContentRecord[] = [];
    await assert.rejects(
      () =>
        persistHumanConfirmedTranslations(
          {
            loadComment: async (commentId) =>
              liveComment(commentId === TARGET_A.sourceRecordId ? TARGET_A : TARGET_B),
            findTranslation: async (target) =>
              humanRow(target, {
                translatedContent: { body: `${target.translatedBody} extra` },
              }),
            upsertTranslation: async (record) => {
              writes.push(record);
            },
            buildSourceVersion: versionForManifest(HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE),
          },
          HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE,
        ),
      (error: unknown) => {
        assert.ok(error instanceof HumanConfirmedTranslationRecoveryAbort);
        assert.equal(error.code, "conflicting_translation");
        return true;
      },
    );
    assert.equal(writes.length, 0);
    assert.equal(
      isExactHumanConfirmedTranslation(
        humanRow(TARGET_A, { localizationInputVersion: "input-1" }),
        TARGET_A,
      ),
      false,
    );
  });

  it("treats a French row as a different identity", async () => {
    const stored = new Map<string, TranslatedContentRecord>();
    const french = humanRow(
      { ...TARGET_A, targetLanguage: "fr", translatedBody: "Test" },
      { translationId: "french-row" },
    );
    stored.set(translationKey(french), french);
    const writtenLanguages: string[] = [];

    const result = await persistHumanConfirmedTranslations(
      {
        loadComment: async (commentId) =>
          liveComment(commentId === TARGET_A.sourceRecordId ? TARGET_A : TARGET_B),
        findTranslation: async (target) => stored.get(translationKey(target)) ?? null,
        upsertTranslation: async (record) => {
          writtenLanguages.push(record.targetLanguage);
          stored.set(translationKey(record), record);
        },
        buildSourceVersion: versionForManifest(HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE),
        createTranslationId: () => "translation-de",
      },
      HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE,
    );

    assert.equal(result.written, 2);
    assert.deepEqual(writtenLanguages, ["de", "de"]);
    assert.equal(stored.get(translationKey(french))?.translationId, "french-row");
    assert.equal(stored.get(translationKey(french))?.targetLanguage, "fr");
    assert.equal(stored.get(translationKey(TARGET_A))?.targetLanguage, "de");
  });

  it("rechecks the live identity before the first write", async () => {
    const loads = new Map<string, number>();
    const writes: TranslatedContentRecord[] = [];
    await assert.rejects(
      () =>
        persistHumanConfirmedTranslations(
          {
            loadComment: async (commentId) => {
              const count = (loads.get(commentId) ?? 0) + 1;
              loads.set(commentId, count);
              const target = commentId === TARGET_A.sourceRecordId ? TARGET_A : TARGET_B;
              if (commentId === TARGET_A.sourceRecordId && count > 1) {
                return liveComment(target, { body: "changed" });
              }
              return liveComment(target);
            },
            findTranslation: async () => null,
            upsertTranslation: async (record) => {
              writes.push(record);
            },
            buildSourceVersion: versionForManifest(HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE),
          },
          HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE,
        ),
      (error: unknown) => {
        assert.ok(error instanceof HumanConfirmedTranslationRecoveryAbort);
        assert.equal(error.code, "body_mismatch");
        assert.equal(error.sourceRecordId, TARGET_A.sourceRecordId);
        return true;
      },
    );
    assert.equal(writes.length, 0);
  });

  it("recovers a partial write without rewriting the exact row", async () => {
    const stored = new Map<string, TranslatedContentRecord>();
    let failSecondWrite = true;
    const deps = (): HumanConfirmedTranslationRecoveryDependencies => ({
      loadComment: async (commentId) =>
        liveComment(commentId === TARGET_A.sourceRecordId ? TARGET_A : TARGET_B),
      findTranslation: async (target) => stored.get(translationKey(target)) ?? null,
      upsertTranslation: async (record) => {
        if (failSecondWrite && record.sourceRecordId === TARGET_B.sourceRecordId) {
          throw new Error("write_failed");
        }
        stored.set(translationKey(record), record);
      },
      buildSourceVersion: versionForManifest(HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE),
      now: () => "2026-10-11T16:00:00.000Z",
      createTranslationId: () => "translation-stable",
    });

    await assert.rejects(() => persistHumanConfirmedTranslations(deps(), HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE), {
      message: "write_failed",
    });
    const firstRow = stored.get(translationKey(TARGET_A));
    assert.ok(firstRow);
    assert.equal(stored.has(translationKey(TARGET_B)), false);

    failSecondWrite = false;
    const second = await persistHumanConfirmedTranslations(
      {
        ...deps(),
        now: () => "2026-10-12T00:00:00.000Z",
        createTranslationId: () => "translation-other",
      },
      HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE,
    );
    assert.equal(second.written, 1);
    assert.equal(second.unchanged, 1);
    assert.equal(stored.get(translationKey(TARGET_A))?.translationId, "translation-stable");
    assert.equal(stored.get(translationKey(TARGET_A))?.updatedAt, "2026-10-11T16:00:00.000Z");
    assert.equal(stored.get(translationKey(TARGET_B))?.translationId, "translation-other");
    assert.equal(isExactHumanConfirmedTranslation(stored.get(translationKey(TARGET_B))!, TARGET_B), true);
  });

  it("still rejects machine unchanged prose", () => {
    assert.throws(
      () =>
        assertTranslatedProseChangedFromSource({
          sourceKind: "discussion_comment",
          sourceLanguage: "en",
          targetLanguage: "de",
          sourceFields: { body: TARGET_A.sourceBody },
          translatedFields: { body: TARGET_A.translatedBody },
        }),
      (error: unknown) => {
        assert.ok(error instanceof ContentTranslationValidationError);
        assert.equal(error.reasonCode, "UNCHANGED_SOURCE_PROSE");
        return true;
      },
    );
    const machine = classifyContentTranslationValidity({
      translation: humanRow(TARGET_A, {
        translationKind: "machine",
        translationProvider: "gemini",
      }),
      liveSourceVersion: TARGET_A.sourceVersion,
      originalFields: { body: TARGET_A.sourceBody },
    });
    assert.equal(machine.reconciliationState, "INVALID");
    assert.deepEqual(machine.reasons, ["untranslated_source_equivalent"]);
  });

  it("refuses arguments, the wrong database, and an unfinalized release SHA", () => {
    assert.deepEqual(
      assertGermanRecoveryProductionGuard({
        argv: ["de"],
        database: GERMAN_RECOVERY_PRODUCTION_DATABASE,
        renderGitCommit: APPROVED_SHA,
        approvedReleaseSha: APPROVED_SHA,
      }),
      { ok: false, code: "refused_arguments" },
    );
    assert.deepEqual(
      assertGermanRecoveryProductionGuard({
        argv: [],
        database: "humanity_union",
        renderGitCommit: APPROVED_SHA,
        approvedReleaseSha: APPROVED_SHA,
      }),
      { ok: false, code: "refused_database" },
    );
    assert.deepEqual(
      assertGermanRecoveryProductionGuard({
        argv: [],
        database: GERMAN_RECOVERY_PRODUCTION_DATABASE,
        renderGitCommit: GERMAN_RECOVERY_DENIED_BASELINE_SHA,
        approvedReleaseSha: undefined,
      }),
      { ok: false, code: "release_sha_not_finalized" },
    );
    assert.equal(GERMAN_RECOVERY_DENIED_BASELINE_SHA, "d4c25de26e29d0836345314bdab0330ac58c493a");
    assert.deepEqual(
      assertGermanRecoveryProductionGuard({
        argv: [],
        database: GERMAN_RECOVERY_PRODUCTION_DATABASE,
        renderGitCommit: GERMAN_RECOVERY_DENIED_BASELINE_SHA,
        approvedReleaseSha: GERMAN_RECOVERY_DENIED_BASELINE_SHA,
      }),
      { ok: false, code: "release_sha_not_finalized" },
    );
    assert.deepEqual(
      assertGermanRecoveryProductionGuard({
        argv: [],
        database: GERMAN_RECOVERY_PRODUCTION_DATABASE,
        renderGitCommit: "b".repeat(40),
        approvedReleaseSha: APPROVED_SHA,
      }),
      { ok: false, code: "release_sha_mismatch" },
    );
    assert.deepEqual(
      assertGermanRecoveryProductionGuard({
        argv: [],
        database: GERMAN_RECOVERY_PRODUCTION_DATABASE,
        renderGitCommit: APPROVED_SHA,
        approvedReleaseSha: APPROVED_SHA,
      }),
      { ok: true },
    );
  });

  it("does not connect when the production guard refuses", async () => {
    let connected = false;
    const stderr: string[] = [];
    const code = await runGermanConfirmedDiscussionCommentRecovery(
      {
        argv: [],
        database: "humanity_union_staging",
        renderGitCommit: APPROVED_SHA,
        approvedReleaseSha: APPROVED_SHA,
        connectMongoClient: async () => {
          connected = true;
        },
        disconnectMongoClient: async () => undefined,
        persist: {
          loadComment: async () => {
            throw new Error("must not load");
          },
          findTranslation: async () => {
            throw new Error("must not find");
          },
          upsertTranslation: async () => {
            throw new Error("must not write");
          },
        },
      },
      {
        stdout: () => undefined,
        stderr: (chunk) => {
          stderr.push(chunk);
        },
      },
    );
    assert.equal(code, 1);
    assert.equal(connected, false);
    assert.match(stderr.join(""), /refused_database/);
  });
});

describe("German recovery production runner", () => {
  async function withRepositoryMemory<T>(run: () => Promise<T>): Promise<T> {
    const previous = process.env.CONTENT_TRANSLATION_PERSISTENCE;
    process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
    resetContentTranslationMemoryStoreForTests();
    try {
      return await run();
    } finally {
      resetContentTranslationMemoryStoreForTests();
      if (previous === undefined) {
        delete process.env.CONTENT_TRANSLATION_PERSISTENCE;
      } else {
        process.env.CONTENT_TRANSLATION_PERSISTENCE = previous;
      }
    }
  }

  function runnerPersist(
    getCollection: (name: string) => GermanRecoveryCollectionPort,
  ): HumanConfirmedTranslationRecoveryDependencies {
    return {
      ...createGermanRecoveryProductionDependencies(getCollection),
      buildSourceVersion: versionForManifest(HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE),
      now: () => "2026-10-11T16:00:00.000Z",
      createTranslationId: () => "translation-runner",
    };
  }

  it("persists both German identities through the production adapters", async () => {
    await withRepositoryMemory(async () => {
      const collectionNames: string[] = [];
      const commentReads: string[] = [];
      const inserted: TranslatedContentRecord[] = [];
      let connects = 0;
      let disconnects = 0;
      const stdout: string[] = [];

      const code = await runGermanConfirmedDiscussionCommentRecovery(
        {
          argv: [],
          database: GERMAN_RECOVERY_PRODUCTION_DATABASE,
          renderGitCommit: APPROVED_SHA,
          approvedReleaseSha: APPROVED_SHA,
          connectMongoClient: async () => {
            connects += 1;
          },
          disconnectMongoClient: async () => {
            disconnects += 1;
          },
          persist: runnerPersist((name) => {
            collectionNames.push(name);
            if (name === MONGO_COLLECTIONS.initiativeComments) {
              return {
                findOne: async (filter) => {
                  commentReads.push(filter.commentId);
                  const target = HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE.find(
                    (candidate) => candidate.sourceRecordId === filter.commentId,
                  );
                  if (!target) {
                    return null;
                  }
                  return {
                    commentId: target.sourceRecordId,
                    body: target.sourceBody,
                    status: "approved",
                    updatedAt: "stamp",
                  };
                },
                insertOne: async () => {
                  throw new Error("initiative comments are not written");
                },
              };
            }
            if (name === MONGO_COLLECTIONS.contentTranslations) {
              return {
                findOne: async () => null,
                insertOne: async (document) => {
                  inserted.push(document);
                  const allowed = HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE.some(
                    (target) =>
                      target.sourceRecordId === document.sourceRecordId &&
                      target.sourceVersion === document.sourceVersion &&
                      target.targetLanguage === document.targetLanguage,
                  );
                  if (!allowed || document.targetLanguage !== "de") {
                    throw new Error("recovery wrote an identity outside the German manifest");
                  }
                },
              };
            }
            throw new Error(`unexpected collection ${name}`);
          }),
        },
        {
          stdout: (chunk) => {
            stdout.push(chunk);
          },
          stderr: () => undefined,
        },
      );

      assert.equal(code, 0);
      assert.equal(connects, 1);
      assert.equal(disconnects, 1);
      assert.deepEqual(JSON.parse(stdout.join("")), {
        written: 2,
        unchanged: 0,
        identities: HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE.map((target) => ({
          sourceRecordId: target.sourceRecordId,
          sourceVersion: target.sourceVersion,
          targetLanguage: "de",
          outcome: "written",
        })),
      });
      assert.deepEqual(
        [...new Set(collectionNames)].sort(),
        [MONGO_COLLECTIONS.contentTranslations, MONGO_COLLECTIONS.initiativeComments].sort(),
      );
      assert.deepEqual(
        [...new Set(commentReads)].sort(),
        HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE.map((target) => target.sourceRecordId).sort(),
      );
      assert.equal(inserted.length, 2);
      assert.deepEqual(
        inserted.map((row) => [row.sourceRecordId, row.targetLanguage, row.translationKind]),
        HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE.map((target) => [
          target.sourceRecordId,
          "de",
          "human",
        ]),
      );
      for (const target of HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE) {
        assert.equal(
          await findContentTranslation({
            sourceKind: target.sourceKind,
            sourceRecordId: target.sourceRecordId,
            sourceVersion: target.sourceVersion,
            targetLanguage: target.targetLanguage,
          }),
          null,
        );
      }
    });
  });

  it("uses the repository lookup and does not replace an exact row", async () => {
    await withRepositoryMemory(async () => {
      const existing = humanRow(TARGET_A, { translationId: "translation-stable" });
      await upsertContentTranslation(existing);
      const inserted: string[] = [];
      let disconnects = 0;

      const code = await runGermanConfirmedDiscussionCommentRecovery(
        {
          argv: [],
          database: GERMAN_RECOVERY_PRODUCTION_DATABASE,
          renderGitCommit: APPROVED_SHA,
          approvedReleaseSha: APPROVED_SHA,
          connectMongoClient: async () => undefined,
          disconnectMongoClient: async () => {
            disconnects += 1;
          },
          persist: runnerPersist((name) => {
            if (name === MONGO_COLLECTIONS.initiativeComments) {
              return {
                findOne: async (filter) => {
                  const target = HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE.find(
                    (candidate) => candidate.sourceRecordId === filter.commentId,
                  );
                  return target
                    ? {
                        commentId: target.sourceRecordId,
                        body: target.sourceBody,
                        status: "approved",
                        updatedAt: "stamp",
                      }
                    : null;
                },
              };
            }
            if (name === MONGO_COLLECTIONS.contentTranslations) {
              return {
                findOne: async () => null,
                insertOne: async (document) => {
                  inserted.push(document.sourceRecordId);
                },
              };
            }
            throw new Error(`unexpected collection ${name}`);
          }),
        },
        { stdout: () => undefined, stderr: () => undefined },
      );

      assert.equal(code, 0);
      assert.equal(disconnects, 1);
      assert.deepEqual(inserted, [TARGET_B.sourceRecordId]);
      const kept = await findContentTranslation({
        sourceKind: TARGET_A.sourceKind,
        sourceRecordId: TARGET_A.sourceRecordId,
        sourceVersion: TARGET_A.sourceVersion,
        targetLanguage: TARGET_A.targetLanguage,
      });
      assert.equal(kept?.translationId, "translation-stable");
      assert.equal(kept?.updatedAt, existing.updatedAt);
    });
  });

  it("closes the connection when persistence fails and skips it when the guard refuses", async () => {
    await withRepositoryMemory(async () => {
      let connects = 0;
      let disconnects = 0;
      const failure = await runGermanConfirmedDiscussionCommentRecovery(
        {
          argv: [],
          database: GERMAN_RECOVERY_PRODUCTION_DATABASE,
          renderGitCommit: APPROVED_SHA,
          approvedReleaseSha: APPROVED_SHA,
          connectMongoClient: async () => {
            connects += 1;
          },
          disconnectMongoClient: async () => {
            disconnects += 1;
          },
          persist: runnerPersist((name) => {
            if (name === MONGO_COLLECTIONS.initiativeComments) {
              return {
                findOne: async (filter) => {
                  const target = HUMAN_CONFIRMED_DISCUSSION_COMMENT_DE.find(
                    (candidate) => candidate.sourceRecordId === filter.commentId,
                  );
                  return target
                    ? {
                        commentId: target.sourceRecordId,
                        body: target.sourceBody,
                        status: "approved",
                        updatedAt: "stamp",
                      }
                    : null;
                },
              };
            }
            if (name === MONGO_COLLECTIONS.contentTranslations) {
              return {
                findOne: async () => null,
                insertOne: async () => {
                  throw new Error("write_failed");
                },
              };
            }
            throw new Error(`unexpected collection ${name}`);
          }),
        },
        { stdout: () => undefined, stderr: () => undefined },
      );
      assert.equal(failure, 1);
      assert.equal(connects, 1);
      assert.equal(disconnects, 1);

      let refusedConnects = 0;
      const collections: string[] = [];
      const refused = await runGermanConfirmedDiscussionCommentRecovery(
        {
          argv: [],
          database: "humanity_union",
          renderGitCommit: APPROVED_SHA,
          approvedReleaseSha: APPROVED_SHA,
          connectMongoClient: async () => {
            refusedConnects += 1;
          },
          disconnectMongoClient: async () => undefined,
          persist: runnerPersist((name) => {
            collections.push(name);
            throw new Error(`guard should prevent collection ${name}`);
          }),
        },
        { stdout: () => undefined, stderr: () => undefined },
      );
      assert.equal(refused, 1);
      assert.equal(refusedConnects, 0);
      assert.deepEqual(collections, []);
    });
  });

  it("does not replace a translation inserted between lookup and insert", async () => {
    const conflicting = humanRow(TARGET_A, {
      translationId: "translation-machine",
      translationKind: "machine",
      translationProvider: "gemini",
    });
    await assert.rejects(
      () =>
        insertHumanConfirmedTranslation(humanRow(TARGET_A, { translationId: "translation-racer" }), {
          insertOne: async () => {
            throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
          },
          findExisting: async () => conflicting,
        }),
      (error: unknown) =>
        error instanceof HumanConfirmedTranslationRecoveryAbort &&
        error.code === "conflicting_translation" &&
        error.sourceRecordId === TARGET_A.sourceRecordId,
    );
    assert.equal(conflicting.translationId, "translation-machine");
    assert.equal(conflicting.translationKind, "machine");

    const exact = humanRow(TARGET_B, { translationId: "translation-exact" });
    const outcome = await insertHumanConfirmedTranslation(
      humanRow(TARGET_B, { translationId: "translation-racer" }),
      {
        insertOne: async () => {
          throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
        },
        findExisting: async () => exact,
      },
    );
    assert.equal(outcome, "unchanged");
    assert.equal(exact.translationId, "translation-exact");
    assert.equal(exact.updatedAt, "2026-10-11T00:00:00.000Z");
  });
});
