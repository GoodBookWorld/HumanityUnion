/**
 * HU-RRP-03I — status-only review approve is rejected; confirm-appointment is canonical.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { RRP_REVIEW_APPROVE_REJECTED_MESSAGE } from "../../../src/modules/rrp-application/rrp-application.validation.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("HU-RRP-03I legacy status-only review approve removed", () => {
  it("Admin WEB Approve uses confirm-appointment only", () => {
    const modal = read(
      "apps/web/src/features/administration/components/AdminRrpApplicationModal.tsx",
    );
    const api = read("apps/web/src/features/administration/admin-rrp-application-api.ts");
    assert.match(modal, /confirmAdminRrpAppointment/);
    assert.match(api, /confirm-appointment/);
    assert.match(api, /decision: AdminRrpApplicationReviewDecision/);
    assert.doesNotMatch(api, /decision:\s*"approve"/);
  });

  it("shared review decision type excludes approve; confirm decision is separate", () => {
    const types = read("packages/types/src/domain/rrp-application.ts");
    assert.match(types, /AdminRrpConfirmAppointmentDecision = "approve"/);
    assert.match(
      types,
      /AdminRrpApplicationReviewDecision =\s*\| "mark_under_review"\s*\| "request_information"\s*\| "reject"/,
    );
    assert.doesNotMatch(
      types,
      /AdminRrpApplicationReviewDecision =[\s\S]*\| "approve"\s*\| "reject"/,
    );
  });

  it("validation rejects approve with stable 422 message pointing at confirm-appointment", () => {
    const validation = read(
      "apps/api/src/modules/rrp-application/rrp-application.validation.ts",
    );
    assert.match(validation, /RRP_REVIEW_APPROVE_REJECTED_MESSAGE/);
    assert.match(validation, /record\.decision === "approve"/);
    assert.match(validation, /, 422\)/);
    assert.match(RRP_REVIEW_APPROVE_REJECTED_MESSAGE, /confirm-appointment/);
  });
});
