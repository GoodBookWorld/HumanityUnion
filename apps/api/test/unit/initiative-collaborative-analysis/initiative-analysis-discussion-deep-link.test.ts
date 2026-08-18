import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDiscussionCommentUrl } from "../../../src/modules/initiative-collaborative-analysis/initiative-analysis-source-snapshot.service.js";

describe("Collaborative Analysis discussion deep links", () => {
  it("generated View in Discussion link contains the exact comment target", () => {
    const href = buildDiscussionCommentUrl("init-42", "cmt-source-9");
    assert.equal(href, "/initiatives/public/init-42#comment-cmt-source-9");
    assert.match(href, /#comment-cmt-source-9$/);
    assert.doesNotMatch(href, /#discussion$/);
  });

  it("encodes initiative and comment ids in the canonical anchor", () => {
    const href = buildDiscussionCommentUrl("init/with space", "cmt/a b");
    assert.equal(
      href,
      "/initiatives/public/init%2Fwith%20space#comment-cmt%2Fa%20b",
    );
  });
});
