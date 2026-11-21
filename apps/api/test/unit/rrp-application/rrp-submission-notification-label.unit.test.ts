/**
 * HU-RRP-07F.5 — human-readable RRP submission notification label.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  RRP_SUBMISSION_NOTIFICATION_FALLBACK_LABEL,
  buildRrpSubmissionNotificationLabel,
} from "../../../src/modules/admin-notifications/rrp-submission-notification-label.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("HU-RRP-07F.5 RRP submission notification label", () => {
  it("joins the public display name and the canonical country name", () => {
    assert.equal(
      buildRrpSubmissionNotificationLabel({
        displayName: "Mara Chen",
        countryCode: "CA",
      }),
      "Mara Chen — Canada",
    );
  });

  it("uses a generic label when the public name is missing or unsafe, and never a UUID", () => {
    const applicationId = "2eb77c63-62e8-4c2c-be6a-9de40e6533e3";
    assert.equal(
      buildRrpSubmissionNotificationLabel({ displayName: null, countryCode: "BE" }),
      `${RRP_SUBMISSION_NOTIFICATION_FALLBACK_LABEL} — Belgium`,
    );
    assert.equal(
      buildRrpSubmissionNotificationLabel({ displayName: "  ", countryCode: "CA" }),
      `${RRP_SUBMISSION_NOTIFICATION_FALLBACK_LABEL} — Canada`,
    );
    assert.equal(
      buildRrpSubmissionNotificationLabel({ displayName: "Ann <script>", countryCode: "CA" }),
      `${RRP_SUBMISSION_NOTIFICATION_FALLBACK_LABEL} — Canada`,
    );
    assert.equal(
      buildRrpSubmissionNotificationLabel({ displayName: null, countryCode: null }),
      RRP_SUBMISSION_NOTIFICATION_FALLBACK_LABEL,
    );
    const labeled = buildRrpSubmissionNotificationLabel({
      displayName: "Mara Chen",
      countryCode: "CA",
    });
    assert.doesNotMatch(labeled, new RegExp(applicationId));
    assert.notEqual(labeled, applicationId);
  });

  it("omits an unknown country code instead of showing it raw", () => {
    assert.equal(
      buildRrpSubmissionNotificationLabel({ displayName: "Mara Chen", countryCode: "ZZ" }),
      "Mara Chen",
    );
  });

  it("does not read private application fields", () => {
    const source = readFileSync(
      path.resolve(apiRoot, "src/modules/admin-notifications/rrp-submission-notification-label.ts"),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /legalFirstName|legalLastName|dateOfBirth|motivation|relevantExperience|annualRequestedAmount|fundingModel/,
    );
    assert.match(source, /resolveCountryDisplayName/);
    assert.match(source, /locale: "en"/);
  });
});
