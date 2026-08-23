/**
 * Pack 13A — Author application Web contracts (confirmation + Admin modal).
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

describe("Pack 13A — Authoring + Notification Center review modal", () => {
  it("Participant confirmation copy and Submit → Submitting… → Submitted", () => {
    const page = readWeb("features/blog/components/AuthoringPageContent.tsx");
    assert.match(page, /respond as soon as possible/);
    assert.match(page, /Submitting…/);
    assert.match(page, /["']Submitted["']/);
    assert.match(page, /aria-busy/);
  });

  it("Notification Center opens Author review modal by event type", () => {
    const center = readWeb(
      "features/notifications/components/NotificationCenterPageContent.tsx",
    );
    assert.match(center, /blog_author_application_review_requested/);
    assert.match(center, /AuthorApplicationReviewModal/);
    assert.match(center, /Review application/);
    assert.match(center, /onReviewAuthorApplication/);
  });

  it("Review modal exposes Invite and Refuse against Admin APIs", () => {
    const modal = readWeb("features/blog/components/AuthorApplicationReviewModal.tsx");
    assert.match(modal, /Invite/);
    assert.match(modal, /Refuse/);
    assert.match(modal, /inviteAuthorApplication/);
    assert.match(modal, /refuseAuthorApplication/);
    assert.match(modal, /fetchAdminAuthorApplicationReview/);

    const api = readWeb("features/blog/authoring-api.ts");
    assert.match(api, /admin-review/);
    assert.match(api, /\/invite/);
    assert.match(api, /\/refuse/);
  });
});
