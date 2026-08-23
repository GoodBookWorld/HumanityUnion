/**
 * Pack 14B — Publication review notification contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getNotificationTemplate } from "../../../src/modules/notifications/notification.templates.js";
import {
  blogPublicationReviewNotificationEntityId,
  parseBlogPublicationReviewPostId,
} from "../../../src/modules/blog/blog-publication-notifications.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 14B — Publication review notification contracts", () => {
  it("submit emits Admin review notifications; save draft path does not", () => {
    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /emitBlogPublicationAdminReviewNotifications/);
    assert.match(service, /administrativelyBlocked === true/);
    assert.match(service, /cannot be submitted for review/);

    const notify = readRepo("apps/api/src/modules/blog/blog-publication-notifications.ts");
    assert.match(notify, /blog_publication_review_requested/);
    assert.match(notify, /existsNotificationForRecipientEventAndRelatedEntity/);
    assert.match(notify, /blogPublicationReviewNotificationEntityId/);
  });

  it("Admin pending-review queue is independent of notifications", () => {
    const routes = readRepo("apps/api/src/modules/blog/admin-publishing.routes.ts");
    assert.match(routes, /\/publications\/pending-review/);
    assert.match(routes, /reconcile-review-notifications/);

    const reconcile = readRepo(
      "apps/api/src/modules/blog/blog-publication-review-reconciliation.ts",
    );
    assert.match(reconcile, /listAdminPendingPublicationReviews/);
    assert.match(reconcile, /reconcilePendingPublicationReviews/);
    assert.match(reconcile, /Does not change publication status/);

    const index = readRepo("apps/api/src/index.ts");
    assert.match(index, /startPublicationReviewReconciliationOnce/);
  });

  it("notification template + versioned review-cycle identity", () => {
    const template = getNotificationTemplate("blog_publication_review_requested");
    assert.equal(template.title, "Publication submitted for review");
    assert.equal(getNotificationTemplate("blog_post_published").title, "Publication approved");
    assert.equal(
      getNotificationTemplate("blog_post_changes_requested").title,
      "Publication returned for changes",
    );
    assert.equal(getNotificationTemplate("blog_post_declined").title, "Publication not accepted");

    const entityId = blogPublicationReviewNotificationEntityId(
      "post-1",
      "2026-04-01T12:00:00.000Z",
    );
    assert.equal(entityId, "post-1|2026-04-01T12:00:00.000Z");
    assert.equal(parseBlogPublicationReviewPostId(entityId), "post-1");
  });
});
