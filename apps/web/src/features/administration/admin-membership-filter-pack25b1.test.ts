/**
 * Pack 25B.1 / Pack 25D — Admin Membership filter / label alignment.
 * Pack 25D replaces primary selector options; domain statuses remain unchanged.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const apiSrc = path.resolve(webSrc, "../../api/src");

function readWeb(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

function readApi(relativePath: string): string {
  return readFileSync(path.resolve(apiSrc, relativePath), "utf8");
}

describe("Pack 25B.1 / 25D — Admin Membership filter / label alignment", () => {
  const section = readWeb("features/administration/components/AdminParticipantsSection.tsx");

  it("1–2 — Pack 25D primary filter includes Application submitted", () => {
    assert.match(
      section,
      /option value="application_submitted">Application submitted<\/option>/,
    );
  });

  it("3 — backend query accepts membershipStatus", () => {
    const routes = readApi("modules/administration/admin-participant-directory.routes.ts");
    assert.match(routes, /membershipStatus/);

    const repo = readApi("modules/membership/membership.repository.ts");
    assert.match(repo, /findUserIdsByMembershipStatus/);
  });

  it("4–5 — submitted filter is operational application_submitted", () => {
    assert.match(section, /value="application_submitted"/);
    assert.doesNotMatch(section, /option value="application_started"/);
    assert.doesNotMatch(section, /option value="application_completed"/);

    const service = readApi("modules/administration/admin-participant-directory.service.ts");
    assert.match(service, /findUserIdsByMembershipStatus|membershipStatus/);
  });

  it("6 — row label maps application_completed → Application submitted", () => {
    assert.match(section, /application_completed:\s*"Application submitted"/);
    assert.doesNotMatch(section, /application_completed:\s*"application completed"/);
  });

  it("7–9 — Pack 25D primary views: Active Members + Member Badge Orders", () => {
    assert.match(section, /option value="active_member">Active Members<\/option>/);
    assert.match(section, /option value="member_badge_orders">Member Badge Orders<\/option>/);
    assert.doesNotMatch(section, /option value="not_started">/);
    assert.doesNotMatch(section, /option value="pending_payment">/);
  });

  it("10 — domain statuses are not renamed", () => {
    const types = readFileSync(
      path.resolve(apiSrc, "../../../packages/types/src/domain/membership.ts"),
      "utf8",
    );
    assert.match(types, /"application_started"/);
    assert.match(types, /"application_completed"/);
  });

  it("11 — primary filter stays operationally simple (no error-state flood)", () => {
    assert.doesNotMatch(section, /option value="manual_review"/);
    assert.doesNotMatch(section, /option value="payment_refunded"/);
    assert.doesNotMatch(section, /option value="payment_disputed"/);
    assert.doesNotMatch(section, /option value="technical_error"/);
  });

  it("directory API still forwards membershipStatus query param", () => {
    const api = readWeb("features/administration/admin-participant-directory-api.ts");
    assert.match(api, /params\.set\("membershipStatus"/);
  });
});
