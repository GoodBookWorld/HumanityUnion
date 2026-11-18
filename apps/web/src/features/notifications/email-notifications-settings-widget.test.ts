/**
 * HU-NOTIF-02A / 02A.1 / 02B — Notification Center email settings + alternative email.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(webSrc, "../../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

function readRepo(relativeFromRepo: string): string {
  return readFileSync(path.join(repoRoot, relativeFromRepo), "utf8");
}

describe("HU-NOTIF-02A/02B Email Notifications settings widget", () => {
  it("renders only for authenticated participants after the page header", () => {
    const page = read("features/notifications/components/NotificationCenterPageContent.tsx");
    const headerClose = page.indexOf("</header>");
    const widget = page.indexOf("<EmailNotificationsSettingsWidget");
    const summary = page.indexOf("<CommunicationSummary");
    assert.ok(headerClose >= 0);
    assert.ok(widget > headerClose);
    assert.ok(summary > widget);
    assert.match(page, /\{authenticated \? <EmailNotificationsSettingsWidget \/> : null\}/);
  });

  it("loads AuthUser email via getMe and never invents email from display name", () => {
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    assert.match(widget, /getMe\(\)/);
    assert.match(widget, /user\.email/);
    assert.match(widget, /emailVerificationStatus === "verified"/);
    assert.doesNotMatch(widget, /displayName.*email|email.*displayName/);
    assert.match(widget, /accountEmailUnverified/);
    assert.match(widget, /\/confirm-email/);
    assert.match(widget, /destinationAccount|currentDestination/);
  });

  it("reuses preferences APIs and the explicit opt-in field defaulting OFF", () => {
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    const defaults = readRepo("apps/api/src/modules/preferences/preferences.defaults.ts");
    assert.match(widget, /getMyPreferences/);
    assert.match(widget, /updateMyPreferences/);
    assert.match(widget, /notificationEmailCopiesOptIn/);
    assert.match(defaults, /notificationEmailCopiesOptIn:\s*false/);
    assert.match(defaults, /notificationEmailDestinationMode:\s*"account"/);
  });

  it("supports alternative email verification UI without storing codes", () => {
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    const api = read("features/preferences/notification-email-api.ts");
    assert.match(widget, /requestAlternativeNotificationEmail/);
    assert.match(widget, /confirmAlternativeNotificationEmail/);
    assert.match(widget, /useAccountNotificationEmail/);
    assert.match(widget, /removeAlternativeNotificationEmail/);
    assert.match(widget, /verificationCode/);
    assert.match(widget, /one-time-code/);
    assert.doesNotMatch(widget, /localStorage|sessionStorage/);
    assert.match(api, /request-alternative/);
    assert.match(api, /confirm-alternative/);
    assert.doesNotMatch(api, /email_change/);
  });

  it("keeps PreferencesWorkspace synchronized through MemberPreferences", () => {
    const prefs = read("features/preferences/components/PreferencesWorkspace.tsx");
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    assert.match(prefs, /MEMBER_PREFERENCES_CHANGED_EVENT/);
    assert.match(widget, /MEMBER_PREFERENCES_CHANGED_EVENT/);
    assert.match(widget, /getNotificationEmailDestination/);
  });

  it("does not claim universal delivery and uses MailDeliveryService only on API", () => {
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    const en = JSON.parse(read("features/i18n/messages/en.json"));
    assert.match(en.notifications.emailSettings.preparationNotice, /optional/i);
    assert.match(en.notifications.emailSettings.preparationNotice, /explicit opt-in/i);
    assert.doesNotMatch(
      en.notifications.emailSettings.preparationNotice,
      /not sending those copies yet/i,
    );
    assert.match(en.preferences.notification.copiesHelp, /Saving preferences does not mean/i);
    assert.doesNotMatch(widget, /sendTransactionalEmail|MailDeliveryService/);
    const service = readRepo(
      "apps/api/src/modules/preferences/notification-alternative-email.service.ts",
    );
    assert.match(service, /sendNotificationAlternativeEmailCodeEmail/);
    assert.doesNotMatch(service, /email_change|requestEmailChange/);
    assert.doesNotMatch(service, /notificationEmailCopiesOptIn:\s*true/);
  });

  it("uses WEB_UI keys with RTL-safe CSS and verification catalogs", () => {
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    const css = read(
      "features/notifications/components/email-notifications-settings-widget.css",
    );
    const en = JSON.parse(read("features/i18n/messages/en.json"));
    assert.match(widget, /useTranslations\("notifications\.emailSettings"\)/);
    assert.equal(typeof en.notifications.emailSettings.alternativeEmailHelp, "string");
    assert.equal(typeof en.notifications.emailSettings.requestVerification, "string");
    for (const locale of ["ar", "uk", "zh-Hant"] as const) {
      const catalog = JSON.parse(read(`features/i18n/messages/${locale}.json`));
      assert.equal(typeof catalog.notifications.emailSettings?.requestVerification, "string");
      assert.equal(typeof catalog.notifications.emailSettings?.confirmCode, "string");
    }
    assert.match(css, /\[dir="rtl"\]/);
    assert.match(css, /overflow-x:\s*hidden/);
  });

  it("does not alter auth email flows or store private notification payloads", () => {
    const widget = read(
      "features/notifications/components/EmailNotificationsSettingsWidget.tsx",
    );
    assert.doesNotMatch(widget, /requestEmailChange|confirmEmailChange/);
    assert.doesNotMatch(widget, /legalFirstName|dateOfBirth|relevantExperience|motivation/);
  });
});
