/**
 * HU-RRP-06C.3D — Admin Notification Center WEB labels + localization for RRP.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { ADMIN_NOTIFICATION_TYPES } from "@hu/types";

import {
  isSafeAdminRrpNotificationHref,
  resolveAdminNotificationHref,
  resolveAdminNotificationTypeLabel,
} from "./admin-notification-labels.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const messagesDir = path.join(webSrc, "features/i18n/messages");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("HU-RRP-06C.3D RRP admin notification WEB", () => {
  it("renders a localized RRP type label with English fallback", () => {
    assert.equal(
      resolveAdminNotificationTypeLabel({
        type: "rrp_application_submitted",
        title: "Regional Representative application submitted",
      }),
      "Regional Representative application submitted",
    );
    assert.equal(
      resolveAdminNotificationTypeLabel(
        {
          type: "rrp_application_submitted",
          title: "Regional Representative application submitted",
        },
        () => "Подано заявку регіонального представника",
      ),
      "Подано заявку регіонального представника",
    );
  });

  it("preserves existing notification type labels", () => {
    assert.equal(
      resolveAdminNotificationTypeLabel({
        type: "participant_registered",
        title: "New Participant",
      }),
      "New Participant",
    );
    assert.equal(
      resolveAdminNotificationTypeLabel({
        type: "member_badge_order_paid",
        title: "Member badge order paid",
      }),
      "Member badge order paid",
    );
    for (const type of ADMIN_NOTIFICATION_TYPES) {
      const label = resolveAdminNotificationTypeLabel({ type, title: "fallback-title" });
      assert.ok(typeof label === "string" && label.length > 0);
      assert.notEqual(label, "fallback-title");
    }
  });

  it("passes through the RRP deep link with participant and application ids only", () => {
    const href = resolveAdminNotificationHref({
      type: "rrp_application_submitted",
      targetHref:
        "/admin/participants?participantId=participant-1&rrpApplicationId=app-1",
      sourceEventId: "rrp-application-submitted:app-1:2026-11-20T16:00:00.000Z",
    });
    assert.equal(
      href,
      "/admin/participants?participantId=participant-1&rrpApplicationId=app-1",
    );
    assert.equal(isSafeAdminRrpNotificationHref(href), true);
    assert.equal(
      isSafeAdminRrpNotificationHref(
        "/admin/participants?participantId=p1&rrpApplicationId=a1&motivation=secret",
      ),
      false,
    );
  });

  it("localizes RRP notification text in all installed catalogs with EN fallback tree", () => {
    const locales = readdirSync(messagesDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.replace(/\.json$/, ""))
      .sort();
    assert.deepEqual(locales, [
      "ar",
      "de",
      "en",
      "es",
      "fr",
      "he",
      "ka",
      "pt",
      "uk",
      "zh-Hant",
    ]);

    const en = JSON.parse(read("features/i18n/messages/en.json")) as {
      adminNotifications: { types: Record<string, string> };
    };
    assert.equal(
      en.adminNotifications.types.rrp_application_submitted,
      "Regional Representative application submitted",
    );

    for (const locale of locales) {
      const catalog = JSON.parse(read(`features/i18n/messages/${locale}.json`)) as {
        adminNotifications: { types: Record<string, string> };
      };
      for (const type of ADMIN_NOTIFICATION_TYPES) {
        assert.equal(
          typeof catalog.adminNotifications.types[type],
          "string",
          `${locale} missing ${type}`,
        );
        assert.ok(catalog.adminNotifications.types[type]!.trim().length > 0);
      }
      const rrpLabel = catalog.adminNotifications.types.rrp_application_submitted;
      assert.equal(typeof rrpLabel, "string");
      assert.ok(rrpLabel && rrpLabel.trim().length > 0);
    }

    // Future-language fallback: English catalog remains the shared source tree.
    assert.ok(Object.keys(en.adminNotifications.types).length >= ADMIN_NOTIFICATION_TYPES.length);
  });

  it("wires AdminWorkspaceHeader to shared i18n without a parallel inbox UI", () => {
    const header = read("features/administration/components/AdminWorkspaceHeader.tsx");
    assert.match(header, /useTranslations\("adminNotifications\.types"\)/);
    assert.match(header, /resolveAdminNotificationTypeLabel/);
    assert.match(header, /resolveAdminNotificationHref/);
    assert.match(header, /fetchAdminNotificationCount/);
    assert.match(header, /deleteAdminNotification/);
    assert.doesNotMatch(header, /needsAdminAttention|rrp-attention/);
    assert.doesNotMatch(header, /New Notification Center|parallel inbox/i);
  });

  it("keeps 06B directory deep-link handling for participantId + rrpApplicationId", () => {
    const section = read("features/administration/components/AdminParticipantsSection.tsx");
    const deepLink = read("features/administration/admin-participant-directory-deep-link.ts");
    assert.match(section, /useSearchParams\(/);
    assert.match(deepLink, /params\.get\("participantId"\)/);
    assert.match(deepLink, /params\.get\("rrpApplicationId"\)/);
    assert.match(section, /initialApplicationId=\{rrpDeepLinkApplicationId\}/);
  });

  it("documents RTL-capable catalogs for ar and he without locale branching in labels", () => {
    const labels = read("features/administration/admin-notification-labels.ts");
    assert.doesNotMatch(labels, /locale === ["']ar["']|locale === ["']he["']|isRtl/);
    const ar = JSON.parse(read("features/i18n/messages/ar.json")) as {
      adminNotifications: { types: { rrp_application_submitted: string } };
    };
    const he = JSON.parse(read("features/i18n/messages/he.json")) as {
      adminNotifications: { types: { rrp_application_submitted: string } };
    };
    assert.ok(ar.adminNotifications.types.rrp_application_submitted.length > 0);
    assert.ok(he.adminNotifications.types.rrp_application_submitted.length > 0);
  });
});
