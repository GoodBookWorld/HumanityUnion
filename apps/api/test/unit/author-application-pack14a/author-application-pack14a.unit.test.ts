/**
 * Pack 14A — Legacy Author application recovery contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Pack 14A — Author application recovery contracts", () => {
  it("defines stuck-application reconciliation with notification dedupe", () => {
    const reconcile = readRepo(
      "apps/api/src/modules/blog/blog-author-application-reconciliation.ts",
    );
    assert.match(reconcile, /reconcilePendingAuthorApplications/);
    assert.match(reconcile, /listAdminPendingAuthorApplications/);
    assert.match(reconcile, /markInvalidLegacyAuthorApplicationForResubmit/);
    assert.match(reconcile, /Does not change application status/);
    assert.match(reconcile, /startAuthorApplicationReconciliationOnce/);

    const notify = readRepo(
      "apps/api/src/modules/blog/blog-author-application-notifications.ts",
    );
    assert.match(notify, /existsNotificationForRecipientEventAndRelatedEntity/);
    assert.match(notify, /skippedExistingCount/);

    const index = readRepo("apps/api/src/index.ts");
    assert.match(index, /startAuthorApplicationReconciliationOnce/);
  });

  it("exposes Admin pending queue and recovery routes independent of notifications", () => {
    const routes = readRepo("apps/api/src/modules/blog/admin-publishing.routes.ts");
    assert.match(routes, /\/author-applications\/pending/);
    assert.match(routes, /\/author-applications\/reconcile/);
    assert.match(routes, /recovery-reset/);

    const repo = readRepo("apps/api/src/modules/blog/persistence/blog.repository.ts");
    assert.match(repo, /listPendingBlogAuthorApplications/);
    assert.match(repo, /"pending"/);
  });

  it("notification persistence supports recipient/event/entity existence checks", () => {
    const types = readRepo("apps/api/src/modules/notifications/notification.types.ts");
    assert.match(types, /existsForRecipientEventAndRelatedEntity/);
    const mongo = readRepo(
      "apps/api/src/modules/notifications/persistence/notification-mongo.persistence.ts",
    );
    assert.match(mongo, /existsForRecipientEventAndRelatedEntity/);
  });
});
