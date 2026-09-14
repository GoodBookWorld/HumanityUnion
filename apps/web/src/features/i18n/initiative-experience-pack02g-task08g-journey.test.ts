/**
 * Pack 02G Task 08G — Collective Participation Journey semantic presentation.
 * API emits codes+params; Web localizes via catalog; English strings are skew fallback.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  resolveCollectiveParticipationActionLabelDisplay,
  resolveCollectiveParticipationReasonDisplay,
  resolveCollectiveParticipationStatusDisplay,
  resolveInitiativeExperienceMessage,
} from "../public-initiative-experience/initiative-experience-i18n.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function ieKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, key);
  assert.ok(value, `missing initiativeExperience.${key}`);
  return value;
}

function translatorFor(messages: Record<string, unknown>) {
  return (key: string, values?: Record<string, string | number | Date>) => {
    let text = ieKey(messages, key);
    if (values) {
      for (const [name, value] of Object.entries(values)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
}

const STATUS_CODES = [
  "signed_petition",
  "commented",
  "commented_count",
  "supported",
  "opposed",
  "voted",
  "voted_updated",
] as const;

const LABEL_CODES = [
  "join_discussion",
  "continue_discussion",
  "sign_petition",
  "petition_signed",
  "cast_vote",
  "review_or_update_vote",
  "view_decision_result",
  "support_initiative",
] as const;

const REASON_CODES = [
  "sign_in_to_comment",
  "sign_in_to_sign",
  "sign_in_to_vote",
  "sign_in_to_support",
  "sign_in_to_take_action",
  "support_unavailable",
  "petition_info_unavailable",
  "petition_not_open",
  "voting_closed",
  "decision_not_open",
  "voting_info_unavailable",
  "petition_open_unsigned",
  "vote_open_may_update",
  "vote_open",
  "join_discussion",
  "show_support",
  "commitment_needs_response",
  "still_contribute_discussion",
] as const;

const JOURNEY_KEYS = [
  ...STATUS_CODES.map((code) => `journey.status.${code}`),
  ...LABEL_CODES.map((code) => `journey.labels.${code}`),
  ...REASON_CODES.map((code) => `journey.reasons.${code}`),
] as const;

describe("Pack 02G Task 08G — Journey semantic presentation", () => {
  it("catalog parity includes journey.status / labels / reasons", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of JOURNEY_KEYS) {
        assert.equal(typeof ieKey(loaded.messages, key), "string");
      }
    }

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }

    assert.equal(JOURNEY_KEYS.length, STATUS_CODES.length + LABEL_CODES.length + REASON_CODES.length);
    assert.equal(STATUS_CODES.length, 7);
    assert.equal(LABEL_CODES.length, 8);
    assert.equal(REASON_CODES.length, 18);
  });

  it("English journey strings match current API English", async () => {
    const en = await loadUiMessagesForLocale("en");
    assert.equal(ieKey(en.messages, "journey.status.signed_petition"), "Signed petition");
    assert.equal(ieKey(en.messages, "journey.status.commented"), "Commented");
    assert.equal(ieKey(en.messages, "journey.status.commented_count"), "Commented ({count})");
    assert.equal(ieKey(en.messages, "journey.status.voted"), "Voted ({choice})");
    assert.equal(ieKey(en.messages, "journey.status.voted_updated"), "Voted ({choice}; updated)");
    assert.equal(ieKey(en.messages, "journey.labels.join_discussion"), "Join the Discussion");
    assert.equal(ieKey(en.messages, "journey.labels.sign_petition"), "Sign the Petition");
    assert.equal(ieKey(en.messages, "journey.labels.cast_vote"), "Cast your vote");
    assert.equal(
      ieKey(en.messages, "journey.reasons.petition_open_unsigned"),
      "Petition is open and you have not signed yet.",
    );
    assert.equal(
      ieKey(en.messages, "journey.reasons.sign_in_to_take_action"),
      "Sign in to take this action.",
    );
  });

  it("resolver prefers code over English legacy string", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const t = translatorFor(uk.messages);

    assert.equal(
      resolveCollectiveParticipationStatusDisplay(
        "signed_petition",
        undefined,
        t,
        "Signed petition",
      ),
      "Підписано петицію",
    );
    assert.equal(
      resolveCollectiveParticipationStatusDisplay("commented_count", { count: 3 }, t, "Commented (3)"),
      "Прокоментовано (3)",
    );
    assert.equal(
      resolveCollectiveParticipationStatusDisplay("voted", { choice: "support" }, t, "Voted (support)"),
      "Проголосовано (support)",
    );
    assert.equal(
      resolveCollectiveParticipationActionLabelDisplay("join_discussion", t, "Join the Discussion"),
      "Приєднатися до обговорення",
    );
    assert.equal(
      resolveCollectiveParticipationReasonDisplay(
        "petition_open_unsigned",
        undefined,
        t,
        "Petition is open and you have not signed yet.",
      ),
      "Петиція відкрита, і ви ще не підписали.",
    );
  });

  it("unknown code falls back safely to legacy or raw", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = translatorFor(en.messages);

    assert.equal(
      resolveCollectiveParticipationStatusDisplay("totally_unknown", undefined, t, "Legacy Status"),
      "Legacy Status",
    );
    assert.equal(
      resolveCollectiveParticipationStatusDisplay("totally_unknown", undefined, t),
      "totally_unknown",
    );
    assert.equal(
      resolveCollectiveParticipationActionLabelDisplay("weird_label", t, "Legacy Label"),
      "Legacy Label",
    );
    assert.equal(
      resolveCollectiveParticipationActionLabelDisplay("weird_label", t),
      "weird_label",
    );
    assert.equal(
      resolveCollectiveParticipationReasonDisplay("weird_reason", undefined, t, "Legacy Reason"),
      "Legacy Reason",
    );
    assert.equal(
      resolveCollectiveParticipationReasonDisplay(undefined, undefined, t, "Legacy Reason"),
      "Legacy Reason",
    );
  });

  it("YourParticipationPanel uses resolvers not raw statusLabel as sole display", () => {
    const participation = readWeb(
      "features/public-initiative-experience/components/YourParticipationPanel.tsx",
    );
    assert.match(participation, /resolveCollectiveParticipationStatusDisplay/);
    assert.match(participation, /resolveCollectiveParticipationActionLabelDisplay/);
    assert.match(participation, /resolveCollectiveParticipationReasonDisplay/);
    assert.match(participation, /action\.statusCode/);
    assert.match(participation, /journey\.nextAction\.labelCode/);
    assert.match(participation, /journey\.nextAction\.reasonCode/);
    // Legacy English kept only as skew fallback args — not sole display.
    assert.match(participation, /action\.statusLabel/);
    assert.match(participation, /journey\.nextAction\.label/);
    assert.match(participation, /journey\.nextAction\.reason/);
    assert.doesNotMatch(participation, />\{action\.statusLabel\}</);
    assert.doesNotMatch(participation, />\{journey\.nextAction\.label\}</);
    assert.doesNotMatch(participation, />\{journey\.nextAction\.reason\}</);
  });
});
