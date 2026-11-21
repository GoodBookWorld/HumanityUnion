/**
 * HU-RRP-07F.7 — administrator delivery warnings are localized codes, not diagnostics.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { deepMergeMessages } from "../i18n/load-ui-messages.js";
import { rrpDeliveryWarningMessageKey } from "./rrp-delivery-warning.js";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = path.resolve(webRoot, "../..");

const LOCALES = ["en", "uk", "zh-Hant", "ar", "de", "es", "fr", "he", "ka", "pt"] as const;

const KEYS = [
  "deliveryWarningTitle",
  "deliveryPendingRetry",
  "deliveryFailedTerminal",
  "deliveryPreviouslyFailed",
  "deliveryPaused",
  "deliveryIntentMissing",
  "deliveryAppointmentMissing",
] as const;

const CODES = {
  rrp_delivery_pending_retry: "messages.deliveryPendingRetry",
  rrp_delivery_failed_terminal: "messages.deliveryFailedTerminal",
  rrp_delivery_previously_failed: "messages.deliveryPreviouslyFailed",
  rrp_delivery_paused: "messages.deliveryPaused",
  rrp_delivery_intent_missing: "messages.deliveryIntentMissing",
  rrp_delivery_appointment_missing: "messages.deliveryAppointmentMissing",
} as const;

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function warningMessages(catalog: Record<string, unknown>): Record<string, string> {
  const rrp = catalog.rrpApplication as { admin?: { messages?: Record<string, string> } };
  return rrp.admin?.messages ?? {};
}

describe("HU-RRP-07F.7 admin delivery warning copy", () => {
  it("maps known delivery codes and leaves unknown text unchanged", () => {
    for (const [code, key] of Object.entries(CODES)) {
      assert.equal(rrpDeliveryWarningMessageKey(code), key);
    }
    assert.equal(
      rrpDeliveryWarningMessageKey(
        "Decision succeeded, but the Messages notification could not be delivered.",
      ),
      null,
    );
    assert.equal(rrpDeliveryWarningMessageKey("intent-9f3a"), null);
  });

  it("provides the warning keys in every installed language and packaged catalog", () => {
    const english = warningMessages(
      readJson(path.join(webRoot, "src/features/i18n/messages/en.json")),
    );
    for (const locale of LOCALES) {
      const web = warningMessages(
        readJson(path.join(webRoot, `src/features/i18n/messages/${locale}.json`)),
      );
      const packaged = warningMessages(
        readJson(path.join(repoRoot, `apps/api/assets/packaged-web-ui-catalogs/${locale}.json`)),
      );
      for (const key of KEYS) {
        assert.equal(typeof web[key], "string", `${locale} web ${key}`);
        assert.ok(web[key]!.trim().length > 0, `${locale} web ${key}`);
        assert.equal(packaged[key], web[key], `${locale} packaged ${key}`);
        assert.doesNotMatch(web[key]!, /intentId|rrp_delivery_|[0-9a-f]{8}-[0-9a-f]{4}-/i);
      }
      if (locale !== "en") {
        assert.notEqual(web.deliveryPendingRetry, english.deliveryPendingRetry);
      }
    }

    assert.match(warningMessages(readJson(path.join(webRoot, "src/features/i18n/messages/ar.json"))).deliveryPendingRetry!, /[\u0600-\u06FF]/);
    assert.match(warningMessages(readJson(path.join(webRoot, "src/features/i18n/messages/he.json"))).deliveryPendingRetry!, /[\u0590-\u05FF]/);
    assert.match(english.deliveryPendingRetry!, /automatically/i);
    assert.doesNotMatch(english.deliveryFailedTerminal!, /automatically/i);
    assert.doesNotMatch(english.deliveryPreviouslyFailed!, /automatically/i);
    assert.doesNotMatch(english.deliveryPaused!, /automatically|retried/i);
    assert.match(english.deliveryPaused!, /paused/i);
  });

  it("falls back to English when a locale catalog omits a warning key", () => {
    const english = readJson(path.join(webRoot, "src/features/i18n/messages/en.json"));
    const overlay = {
      rrpApplication: {
        admin: {
          messages: {
            deliveryWarningTitle: "Localized title",
          },
        },
      },
    };
    const merged = deepMergeMessages(english as never, overlay as never) as {
      rrpApplication: { admin: { messages: Record<string, string> } };
    };
    assert.equal(merged.rrpApplication.admin.messages.deliveryWarningTitle, "Localized title");
    assert.equal(
      merged.rrpApplication.admin.messages.deliveryPendingRetry,
      warningMessages(english).deliveryPendingRetry,
    );
  });

  it("renders the translated warning in the review dialog", () => {
    const modal = readFileSync(
      path.join(webRoot, "src/features/administration/components/AdminRrpApplicationModal.tsx"),
      "utf8",
    );
    assert.match(modal, /rrpDeliveryWarningMessageKey/);
    assert.match(modal, /deliveryWarningText/);
    assert.doesNotMatch(modal, /Intent remains pending/);
    assert.doesNotMatch(modal, /dir="ltr"/);
  });
});
