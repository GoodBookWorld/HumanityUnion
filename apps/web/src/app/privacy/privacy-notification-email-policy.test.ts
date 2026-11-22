/**
 * HU-NOTIF-02C.7 / HU-PRIVACY-02B — Privacy Policy notification + publication coverage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { CANONICAL_LEGAL_SOURCE_VERSIONS, RRP_APPLICATION_CONSENT_VERSION } from "@hu/types";

const privacyPage = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "page.tsx");
const legalShell = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../features/legal/components/LegalPageShell.tsx",
);
const adminLegal = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../features/administration/components/AdminLegalLocalizationSection.tsx",
);
const rrpEntry = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../features/regional-program/rrp-application-entry.ts",
);
const rrpWrites = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../api/src/modules/rrp-application/rrp-application-writes.activation.ts",
);

function readPrivacy(): string {
  return readFileSync(privacyPage, "utf8");
}

describe("HU-PRIVACY-02B approved English Privacy Policy", () => {
  it("renders all 19 sections with exact effective date", () => {
    const body = readPrivacy();
    assert.match(body, /Effective Date: November 22, 2026/);
    for (let n = 1; n <= 19; n += 1) {
      assert.match(body, new RegExp(`privacy-section-${n}`));
    }
    for (const sub of ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7"]) {
      assert.match(body, new RegExp(`${sub}\\.`));
    }
  });

  it("includes pseudonymous RRP wording without mandatory 18+ gate", () => {
    const body = readPrivacy();
    assert.match(body, /Regional Representative Program \(RRP\)/);
    assert.match(body, /chosen name or pseudonym/);
    assert.match(body, /expression of interest/i);
    assert.match(body, /optional information concerning resources or funding needs/i);
    assert.doesNotMatch(body, /at least 18/i);
    assert.doesNotMatch(body, /must be 18/i);
    assert.doesNotMatch(body, /Applicants must be at least 18/);
  });

  it("uses info@huws.org only and documents notification opt-in limits", () => {
    const body = readPrivacy();
    assert.match(body, /CONTACT_EMAIL|info@huws\.org/);
    assert.doesNotMatch(body, /privacy@huws\.org/);
    assert.match(body, /Optional email copies of Notification Center activity/i);
    assert.match(body, /opt-in/i);
    assert.match(body, /Private message bodies/i);
    assert.match(body, /email delivery may involve authorized service providers/i);
  });

  it("keeps canonical Privacy and Terms versions and RRP consent invariants", () => {
    assert.equal(CANONICAL_LEGAL_SOURCE_VERSIONS.privacy, "privacy-2026-11-v2");
    assert.equal(CANONICAL_LEGAL_SOURCE_VERSIONS.terms, "terms-2026-03-v1");
    assert.equal(RRP_APPLICATION_CONSENT_VERSION, "rrp-application-consent-v2");
  });
});

describe("HU-PRIVACY-02B public notices and admin diagnostics", () => {
  it("does not render counsel or technical fallback notices publicly", () => {
    const shell = readFileSync(legalShell, "utf8");
    assert.doesNotMatch(shell, /chrome\.counselNote/);
    assert.doesNotMatch(shell, /chrome\.expectedFallbackNote/);
    assert.doesNotMatch(shell, /legal-page__counsel-note/);
    assert.doesNotMatch(shell, /legal-page__fallback-note/);
    assert.doesNotMatch(shell, /expected_legal_fallback/);
  });

  it("retains Admin Legal Localization stale diagnostics", () => {
    const admin = readFileSync(adminLegal, "utf8");
    assert.match(admin, /isStaleRelativeToCanonical/);
  });

  it("keeps both RRP activation flags default OFF", () => {
    const entry = readFileSync(rrpEntry, "utf8");
    const writes = readFileSync(rrpWrites, "utf8");
    assert.match(entry, /=== "true"/);
    assert.match(writes, /=== "true"/);
    assert.match(writes, /RRP_APPLICATIONS_WRITES_ENABLED/);
    assert.match(entry, /NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED/);
  });
});
