/**
 * Localization Closure 03C.5B.2 — repeated-label partial-removal fail-closed.
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

describe("Localization Closure 03C.5B.2 — repeated-label partial removal", () => {
  it("A. two Discussion tokens, Author leaves only the second-looking occurrence → literal", () => {
    const canonical =
      "First {lifecycleStage:discussion}. Later {lifecycleStage:discussion}.";
    const presentedEdit = "First section removed. Later Discussion.";
    const merged = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit,
    });
    assert.equal(merged, presentedEdit);
    assert.equal(textContainsLifecycleStageToken(merged), false);
  });

  it("B. two Discussion tokens, Author leaves only the first-looking occurrence → literal", () => {
    const canonical =
      "First {lifecycleStage:discussion}. Later {lifecycleStage:discussion}.";
    const presentedEdit = "First Discussion. Later section removed.";
    const merged = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit,
    });
    assert.equal(merged, presentedEdit);
    assert.equal(textContainsLifecycleStageToken(merged), false);
  });

  it("C. two Discussion tokens, Author leaves both and edits prose → both tokens preserved", () => {
    const canonical =
      "First {lifecycleStage:discussion}. Later {lifecycleStage:discussion}.";
    const presentedEdit = "First Discussion carefully. Later Discussion too.";
    assert.equal(
      mergeLifecycleStageTokensFromAuthorPresentation({
        canonicalField: canonical,
        presentedEdit,
      }),
      "First {lifecycleStage:discussion} carefully. Later {lifecycleStage:discussion} too.",
    );
  });

  it("D. two Discussion tokens, Author removes both → literal, no Discussion token", () => {
    const canonical =
      "First {lifecycleStage:discussion}. Later {lifecycleStage:discussion}.";
    const presentedEdit = "First section gone. Later section gone.";
    const merged = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit,
    });
    assert.equal(merged, presentedEdit);
    assert.equal(textContainsLifecycleStageToken(merged), false);
  });

  it("E. one Discussion token, Author keeps it and edits prose → token preserved", () => {
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

  it("F. Discussion removed but Collaborative Analysis retained → CA token preserved independently", () => {
    const canonical = `${ANALYSIS}: topic from ${DISCUSSION}`;
    const presentedEdit = "Collaborative Analysis: topic from Community Debate";
    const merged = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit,
    });
    assert.equal(merged, `${ANALYSIS}: topic from Community Debate`);
    assert.match(merged, /\{lifecycleStage:analysis\}/);
    assert.doesNotMatch(merged, /\{lifecycleStage:discussion\}/);
  });
});
