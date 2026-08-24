/**
 * Pack 16G — Trusted Publishing contracts (publish without manual review).
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

describe("Pack 16G — Trusted Publishing contracts", () => {
  it("extends blog_capability_grants with publishWithoutManualReview (default false)", () => {
    const types = readRepo("packages/types/src/domain/blog.ts");
    assert.match(types, /publishWithoutManualReview\??:\s*boolean/);
    assert.match(types, /Trusted Publishing/);

    const mongo = readRepo("apps/api/src/modules/blog/persistence/blog.mongo-document.ts");
    assert.match(mongo, /publishWithoutManualReview/);

    const permissions = readRepo("apps/api/src/modules/blog/blog-permissions.ts");
    assert.match(permissions, /resolvePublishWithoutManualReview/);
    assert.match(permissions, /actorMayBypassManualReview/);
  });

  it("Admin toggle route + audits; never trusts a client trusted flag", () => {
    const routes = readRepo("apps/api/src/modules/blog/admin-publishing.routes.ts");
    assert.match(routes, /trusted-publishing/);
    assert.match(routes, /publishWithoutManualReview/);

    const service = readRepo("apps/api/src/modules/blog/admin-publishing.service.ts");
    assert.match(service, /blog\.author\.trusted_publishing\.enable/);
    assert.match(service, /blog\.author\.trusted_publishing\.disable/);
    assert.match(service, /setAdminAuthorTrustedPublishing/);

    const blogService = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(blogService, /resolvePublishWithoutManualReview/);
    assert.match(blogService, /allowTrustedPublishingBypass/);
    assert.doesNotMatch(blogService, /body\.publishWithoutManualReview/);
  });

  it("notification templates cover Trusted Publishing enable/disable", () => {
    assert.equal(
      getNotificationTemplate("blog_author_trusted_publishing_enabled").title,
      "Trusted Publishing enabled",
    );
    assert.equal(
      getNotificationTemplate("blog_author_trusted_publishing_disabled").title,
      "Trusted Publishing disabled",
    );
  });

  it("audit action vocabulary includes Trusted Publishing enable/disable", () => {
    const adminTypes = readRepo("packages/types/src/domain/administration.ts");
    assert.match(adminTypes, /blog\.author\.trusted_publishing\.enable/);
    assert.match(adminTypes, /blog\.author\.trusted_publishing\.disable/);
  });
});
