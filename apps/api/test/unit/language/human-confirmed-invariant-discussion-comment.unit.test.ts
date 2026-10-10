/**
 * FR.07 recovery writes and FR.10 manual-translation readiness.
 * No provider calls and no database connection.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TranslatedContentRecord } from "@hu/types";

import { ContentTranslationValidationError } from "../../../src/modules/language/content-translation-failure-metadata.js";
import { assertTranslatedProseChangedFromSource } from "../../../src/modules/language/content-translation-output-validation.js";
import {
  classifyContentTranslationValidity,
  isAuthoritativeManualTranslation,
} from "../../../src/modules/language/content-translation-validity.js";
import {
  buildHumanConfirmedInvariantTranslationRecord,
  HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS,
  isExactHumanConfirmedInvariantTranslation,
  isHumanConfirmedInvariantDiscussionComment,
} from "../../../src/modules/language/human-confirmed-invariant-discussion-comment.js";
import { buildContentTranslationSourceVersion } from "../../../src/modules/language/content-translation-version.js";
import {
  HumanConfirmedInvariantPersistAbort,
  persistHumanConfirmedInvariantDiscussionComments,
  type LiveDiscussionCommentSnapshot,
} from "../../../src/scripts/persist-human-confirmed-invariant-discussion-comments.js";

const TARGET_A = HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS[0];
const TARGET_B = HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS[1];

function humanRow(
  target: (typeof HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS)[number],
  overrides: Partial<TranslatedContentRecord> = {},
): TranslatedContentRecord {
  return {
    ...buildHumanConfirmedInvariantTranslationRecord({
      target,
      translationId: `t-${target.sourceRecordId}`,
      now: "2026-10-10T00:00:00.000Z",
    }),
    ...overrides,
  };
}

function classify(row: TranslatedContentRecord, sourceBody: string) {
  return classifyContentTranslationValidity({
    translation: row,
    liveSourceVersion: row.sourceVersion,
    originalFields: { body: sourceBody },
  });
}

function liveComment(
  target: (typeof HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS)[number],
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

function matchingVersion(
  target: (typeof HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS)[number],
): typeof buildContentTranslationSourceVersion {
  return (input) => {
    const expectedBody = input.fields.body === target.sourceBody;
    const expectedStamp = input.versionStamp === "stamp";
    if (expectedBody && expectedStamp) {
      return target.sourceVersion;
    }
    return buildContentTranslationSourceVersion(input);
  };
}

function versionForBoth(): typeof buildContentTranslationSourceVersion {
  return (input) => {
    const target = HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS.find(
      (candidate) => candidate.sourceBody === input.fields.body && input.versionStamp === "stamp",
    );
    return target?.sourceVersion ?? buildContentTranslationSourceVersion(input);
  };
}

describe("human-confirmed invariant discussion comments", () => {
  it("accepts both approved human rows and rejects the same machine text", () => {
    for (const target of HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS) {
      const human = classify(humanRow(target), target.sourceBody);
      assert.equal(human.reconciliationState, "READY");
      assert.equal(human.presentationEligible, true);
      assert.equal(human.workRemaining, false);

      const machine = classify(
        humanRow(target, { translationKind: "machine", translationProvider: "gemini" }),
        target.sourceBody,
      );
      assert.equal(machine.reconciliationState, "INVALID");
      assert.deepEqual(machine.reasons, ["untranslated_source_equivalent"]);
    }
  });

  it("accepts current author-approved identical prose", () => {
    const approved = classify(
      humanRow(TARGET_A, {
        translationKind: "author-approved",
        translationProvider: "author",
      }),
      TARGET_A.sourceBody,
    );
    assert.equal(approved.reconciliationState, "READY");
    assert.equal(approved.presentationEligible, true);
    assert.equal(approved.workRemaining, false);
    assert.equal(
      isAuthoritativeManualTranslation(
        humanRow(TARGET_A, { translationKind: "author-approved" }),
      ),
      true,
    );
    assert.equal(
      isAuthoritativeManualTranslation(
        humanRow(TARGET_A, { translationKind: "machine", translationProvider: "gemini" }),
      ),
      false,
    );
  });

  it("keeps earlier validity checks in front of manual authority", () => {
    const staleVersion = classifyContentTranslationValidity({
      translation: humanRow(TARGET_A),
      liveSourceVersion: "v-other",
      originalFields: { body: TARGET_A.sourceBody },
    });
    assert.equal(staleVersion.reconciliationState, "STALE");
    assert.deepEqual(staleVersion.reasons, ["stale_identity"]);

    const staleFreshness = classify(
      humanRow(TARGET_A, { freshness: "stale" }),
      TARGET_A.sourceBody,
    );
    assert.equal(staleFreshness.reconciliationState, "STALE");
    assert.deepEqual(staleFreshness.reasons, ["stale_identity"]);

    const incomplete = classify(
      humanRow(TARGET_A, { translatedContent: {} }),
      TARGET_A.sourceBody,
    );
    assert.notEqual(incomplete.reconciliationState, "READY");
    assert.equal(incomplete.reconciliationState, "STALE");
    assert.deepEqual(incomplete.reasons, ["structurally_incomplete"]);

    const placeholder = classify(
      humanRow(TARGET_A, { translationProvider: "deterministic" }),
      TARGET_A.sourceBody,
    );
    assert.equal(placeholder.reconciliationState, "INVALID");
    assert.deepEqual(placeholder.reasons, ["deterministic_placeholder"]);

    const sameLocale = classify(
      humanRow(TARGET_A, { sourceLanguage: "fr", targetLanguage: "fr" }),
      TARGET_A.sourceBody,
    );
    assert.equal(sameLocale.reconciliationState, "NOT_APPLICABLE");
    assert.deepEqual(sameLocale.reasons, ["same_locale"]);

    const inputStale = classifyContentTranslationValidity({
      translation: humanRow(TARGET_A, { localizationInputVersion: "input-stored" }),
      liveSourceVersion: TARGET_A.sourceVersion,
      liveLocalizationInputVersion: "input-live",
      originalFields: { body: TARGET_A.sourceBody },
    });
    assert.equal(inputStale.reconciliationState, "STALE");
    assert.deepEqual(inputStale.reasons, ["localization_input_stale"]);
  });

  it("requires each locale to have its own human row", () => {
    const otherComment = classify(
      humanRow(TARGET_A, { sourceRecordId: "00000000-0000-4000-8000-000000000001" }),
      TARGET_A.sourceBody,
    );
    assert.equal(otherComment.reconciliationState, "READY");

    const german = classify(
      humanRow(TARGET_A, { targetLanguage: "de" }),
      TARGET_A.sourceBody,
    );
    assert.equal(german.reconciliationState, "READY");
    assert.equal(german.presentationEligible, true);

    const missingGerman = classifyContentTranslationValidity({
      translation: null,
      liveSourceVersion: TARGET_A.sourceVersion,
      originalFields: { body: TARGET_A.sourceBody },
    });
    assert.equal(missingGerman.reconciliationState, "MISSING");
    assert.deepEqual(missingGerman.reasons, ["no_translation_row"]);

    const germanMachine = classify(
      humanRow(TARGET_A, {
        targetLanguage: "de",
        translationKind: "machine",
        translationProvider: "gemini",
      }),
      TARGET_A.sourceBody,
    );
    assert.equal(germanMachine.reconciliationState, "INVALID");
    assert.deepEqual(germanMachine.reasons, ["untranslated_source_equivalent"]);
  });

  it("still rejects a machine echo before persistence", () => {
    assert.throws(
      () =>
        assertTranslatedProseChangedFromSource({
          sourceKind: "discussion_comment",
          sourceLanguage: "en",
          targetLanguage: "fr",
          sourceFields: { body: TARGET_A.sourceBody },
          translatedFields: { body: TARGET_A.sourceBody },
        }),
      (error: unknown) => {
        assert.ok(error instanceof ContentTranslationValidationError);
        assert.equal(error.reasonCode, "UNCHANGED_SOURCE_PROSE");
        return true;
      },
    );
  });

  it("keeps the recovery write guard limited to the two identities", () => {
    assert.equal(
      isHumanConfirmedInvariantDiscussionComment({
        sourceKind: TARGET_A.sourceKind,
        sourceRecordId: "00000000-0000-4000-8000-000000000001",
        sourceVersion: TARGET_A.sourceVersion,
        targetLanguage: TARGET_A.targetLanguage,
        translationKind: "human",
        translatedBody: TARGET_A.translatedBody,
      }),
      false,
    );
    assert.equal(
      isHumanConfirmedInvariantDiscussionComment({
        sourceKind: TARGET_A.sourceKind,
        sourceRecordId: TARGET_A.sourceRecordId,
        sourceVersion: TARGET_A.sourceVersion,
        targetLanguage: TARGET_A.targetLanguage,
        translationKind: "human",
        translatedBody: "test",
      }),
      false,
    );
    assert.equal(
      isHumanConfirmedInvariantDiscussionComment({
        sourceKind: TARGET_A.sourceKind,
        sourceRecordId: TARGET_A.sourceRecordId,
        sourceVersion: TARGET_A.sourceVersion,
        targetLanguage: "de",
        translationKind: "human",
        translatedBody: TARGET_A.translatedBody,
      }),
      false,
    );
  });

  it("writes neither row when one live comment fails preflight", async () => {
    const writes: TranslatedContentRecord[] = [];
    await assert.rejects(
      () =>
        persistHumanConfirmedInvariantDiscussionComments({
          loadComment: async (commentId) => {
            if (commentId === TARGET_A.sourceRecordId) {
              return liveComment(TARGET_A);
            }
            return liveComment(TARGET_B, { status: "pending" });
          },
          findFrenchTranslation: async () => null,
          upsertTranslation: async (record) => {
            writes.push(record);
          },
          buildSourceVersion: versionForBoth(),
        }),
      (error: unknown) => {
        assert.ok(error instanceof HumanConfirmedInvariantPersistAbort);
        assert.equal(error.code, "not_approved");
        assert.equal(error.sourceRecordId, TARGET_B.sourceRecordId);
        return true;
      },
    );
    assert.equal(writes.length, 0);
  });

  it("aborts on a conflicting French row and on a version or body mismatch", async () => {
    const conflictWrites: TranslatedContentRecord[] = [];
    await assert.rejects(
      () =>
        persistHumanConfirmedInvariantDiscussionComments({
          loadComment: async (commentId) =>
            liveComment(commentId === TARGET_A.sourceRecordId ? TARGET_A : TARGET_B),
          findFrenchTranslation: async (target) =>
            target.sourceRecordId === TARGET_A.sourceRecordId
              ? humanRow(TARGET_A, { translationKind: "machine", translationProvider: "gemini" })
              : null,
          upsertTranslation: async (record) => {
            conflictWrites.push(record);
          },
          buildSourceVersion: versionForBoth(),
        }),
      (error: unknown) => {
        assert.ok(error instanceof HumanConfirmedInvariantPersistAbort);
        assert.equal(error.code, "conflicting_translation");
        return true;
      },
    );
    assert.equal(conflictWrites.length, 0);

    await assert.rejects(
      () =>
        persistHumanConfirmedInvariantDiscussionComments({
          loadComment: async () => liveComment(TARGET_A),
          findFrenchTranslation: async () => null,
          upsertTranslation: async () => {
            throw new Error("must not write");
          },
          buildSourceVersion: buildContentTranslationSourceVersion,
        }),
      (error: unknown) => {
        assert.ok(error instanceof HumanConfirmedInvariantPersistAbort);
        assert.equal(error.code, "version_mismatch");
        return true;
      },
    );

    await assert.rejects(
      () =>
        persistHumanConfirmedInvariantDiscussionComments({
          loadComment: async (commentId) => {
            const target = commentId === TARGET_A.sourceRecordId ? TARGET_A : TARGET_B;
            return liveComment(target, {
              body: target.sourceRecordId === TARGET_A.sourceRecordId ? "test" : target.sourceBody,
            });
          },
          findFrenchTranslation: async () => null,
          upsertTranslation: async () => {
            throw new Error("must not write");
          },
          buildSourceVersion: matchingVersion(TARGET_B),
        }),
      (error: unknown) => {
        assert.ok(error instanceof HumanConfirmedInvariantPersistAbort);
        assert.equal(error.code, "body_mismatch");
        assert.equal(error.sourceRecordId, TARGET_A.sourceRecordId);
        return true;
      },
    );
  });

  it("persists missing rows once and does not write on a repeat", async () => {
    const stored = new Map<string, TranslatedContentRecord>();
    const deps = {
      loadComment: async (commentId: string) =>
        liveComment(commentId === TARGET_A.sourceRecordId ? TARGET_A : TARGET_B),
      findFrenchTranslation: async (target: (typeof HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS)[number]) =>
        stored.get(target.sourceRecordId) ?? null,
      upsertTranslation: async (record: TranslatedContentRecord) => {
        stored.set(record.sourceRecordId, record);
      },
      buildSourceVersion: versionForBoth(),
      now: () => "2026-10-10T18:00:00.000Z",
      createTranslationId: () => "translation-fixed",
    };

    const first = await persistHumanConfirmedInvariantDiscussionComments(deps);
    assert.equal(first.written, 2);
    assert.equal(first.unchanged, 0);
    for (const target of HUMAN_CONFIRMED_INVARIANT_DISCUSSION_COMMENTS) {
      const row = stored.get(target.sourceRecordId);
      assert.ok(row);
      assert.equal(isExactHumanConfirmedInvariantTranslation(row), true);
      assert.deepEqual(row.translatedContent, { body: target.translatedBody });
      assert.equal(row.translationKind, "human");
      assert.equal(row.translationProvider, "human");
      assert.equal(row.freshness, "current");
      assert.equal(row.stale, false);
    }

    const second = await persistHumanConfirmedInvariantDiscussionComments(deps);
    assert.equal(second.written, 0);
    assert.equal(second.unchanged, 2);
    assert.equal(stored.size, 2);
  });
});
