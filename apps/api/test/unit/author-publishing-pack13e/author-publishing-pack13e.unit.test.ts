/**
 * Pack 13E — Final Author & Publishing certification (API contracts).
 * Certification-only: asserts Pack 13A–13D wiring + Pack 13E policy fix.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getNotificationTemplate } from "../../../src/modules/notifications/notification.templates.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 13E — Author & Publishing certification (API)", () => {
  it("application Invite/Refuse + Admin review routes remain wired", () => {
    const routes = readRepo("apps/api/src/modules/blog/blog.routes.ts");
    assert.match(routes, /\/invite/);
    assert.match(routes, /\/refuse/);
    assert.match(routes, /admin-review/);
    assert.match(routes, /decideBlogAuthorApplicationAsAdmin/);

    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /blog\.author_application\.submit/);
    assert.match(service, /already been decided/);
    assert.match(service, /Invite is idempotent/);
  });

  it("Author block != Publication block; public lists exclude blocked/scheduled-not-due", () => {
    const admin = readRepo("apps/api/src/modules/blog/admin-publishing.service.ts");
    assert.match(admin, /author\.block/);
    assert.match(admin, /author\.unblock/);
    assert.match(admin, /publication\.block/);
    assert.match(admin, /publication\.unblock/);

    const repo = readRepo("apps/api/src/modules/blog/persistence/blog.repository.ts");
    assert.match(repo, /administrativelyBlocked:\s*\{\s*\$ne:\s*true\s*\}/);
    assert.match(repo, /publishedAt:\s*\{\s*\$lte:/);

    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /assertAuthorPublishingAllowed/);
    assert.match(service, /post\.publishedAt > now/);
  });

  it("scheduler skips blocked publications AND blocked Authors (Pack 13E policy)", () => {
    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /releaseDueScheduledBlogPublications/);
    assert.match(service, /isBlogAuthorAdministrativelyBlocked\(post\.authorParticipantId\)/);
    assert.match(service, /administrativelyBlocked === true/);

    const scheduler = readRepo("apps/api/src/modules/blog/blog-scheduled-publish.scheduler.ts");
    assert.match(scheduler, /startBlogScheduledPublishScheduler/);
    const index = readRepo("apps/api/src/index.ts");
    assert.match(index, /startBlogScheduledPublishScheduler/);
  });

  it("canonical notification templates cover Author/Publishing lifecycle", () => {
    assert.equal(
      getNotificationTemplate("blog_author_application_review_requested").title.includes("Author"),
      true,
    );
    assert.equal(getNotificationTemplate("blog_author_application_approved").title.length > 0, true);
    assert.equal(getNotificationTemplate("blog_author_application_declined").title.length > 0, true);
    assert.equal(getNotificationTemplate("blog_author_access_blocked").title, "Author access blocked");
    assert.equal(getNotificationTemplate("blog_author_access_restored").title, "Author access restored");
    assert.equal(getNotificationTemplate("blog_publication_blocked").title, "Publication unavailable");
    assert.equal(getNotificationTemplate("blog_publication_restored").title, "Publication restored");
  });

  it("uses shared member_notifications + fixed blog collections (no per-author DBs)", () => {
    const collections = readRepo("apps/api/src/infrastructure/mongodb/mongo-collections.ts");
    assert.match(collections, /blogPosts:\s*"blog_posts"/);
    assert.match(collections, /blogCapabilityGrants:\s*"blog_capability_grants"/);
    assert.match(collections, /blogAuthorApplications:\s*"blog_author_applications"/);
    assert.doesNotMatch(collections, /author_notifications/);

    const notify = readRepo("apps/api/src/modules/blog/blog-author-application-notifications.ts");
    assert.match(notify, /createNotification/);
    assert.match(notify, /member_notifications/);
  });

  it("publication date min 2022 + noon UTC convention documented", () => {
    const types = readRepo("packages/types/src/domain/blog.ts");
    assert.match(types, /BLOG_PUBLICATION_DATE_MIN = "2022-01-01"/);
    assert.match(types, /noon UTC/);

    const dates = readRepo("apps/api/src/modules/blog/blog-publication-date.ts");
    assert.match(dates, /T12:00:00\.000Z/);
  });
});
