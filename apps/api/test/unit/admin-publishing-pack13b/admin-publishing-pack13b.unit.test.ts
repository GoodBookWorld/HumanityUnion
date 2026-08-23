/**
 * Pack 13B — Admin Author registry + Publication moderation contracts.
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

describe("Pack 13B — Admin Publishing contracts", () => {
  it("exposes Admin Authors/Publications routes and soft-block APIs", () => {
    const routes = readRepo("apps/api/src/modules/blog/admin-publishing.routes.ts");
    assert.match(routes, /\/authors/);
    assert.match(routes, /\/publications/);
    assert.match(routes, /\/block/);
    assert.match(routes, /\/unblock/);

    const app = readRepo("apps/api/src/app.ts");
    assert.match(app, /\/api\/v1\/admin\/publishing/);

    const service = readRepo("apps/api/src/modules/blog/admin-publishing.service.ts");
    assert.match(service, /listAdminAuthors/);
    assert.match(service, /blockAdminAuthor/);
    assert.match(service, /blockAdminPublication/);
    assert.match(service, /author\.block/);
    assert.match(service, /publication\.block/);
  });

  it("keeps Author block independent of Publication block; public lists exclude blocked posts", () => {
    const repo = readRepo("apps/api/src/modules/blog/persistence/blog.repository.ts");
    assert.match(repo, /administrativelyBlocked:\s*\{\s*\$ne:\s*true\s*\}/);

    const service = readRepo("apps/api/src/modules/blog/blog.service.ts");
    assert.match(service, /administrativelyBlocked === true/);
    assert.match(service, /assertAuthorPublishingAllowed/);
    assert.match(service, /author_blocked/);
  });

  it("notification templates cover Author and Publication block/restore", () => {
    assert.equal(getNotificationTemplate("blog_author_access_blocked").title, "Author access blocked");
    assert.equal(getNotificationTemplate("blog_author_access_restored").title, "Author access restored");
    assert.equal(getNotificationTemplate("blog_publication_blocked").title, "Publication unavailable");
    assert.equal(getNotificationTemplate("blog_publication_restored").title, "Publication restored");
  });
});
