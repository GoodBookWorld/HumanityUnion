import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDiscussionCommentDomId,
  buildInitiativeDiscussionCommentHref,
  parseDiscussionCommentFocusFromHash,
  planCollaborationNotificationScroll,
  planDiscussionCommentDeepLinkScroll,
  resolveDiscussionCommentFocusTarget,
} from "./discussion-comment-deep-link.js";

describe("Discussion comment deep link", () => {
  it("generated link contains the exact comment target", () => {
    const href = buildInitiativeDiscussionCommentHref("init-42", "cmt-source-9");
    assert.equal(href, "/initiatives/public/init-42#comment-cmt-source-9");
    assert.match(href, /#comment-cmt-source-9$/);
  });

  it("target DOM id is stable and matches the decoded hash fragment", () => {
    const commentId = "cmt-source-9";
    const domId = buildDiscussionCommentDomId(commentId);
    assert.equal(domId, "comment-cmt-source-9");
    assert.equal(parseDiscussionCommentFocusFromHash(`#${domId}`), commentId);
    assert.equal(parseDiscussionCommentFocusFromHash("#comment-cmt-source-9"), commentId);
  });

  it("direct navigation plans a scroll to the intended comment once rendered", () => {
    const plan = planDiscussionCommentDeepLinkScroll({
      focusCommentId: "cmt-target",
      filter: "all",
      renderedCommentIds: ["cmt-other", "cmt-target", "cmt-third"],
      hasMore: false,
      loadingMore: false,
      alreadyScrolledFor: null,
    });

    assert.deepEqual(plan, {
      action: "scroll",
      commentId: "cmt-target",
      domId: "comment-cmt-target",
    });
  });

  it("waits for async pages instead of scrolling an absent comment", () => {
    const waiting = planDiscussionCommentDeepLinkScroll({
      focusCommentId: "cmt-target",
      filter: "all",
      renderedCommentIds: ["cmt-other"],
      hasMore: true,
      loadingMore: false,
      alreadyScrolledFor: null,
    });
    assert.equal(waiting.action, "load_more");

    const scrolledAfterLoad = planDiscussionCommentDeepLinkScroll({
      focusCommentId: "cmt-target",
      filter: "all",
      renderedCommentIds: ["cmt-other", "cmt-target"],
      hasMore: false,
      loadingMore: false,
      alreadyScrolledFor: null,
    });
    assert.equal(scrolledAfterLoad.action, "scroll");
    if (scrolledAfterLoad.action === "scroll") {
      assert.equal(scrolledAfterLoad.commentId, "cmt-target");
    }
  });

  it("unrelated comments are not selected as the focus target", () => {
    assert.equal(
      resolveDiscussionCommentFocusTarget(["cmt-a", "cmt-b"], "cmt-missing"),
      null,
    );
    assert.equal(resolveDiscussionCommentFocusTarget(["cmt-a", "cmt-b"], "cmt-b"), "cmt-b");
    assert.equal(resolveDiscussionCommentFocusTarget(["cmt-a", "cmt-b"], "cmt-a"), "cmt-a");
  });

  it("collaboration notification keeps Discussion title visible then list nearest", () => {
    const desktop = planCollaborationNotificationScroll({ viewportWidth: 1024 });
    assert.equal(desktop.scrollOwner, "center_pane");
    assert.equal(desktop.titleDomId, "pie-discussion-title");
    assert.equal(desktop.listDomId, "pie-collaboration-list");
    assert.equal(desktop.titleBlock, "start");
    assert.equal(desktop.listBlock, "nearest");
    assert.equal(desktop.containerSelector, ".pie-layout__center");

    const mobile = planCollaborationNotificationScroll({ viewportWidth: 400 });
    assert.equal(mobile.scrollOwner, "document");
  });
});
