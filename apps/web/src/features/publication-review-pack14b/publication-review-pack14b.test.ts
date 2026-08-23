/**
 * Pack 14B — Admin Pending Review UI contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 14B — Publication review UI", () => {
  it("Admin Publishing exposes Pending Review queue linking to editorial review", () => {
    const section = readWeb("features/administration/components/AdminPublishingSection.tsx");
    assert.match(section, /Pending Review/);
    assert.match(section, /listAdminPendingPublicationReviews/);
    assert.match(section, /reconcileAdminPendingPublicationReviews/);
    assert.match(section, /Review publication/);
    assert.match(section, /canonical review authority/);
  });

  it("Admin publishing API + Notification Center wire review open path", () => {
    const api = readWeb("features/administration/admin-publishing-api.ts");
    assert.match(api, /publications\/pending-review/);
    assert.match(api, /reconcile-review-notifications/);

    const notifications = readWeb(
      "features/notifications/components/NotificationCenterPageContent.tsx",
    );
    assert.match(notifications, /blog_publication_review_requested/);
    assert.match(notifications, /Review publication/);
  });
});
