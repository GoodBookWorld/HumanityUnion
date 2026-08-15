import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveAssistantLaunchContext } from "../humanity-union-assistant/resolve-assistant-surface.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Editorial Review Pack 06 — Web", () => {
  it("Canonical editorial route and pages exist", () => {
    const queuePage = read("app/workspace/editorial/page.tsx");
    const detailPage = read("app/workspace/editorial/[postId]/page.tsx");
    assert.match(queuePage, /EditorialQueuePageContent/);
    assert.match(queuePage, /Editorial Review/);
    assert.match(queuePage, /surfaceId="blog"/);
    assert.match(detailPage, /EditorialReviewPageContent/);
    assert.match(detailPage, /HumanityUnionAssistantWidget/);
  });

  it("Workspace nav shows Editorial Review only via editorialReviewHref", () => {
    const nav = read("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /Editorial Review/);
    assert.match(nav, /editorialReviewHref/);
    assert.match(nav, /setEditorialRoute/);
    assert.match(nav, /publishingWorkspaceHref/);
    // Canonical path lives on authoring access state / route files (not hard-coded for Authors).
    assert.match(read("app/workspace/editorial/page.tsx"), /Editorial Review/);
  });

  it("Queue and review surfaces use Design System primitives", () => {
    const queue = read("features/blog/components/EditorialQueuePageContent.tsx");
    const review = read("features/blog/components/EditorialReviewPageContent.tsx");
    assert.match(queue, /Pending Review/);
    assert.match(queue, /StatusBanner/);
    assert.match(queue, /Card/);
    assert.match(review, /Approve & Publish/);
    assert.match(review, /Request Changes/);
    assert.match(review, /Publish After Safety Review/);
    assert.match(review, /ConfirmDialog/);
    assert.match(review, /Editorial guidance/);
    assert.match(review, /BlogArticleBody/);
    assert.doesNotMatch(review, /author score|trust percentage|reputation/i);
  });

  it("Author Publishing UX surfaces Changes Requested", () => {
    const editor = read("features/blog/components/BlogPostEditor.tsx");
    const list = read("features/blog/components/PublicationListItem.tsx");
    assert.match(editor, /Changes Requested/);
    assert.match(editor, /reviewNote/);
    assert.match(list, /Changes Requested/);
  });

  it("Editorial API never accepts reviewedByParticipantId from client", () => {
    const api = read("features/blog/editorial-api.ts");
    assert.match(api, /request-changes/);
    assert.match(api, /publish-after-safety-review/);
    assert.match(api, /expectedUpdatedAt/);
    assert.doesNotMatch(api, /reviewedByParticipantId/);
  });

  it("Assistant surface resolves editorial path to blog", () => {
    assert.equal(resolveAssistantLaunchContext("/workspace/editorial").surfaceId, "blog");
    assert.equal(
      resolveAssistantLaunchContext("/workspace/editorial/post-1").surfaceId,
      "blog",
    );
  });

  it("Assistant widget copy forbids approve/publish actions", () => {
    const page = read("app/workspace/editorial/page.tsx");
    assert.match(page, /never approves|never approve/i);
    assert.match(page, /publish/i);
  });
});
