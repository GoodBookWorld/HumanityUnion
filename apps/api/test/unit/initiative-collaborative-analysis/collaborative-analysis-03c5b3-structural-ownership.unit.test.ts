/**
 * Localization Closure 03C.5B.3 — structural ownership for Author token preservation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  lifecycleStageToken,
  mergeLifecycleStageTokensFromAuthorPresentation,
  textContainsLifecycleStageToken,
} from "@hu/types";

const ANALYSIS = lifecycleStageToken("analysis");
const DISCUSSION = lifecycleStageToken("discussion");

describe("Localization Closure 03C.5B.3 — structural ownership proof", () => {
  it("A. new leading Discussion while original slot renamed → literal, no token", () => {
    const canonical = "See {lifecycleStage:discussion} for details.";
    const presentedEdit =
      "Discussion is important. See topic for details.";
    const merged = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit,
    });
    assert.equal(merged, presentedEdit);
    assert.equal(textContainsLifecycleStageToken(merged), false);
  });

  it("B. relocated same label after original slot removed → literal, no token", () => {
    const canonical = "See {lifecycleStage:discussion} for details.";
    const presentedEdit =
      "See topic for details. Discussion is important.";
    const merged = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit,
    });
    assert.equal(merged, presentedEdit);
    assert.equal(textContainsLifecycleStageToken(merged), false);
  });

  it("C. stable ownership with surrounding prose addition → token preserved", () => {
    const canonical = "See {lifecycleStage:discussion} for details.";
    const presentedEdit = "Please carefully see Discussion for details.";
    assert.equal(
      mergeLifecycleStageTokensFromAuthorPresentation({
        canonicalField: canonical,
        presentedEdit,
      }),
      "Please carefully see {lifecycleStage:discussion} for details.",
    );
  });

  it("D. trailing prose edit with left anchor intact → token preserved (conservative)", () => {
    // Left alphanumeric anchors ["see"] still prove ownership; right was rewritten.
    const canonical = "See {lifecycleStage:discussion} for details.";
    const presentedEdit = "See Discussion for important details.";
    assert.equal(
      mergeLifecycleStageTokensFromAuthorPresentation({
        canonicalField: canonical,
        presentedEdit,
      }),
      "See {lifecycleStage:discussion} for important details.",
    );
  });

  it("F. distinct labels — preserve only structurally proven slots", () => {
    const canonical = `${ANALYSIS}: topic from ${DISCUSSION}`;
    const removedDiscussion = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit: "Collaborative Analysis: topic from Community Debate",
    });
    assert.equal(
      removedDiscussion,
      `${ANALYSIS}: topic from Community Debate`,
    );

    // Keep shared anchors "topic from" so both slots remain structurally proven.
    const bothStable = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit: "Collaborative Analysis: topic from Discussion today",
    });
    assert.equal(
      bothStable,
      `${ANALYSIS}: topic from ${DISCUSSION} today`,
    );

    const relocatedDiscussion = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit:
        "Discussion first. Collaborative Analysis: topic from nowhere",
    });
    assert.equal(
      relocatedDiscussion,
      `Discussion first. ${ANALYSIS}: topic from nowhere`,
    );
    assert.doesNotMatch(relocatedDiscussion, /\{lifecycleStage:discussion\}/);
  });
});
