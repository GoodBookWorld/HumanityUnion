/**
 * HU-NOTIF-02C.12B — ordinary communication PATCH allowlist.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CommunicationPreferences } from "@hu/types";

import {
  buildOrdinaryCommunicationPreferencesPatch,
  buildOrdinaryCommunicationPreferencesUpdate,
  communicationPreferencesContainProtectedFields,
  ORDINARY_COMMUNICATION_PREFERENCE_KEYS,
  PROTECTED_NOTIFICATION_EMAIL_COMMUNICATION_KEYS,
} from "./communication-preferences-patch";

function sampleBaseline(): CommunicationPreferences {
  return {
    announcementPreference: "enabled",
    invitationPreference: "enabled",
    digestFrequency: "weekly",
    messageCategories: ["updates"],
    notificationFrequency: "daily_digest",
    emailNotificationsEnabled: true,
    notificationEmailCopiesOptIn: false,
    notificationEmailDestinationMode: "alternative",
    notificationAlternativeEmail: "alt@example.com",
    notificationAlternativeEmailVerifiedAt: "2026-01-01T00:00:00.000Z",
    notificationAlternativeEmailPending: "pending@example.com",
    interestMatchNotificationsEnabled: true,
    disabledNotificationCategories: [],
  };
}

describe("HU-NOTIF-02C.12B ordinary communication preferences PATCH allowlist", () => {
  it("excludes all protected notification-email destination fields", () => {
    const patch = buildOrdinaryCommunicationPreferencesPatch(sampleBaseline());

    for (const key of PROTECTED_NOTIFICATION_EMAIL_COMMUNICATION_KEYS) {
      assert.equal(Object.prototype.hasOwnProperty.call(patch, key), false);
    }
    assert.equal(communicationPreferencesContainProtectedFields(patch), false);
    assert.equal(communicationPreferencesContainProtectedFields(sampleBaseline()), true);
  });

  it("includes notificationFrequency (not digestFrequency) for persistence", () => {
    const patch = buildOrdinaryCommunicationPreferencesUpdate({
      baseline: sampleBaseline(),
      patch: { notificationFrequency: "weekly_digest" },
    });

    assert.equal(patch.notificationFrequency, "weekly_digest");
    assert.equal(patch.digestFrequency, "weekly");
    assert.ok(ORDINARY_COMMUNICATION_PREFERENCE_KEYS.includes("notificationFrequency"));
    assert.ok(ORDINARY_COMMUNICATION_PREFERENCE_KEYS.includes("digestFrequency"));
  });

  it("persists each notificationFrequency value through the allowlist", () => {
    for (const frequency of [
      "immediate",
      "daily_digest",
      "weekly_digest",
      "platform_only",
    ] as const) {
      const patch = buildOrdinaryCommunicationPreferencesUpdate({
        baseline: sampleBaseline(),
        patch: { notificationFrequency: frequency },
      });
      assert.equal(patch.notificationFrequency, frequency);
      assert.equal(
        Object.prototype.hasOwnProperty.call(patch, "notificationEmailDestinationMode"),
        false,
      );
    }
  });

  it("only copies allowlisted keys that are present", () => {
    const patch = buildOrdinaryCommunicationPreferencesPatch({
      notificationFrequency: "immediate",
      notificationEmailDestinationMode: "alternative",
      notificationAlternativeEmail: "x@example.com",
    });
    assert.deepEqual(Object.keys(patch).sort(), ["notificationFrequency"]);
    assert.equal(patch.notificationFrequency, "immediate");
  });
});
