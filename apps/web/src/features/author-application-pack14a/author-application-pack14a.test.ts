/**
 * Pack 14A — Admin Pending Author Applications UI contracts.
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

describe("Pack 14A — Author application recovery UI", () => {
  it("Admin Publishing exposes Pending applications queue + same review modal", () => {
    const section = readWeb("features/administration/components/AdminPublishingSection.tsx");
    assert.match(section, /Pending applications/);
    assert.match(section, /listAdminPendingAuthorApplications/);
    assert.match(section, /reconcileAdminPendingAuthorApplications/);
    assert.match(section, /AuthorApplicationReviewModal/);
    assert.match(section, /Mark for resubmit/);
    assert.match(section, /canonical review authority/);
  });

  it("Admin publishing API targets pending/reconcile/recovery-reset", () => {
    const api = readWeb("features/administration/admin-publishing-api.ts");
    assert.match(api, /author-applications\/pending/);
    assert.match(api, /author-applications\/reconcile/);
    assert.match(api, /recovery-reset/);
  });
});
