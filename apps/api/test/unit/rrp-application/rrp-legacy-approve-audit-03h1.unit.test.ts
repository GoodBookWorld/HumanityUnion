/**
 * HU-RRP-03H.1 — audit of status-only review `decision: "approve"` (no behavior change).
 *
 * Documents callers and compatibility before any future restriction.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("HU-RRP-03H.1 legacy status-only review approve audit", () => {
  it("Admin WEB Approve uses confirm-appointment only (never review decision approve)", () => {
    const modal = read(
      "apps/web/src/features/administration/components/AdminRrpApplicationModal.tsx",
    );
    const api = read("apps/web/src/features/administration/admin-rrp-application-api.ts");
    assert.match(modal, /confirmAdminRrpAppointment/);
    assert.match(api, /confirm-appointment/);
    assert.match(api, /Exclude<AdminRrpApplicationReviewDecision, "approve">/);
    assert.doesNotMatch(api, /decision:\s*"approve"/);
    assert.match(
      modal,
      /Approve uses confirm-appointment[\s\S]*never status-only review/,
    );
  });

  it("API review route still accepts approve and can approve without appointment", () => {
    const validation = read(
      "apps/api/src/modules/rrp-application/rrp-application.validation.ts",
    );
    const service = read("apps/api/src/modules/rrp-application/rrp-application.service.ts");
    const routes = read(
      "apps/api/src/modules/rrp-application/rrp-application-admin.routes.ts",
    );
    assert.match(validation, /"approve"/);
    assert.match(routes, /reviewRrpApplicationForAdminActor/);
    assert.match(
      service,
      /Representative designation[\s\S]*requires confirm-appointment/,
    );
    // Status-only path does not create appointments (message intents ≠ appointments).
    const reviewFn =
      service.split("export async function reviewRrpApplicationForAdminActor")[1] ?? "";
    assert.doesNotMatch(reviewFn, /insertRrpAppointment\(/);
    assert.doesNotMatch(reviewFn, /confirmRrpAppointmentForAdminActor/);
    assert.match(reviewFn, /insertRrpAppointmentMessageIntentIdempotent/);
  });

  it("unit tests still depend on status-only approve for compatibility coverage", () => {
    const unit02b = read(
      "apps/api/test/unit/rrp-application/rrp-application-02b.unit.test.ts",
    );
    const unit03c = read(
      "apps/api/test/unit/rrp-application/rrp-appointment-03c.unit.test.ts",
    );
    assert.match(unit02b, /decision:\s*"approve"/);
    assert.match(unit03c, /keeps review approve status-only without creating an appointment/);
    assert.match(unit03c, /decision:\s*"approve"/);
  });
});
