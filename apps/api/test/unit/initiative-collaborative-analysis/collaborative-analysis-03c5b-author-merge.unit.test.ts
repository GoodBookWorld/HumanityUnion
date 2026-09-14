/**
 * Localization Closure 03C.5B — token-preserving Author save merge.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  lifecycleStageToken,
  mergeCollaborativeAnalysisAuthorSaveFields,
  mergeLifecycleStageTokensFromAuthorPresentation,
  presentLifecycleStageTokensAsEnglish,
  textContainsLifecycleStageToken,
} from "@hu/types";

const ANALYSIS = lifecycleStageToken("analysis");
const DISCUSSION = lifecycleStageToken("discussion");

describe("Localization Closure 03C.5B — Author edit token preservation", () => {
  it("A. unchanged displayed field → original tokenized canonical preserved", () => {
    const canonical =
      "Review the evidence from {lifecycleStage:discussion} before proceeding.";
    const presented = presentLifecycleStageTokensAsEnglish(canonical);
    assert.equal(
      mergeLifecycleStageTokensFromAuthorPresentation({
        canonicalField: canonical,
        presentedEdit: presented,
      }),
      canonical,
    );
  });

  it("B. Author edits prose before/after an unchanged lifecycle label → token preserved", () => {
    const canonical =
      "Review the evidence from {lifecycleStage:discussion} before proceeding.";
    const presentedEdit =
      "Carefully review the evidence from Discussion before proceeding.";
    assert.equal(
      mergeLifecycleStageTokensFromAuthorPresentation({
        canonicalField: canonical,
        presentedEdit,
      }),
      "Carefully review the evidence from {lifecycleStage:discussion} before proceeding.",
    );
  });

  it("C. punctuation/sentence structure around unchanged label → token preserved", () => {
    const canonical = `Notes from ${DISCUSSION}; then continue.`;
    const presentedEdit = "Notes from Discussion — then continue!";
    assert.equal(
      mergeLifecycleStageTokensFromAuthorPresentation({
        canonicalField: canonical,
        presentedEdit,
      }),
      "Notes from {lifecycleStage:discussion} — then continue!",
    );
  });

  it("D. Author changes the lifecycle label itself → literal Author text; token not reinserted", () => {
    const canonical =
      "Review the evidence from {lifecycleStage:discussion} before proceeding.";
    const presentedEdit =
      "Review the evidence from Community Debate before proceeding.";
    const merged = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit,
    });
    assert.equal(merged, presentedEdit);
    assert.equal(textContainsLifecycleStageToken(merged), false);
  });

  it("E. repeated identical stage tokens → each occurrence handled independently", () => {
    const canonical = `${DISCUSSION} then ${DISCUSSION} again.`;
    const presentedEdit = "Discussion — then Discussion again soon.";
    assert.equal(
      mergeLifecycleStageTokensFromAuthorPresentation({
        canonicalField: canonical,
        presentedEdit,
      }),
      "{lifecycleStage:discussion} — then {lifecycleStage:discussion} again soon.",
    );
  });

  it("F. Author-written unrelated 'Discussion' is never auto-tokenized when no persisted slot remains", () => {
    const canonical = "Plain author notes without stage slots.";
    const presentedEdit = "Plain author notes about Discussion without stage slots.";
    const merged = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit,
    });
    assert.equal(merged, presentedEdit);
    assert.equal(textContainsLifecycleStageToken(merged), false);
  });

  it("F2. Extra 'Discussion' beyond persisted slots is ambiguous → fail closed to literal", () => {
    const canonical = `see ${DISCUSSION}`;
    const presentedEdit = "see Discussion and also Discussion later";
    const merged = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit,
    });
    assert.equal(merged, presentedEdit);
    assert.equal(textContainsLifecycleStageToken(merged), false);
  });

  it("G. ambiguous / unusable mapping fails safely to submitted literal (no global replace)", () => {
    // Malformed persisted token plan cannot be split → keep Author text.
    const merged = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: "Start {lifecycleStage:NOT_A_STAGE} end",
      presentedEdit: "Start Discussion end",
    });
    assert.equal(merged, "Start Discussion end");
    assert.equal(textContainsLifecycleStageToken(merged), false);

    // Partial multi-slot override keeps unchanged anchors only (no inventing tokens).
    const partial = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: `${ANALYSIS}: topic from ${DISCUSSION}`,
      presentedEdit: "Collaborative Analysis: topic from Community Debate",
    });
    assert.equal(partial, `${ANALYSIS}: topic from Community Debate`);
    assert.doesNotMatch(partial, /\{lifecycleStage:discussion\}/);
  });

  it("field-bag merge applies slot-aware semantics per field", () => {
    const merged = mergeCollaborativeAnalysisAuthorSaveFields({
      canonical: {
        title: `${ANALYSIS}: Garden`,
        summary: `Based on ${DISCUSSION} comments.`,
      },
      presented: {
        // Keep right-anchor "Garden"; rename alone would fail structural proof.
        title: "Collaborative Analysis: Garden draft",
        summary: "Carefully based on Discussion comments today.",
      },
    });
    assert.equal(merged.title, `${ANALYSIS}: Garden draft`);
    assert.equal(
      merged.summary,
      "Carefully based on {lifecycleStage:discussion} comments today.",
    );
  });
});
