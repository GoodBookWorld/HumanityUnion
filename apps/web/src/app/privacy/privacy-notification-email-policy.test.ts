/**
 * HU-NOTIF-02C.7 — Privacy Policy coverage for optional Notification Center email copies.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const privacyPage = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "page.tsx");

function readPrivacy(): string {
  return readFileSync(privacyPage, "utf8");
}

describe("HU-NOTIF-02C.7 Privacy Policy notification email section", () => {
  it("preserves existing Privacy Policy structure and contact", () => {
    const body = readPrivacy();
    assert.match(body, /Who we are/);
    assert.match(body, /Member Badge Contribution and fulfillment privacy/);
    assert.match(body, /Cookies and session storage/);
    assert.match(body, /Privacy questions or requests/);
    assert.match(body, /ORGANIZATION_ADDRESS/);
    assert.match(body, /CONTACT_EMAIL/);
  });

  it("documents optional Notification Center email copies with opt-in and limits", () => {
    const body = readPrivacy();
    assert.match(body, /Optional Notification Center email copies/);
    assert.match(body, /explicit opt-in/i);
    assert.match(body, /not enabled by default/i);
    assert.match(body, /verified account email/i);
    assert.match(body, /separately verified alternative notification email/i);
    assert.match(body, /does not replace your account login email/i);
    assert.match(body, /immediate, daily[\s\S]*weekly digest/i);
    assert.match(body, /disable email copies/i);
    assert.match(body, /Private notification bodies/i);
    assert.match(body, /delivery status/i);
    assert.match(body, /email delivery[\s\S]*providers/i);
  });

  it("distinguishes copies from security mail and avoids overclaims", () => {
    const body = readPrivacy();
    assert.match(body, /security and account transactional email/i);
    assert.match(body, /does not stop[\s\S]*password reset/i);
    assert.doesNotMatch(body, /encryption at rest/i);
    assert.doesNotMatch(body, /\bguaranteed delivery\b/i);
    assert.match(body, /not guaranteed\s+for every event/i);
    assert.match(body, /not claimed to be exactly-once/i);
  });
});

describe("HU-RRP-03F.1 Privacy Policy RRP disclosure", () => {
  it("includes a draft RRP disclosure marked for legal review", () => {
    const body = readPrivacy();
    assert.match(body, /Regional Representative Program applications/);
    assert.match(body, /data-rrp-privacy-disclosure="draft-requires-legal-review"/);
    assert.match(body, /Draft for legal review/);
    assert.match(body, /legal first and last name/i);
    assert.match(body, /date of birth/i);
    assert.match(body, /country of\s+residence/i);
    assert.match(body, /country you seek to represent/i);
    assert.match(body, /funding model/i);
    assert.match(body, /CAD/);
    assert.match(body, /decision history/i);
    assert.match(body, /Messages capability/i);
    assert.match(body, /Withdrawal ends the active application/i);
    assert.match(body, /not yet fixed by an explicit product or legal/i);
    assert.match(body, /other jurisdictions/i);
    assert.doesNotMatch(body, /\bguaranteed delivery\b/i);
  });
});
