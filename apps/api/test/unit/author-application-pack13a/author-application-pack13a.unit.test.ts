/**
 * Pack 13A — Author application Admin delivery + Invite/Refuse contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getNotificationTemplate } from "../../../src/modules/notifications/notification.templates.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 13A — Author application delivery contracts", () => {
  it("reuses blog_author_applications + member_notifications (no author_notifications)", () => {
    assert.equal(MONGO_COLLECTIONS.blogAuthorApplications, "blog_author_applications");
    assert.equal(MONGO_COLLECTIONS.memberNotifications, "member_notifications");
    const collections = readRepo("apps/api/src/infrastructure/mongodb/mongo-collections.ts");
    assert.doesNotMatch(collections, /author_notifications/);
  });

  it("submit notifies applicant and Admins; Invite/Refuse routes exist", () => {
    const notify = readRepo(
      "apps/api/src/modules/blog/blog-author-application-notifications.ts",
    );
    assert.match(notify, /emitBlogAuthorApplicationAdminReviewNotifications/);
    assert.match(notify, /blog_author_application_review_requested/);
    assert.match(notify, /listAuthUsersForAdmin/);
    assert.match(notify, /role:\s*["']admin["']/);

    const routes = readRepo("apps/api/src/modules/blog/blog.routes.ts");
    assert.match(routes, /admin-review/);
    assert.match(routes, /\/invite/);
    assert.match(routes, /\/refuse/);

    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /getAdminAuthorApplicationReview/);
    assert.match(service, /decideBlogAuthorApplicationAsAdmin/);
    assert.match(service, /blog\.author_application\.submit/);
    assert.match(service, /status === ["']approved["'] && input\.decision === ["']approve["']/);
  });

  it("confirmation and Admin review templates use Pack 13A copy", () => {
    const submitted = getNotificationTemplate("blog_author_application_submitted");
    assert.equal(submitted.title, "Application received");
    assert.match(submitted.message, /respond as soon as possible/);

    const review = getNotificationTemplate("blog_author_application_review_requested");
    assert.equal(review.title, "New Author application");

    const accepted = getNotificationTemplate("blog_author_application_approved");
    assert.equal(accepted.title, "Author application accepted");

    const declined = getNotificationTemplate("blog_author_application_declined");
    assert.equal(declined.title, "Author application update");
  });
});
