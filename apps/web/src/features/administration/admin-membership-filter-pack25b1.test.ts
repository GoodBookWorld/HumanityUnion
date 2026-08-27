/**
 * Pack 25B.1 — Admin Membership filter / label alignment.
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

describe("Pack 25B.1 — Admin Membership filter / label alignment", () => {
  const section = readWeb("features/administration/components/AdminParticipantsSection.tsx");

  it("1–2 — filter includes Application submitted mapped to application_completed", () => {
    assert.match(
      section,
      /option value="application_completed">Application submitted<\/option>/,
    );
    assert.match(section, /option value="application_started">Application started<\/option>/);
  });

  it("3 — backend query accepts application_completed", () => {
    const routes = readApi("modules/administration/admin-participant-directory.routes.ts");
    assert.match(routes, /"application_completed"/);
    assert.match(routes, /membershipStatus/);

    const repo = readApi("modules/membership/membership.repository.ts");
    assert.match(repo, /findUserIdsByMembershipStatus/);
    assert.match(repo, /find\(\{\s*status\s*\}/);
  });

  it("4–5 — submitted filter is exact-status; separated from application_started", () => {
    assert.match(section, /value="application_completed"/);
    assert.match(section, /value="application_started"/);
    assert.notEqual(
      section.indexOf('value="application_completed"'),
      section.indexOf('value="application_started"'),
    );

    const service = readApi("modules/administration/admin-participant-directory.service.ts");
    assert.match(service, /findUserIdsByMembershipStatus\(input\.membershipStatus\)/);
  });

  it("6 — row label maps application_completed → Application submitted", () => {
    assert.match(section, /application_completed:\s*"Application submitted"/);
    assert.doesNotMatch(section, /application_completed:\s*"application completed"/);
  });

  it("7–9 — active member / not started / pending payment filters unchanged", () => {
    assert.match(section, /option value="active_member">Active Member<\/option>/);
    assert.match(section, /option value="not_started">Not started<\/option>/);
    assert.match(section, /option value="pending_payment">Pending payment<\/option>/);
    assert.match(section, /not_started:\s*"Not started"/);
    assert.match(section, /application_started:\s*"Application started"/);
    assert.match(section, /pending_payment:\s*"Pending payment"/);
  });

  it("10 — domain statuses are not renamed", () => {
    const types = readFileSync(
      path.resolve(apiSrc, "../../../packages/types/src/domain/membership.ts"),
      "utf8",
    );
    assert.match(types, /"application_started"/);
    assert.match(types, /"application_completed"/);
    assert.doesNotMatch(section, /application_submitted/);
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
