import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { deepMergeMessages } from "../i18n/load-ui-messages";
import {
  resolveNotificationPresentation,
  type NotificationsTranslator,
} from "./resolve-notification-presentation";

const ROOT = path.resolve(import.meta.dirname, "../../../../..");
const NOTICE = {
  eventType: "privacy_policy_updated",
  title: "Privacy Policy Updated",
  message:
    "Humanity Union has updated its Privacy Policy, effective November 22, 2026. The update explains account deletion and recovery, the 30-day recovery period, and retention of civic records and private messages. Account deletion is not yet available.",
};

function translator(messages: Record<string, string>): NotificationsTranslator {
  return Object.assign((key: string) => messages[key] ?? key, {
    has(key: string) {
      return Object.prototype.hasOwnProperty.call(messages, key);
    },
  });
}

describe("privacy policy notice presentation", () => {
  it("uses the English notice, the privacy link label, and catalog fallback", () => {
    const english = JSON.parse(
      fs.readFileSync(path.join(ROOT, "apps/web/src/features/i18n/messages/en.json"), "utf8"),
    ) as {
      notifications: {
        actions: { readPrivacyPolicy: string; viewRelatedCivicRecord: string };
        types: { privacy_policy_updated: { title: string; message: string } };
      };
    };
    assert.equal(english.notifications.types.privacy_policy_updated.title, NOTICE.title);
    assert.equal(english.notifications.types.privacy_policy_updated.message, NOTICE.message);
    assert.equal(english.notifications.actions.readPrivacyPolicy, "Read Privacy Policy");

    const localized = resolveNotificationPresentation(
      NOTICE,
      translator({
        "types.privacy_policy_updated.title": "Politique de confidentialité mise à jour",
        "types.privacy_policy_updated.message": "Message localisé",
      }),
    );
    assert.equal(localized.title, "Politique de confidentialité mise à jour");
    assert.equal(localized.message, "Message localisé");

    const fallback = resolveNotificationPresentation(NOTICE, translator({}));
    assert.deepEqual(fallback, { title: NOTICE.title, message: NOTICE.message });

    const merged = deepMergeMessages(
      { notifications: { types: { privacy_policy_updated: { title: NOTICE.title } } } },
      { notifications: { types: {} } },
    ) as { notifications: { types: { privacy_policy_updated: { title: string } } } };
    assert.equal(merged.notifications.types.privacy_policy_updated.title, NOTICE.title);
  });

  it("does not label the notice as a civic record or hardcode language direction", () => {
    const page = fs.readFileSync(
      path.join(
        ROOT,
        "apps/web/src/features/notifications/components/NotificationCenterPageContent.tsx",
      ),
      "utf8",
    );
    const layout = fs.readFileSync(path.join(ROOT, "apps/web/src/app/layout.tsx"), "utf8");
    assert.match(page, /eventType === "privacy_policy_updated"/);
    assert.match(page, /actions\.readPrivacyPolicy/);
    assert.doesNotMatch(page, /privacy_policy_updated[\s\S]{0,80}viewRelatedCivicRecord/);
    assert.doesNotMatch(page, /locale === "ar"|locale === "he"|dir="/);
    assert.match(layout, /dir=\{documentLocale\.textDirection\}/);

    for (const locale of ["ar", "he", "uk", "zh-Hant"]) {
      const catalog = fs.readFileSync(
        path.join(ROOT, `apps/web/src/features/i18n/messages/${locale}.json`),
        "utf8",
      );
      assert.equal(catalog.includes("privacy_policy_updated"), false);
    }
  });
});
