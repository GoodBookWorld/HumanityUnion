/**
 * HU-NOTIF-02A — explicit notification email copies opt-in (default OFF).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildDefaultMemberPreferences } from "../../../src/modules/preferences/preferences.defaults.js";
import { validatePreferencesPatch } from "../../../src/modules/preferences/preferences.validators.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepo(relativeFromApi: string): string {
  return readFileSync(path.join(apiRoot, relativeFromApi), "utf8");
}

describe("HU-NOTIF-02A notificationEmailCopiesOptIn", () => {
  it("defaults OFF for new preference documents", () => {
    const preferences = buildDefaultMemberPreferences({ memberId: "member-1", userId: "user-1" });
    assert.equal(preferences.communicationPreferences.notificationEmailCopiesOptIn, false);
    assert.equal(preferences.communicationPreferences.emailNotificationsEnabled, true);
  });

  it("accepts explicit opt-in and opt-out patches", () => {
    const enabled = validatePreferencesPatch({
      communicationPreferences: { notificationEmailCopiesOptIn: true },
    });
    assert.equal(enabled.communicationPreferences?.notificationEmailCopiesOptIn, true);

    const disabled = validatePreferencesPatch({
      communicationPreferences: { notificationEmailCopiesOptIn: false },
    });
    assert.equal(disabled.communicationPreferences?.notificationEmailCopiesOptIn, false);
  });

  it("keeps historical emailNotificationsEnabled gate independent in MailDeliveryService", () => {
    const emailService = readRepo("src/modules/email/email.service.ts");
    assert.match(emailService, /emailNotificationsEnabled !== false/);
    assert.doesNotMatch(emailService, /notificationEmailCopiesOptIn/);
  });

  it("does not wire notification create paths to email fan-out", () => {
    const notificationService = readRepo("src/modules/notifications/notification.service.ts");
    assert.doesNotMatch(
      notificationService,
      /sendTransactionalEmail|sendWorkspaceNotificationSummaryEmail|notificationEmailCopiesOptIn/,
    );
  });

  it("keeps emailNotificationsEnabled independent from notificationEmailCopiesOptIn", () => {
    const preferences = buildDefaultMemberPreferences({ memberId: "member-2", userId: "user-2" });
    assert.equal(preferences.communicationPreferences.emailNotificationsEnabled, true);
    assert.equal(preferences.communicationPreferences.notificationEmailCopiesOptIn, false);

    const optedIn = validatePreferencesPatch({
      communicationPreferences: {
        notificationEmailCopiesOptIn: true,
        emailNotificationsEnabled: false,
      },
    });
    assert.equal(optedIn.communicationPreferences?.notificationEmailCopiesOptIn, true);
    assert.equal(optedIn.communicationPreferences?.emailNotificationsEnabled, false);
  });
});
