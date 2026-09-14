/**
 * Localization Closure 03C.5B.1 — unambiguous Author lifecycle-token remapping.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  lifecycleStageToken,
  mergeLifecycleStageTokensFromAuthorPresentation,
  textContainsLifecycleStageToken,
} from "@hu/types";

const DISCUSSION = lifecycleStageToken("discussion");

describe("Localization Closure 03C.5B.1 — ambiguous remap fail-closed", () => {
  it("A. newly authored leading label + original label → fail closed to literal (no token)", () => {
    const canonical = "See {lifecycleStage:discussion} for details.";
    const presentedEdit =
      "Discussion is important. See Discussion for details.";
    const merged = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit,
    });
    assert.equal(merged, presentedEdit);
    assert.equal(textContainsLifecycleStageToken(merged), false);
  });

  it("B. prose-only edit with a single label occurrence → discussion token preserved", () => {
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

  it("C. no persisted tokens + Author adds Discussion → no token invented", () => {
    const canonical = "See notes for details.";
    const presentedEdit = "See Discussion notes for details.";
    const merged = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit,
    });
    assert.equal(merged, presentedEdit);
    assert.equal(textContainsLifecycleStageToken(merged), false);
  });

  it("D. repeated persisted slots with unambiguous edits → tokens preserved in order", () => {
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

  it("E. repeated persisted slots plus an extra unrelated label → fail closed to literal", () => {
    const canonical = `${DISCUSSION} then ${DISCUSSION}.`;
    const presentedEdit =
      "Discussion then Discussion, and also Discussion later.";
    const merged = mergeLifecycleStageTokensFromAuthorPresentation({
      canonicalField: canonical,
      presentedEdit,
    });
    assert.equal(merged, presentedEdit);
    assert.equal(textContainsLifecycleStageToken(merged), false);
  });
});
