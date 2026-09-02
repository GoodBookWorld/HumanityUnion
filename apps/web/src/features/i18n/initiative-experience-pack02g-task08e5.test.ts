/**
 * Pack 02G Task 08E.5 — PUBLIC_CHOICE election board / page localization.
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
  resolveInitiativeExperienceMessage,
  resolvePublicChoiceElectionVotingStatusDisplayLabel,
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

describe("Pack 02G Task 08E.5 — PUBLIC_CHOICE election board and page", () => {
  it("catalog parity includes publicChoice election/results/statuses", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof ieKey(loaded.messages, "publicChoice.results.download"), "string");
      assert.equal(typeof ieKey(loaded.messages, "publicChoice.results.preparing"), "string");
      assert.equal(typeof ieKey(loaded.messages, "publicChoice.statuses.OPEN"), "string");
      assert.equal(typeof ieKey(loaded.messages, "publicChoice.election.loading"), "string");
      assert.equal(typeof ieKey(loaded.messages, "publicChoice.stage.title"), "string");
    }
  });

  it("Ukrainian election chrome resolves for board / page / stage keys", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(
      ieKey(uk.messages, "publicChoice.results.download"),
      "Завантажити результати",
    );
    assert.equal(ieKey(uk.messages, "publicChoice.results.preparing"), "Підготовка…");
    assert.match(ieKey(uk.messages, "publicChoice.results.participationTitle"), /участі/i);
    assert.match(ieKey(uk.messages, "publicChoice.results.rankAria"), /Місце/);
    assert.doesNotMatch(ieKey(uk.messages, "publicChoice.results.download"), /Download results/);
    assert.equal(ieKey(uk.messages, "publicChoice.statuses.OPEN"), "Відкрито");
    assert.equal(ieKey(uk.messages, "publicChoice.statuses.CLOSED"), "Закрито");
  });

  it("voting status display resolver maps canonical codes; unknown stays raw", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const t = translatorFor(uk.messages);
    assert.equal(resolvePublicChoiceElectionVotingStatusDisplayLabel("NOT_STARTED", t), "Не розпочато");
    assert.equal(resolvePublicChoiceElectionVotingStatusDisplayLabel("OPEN", t), "Відкрито");
    assert.equal(resolvePublicChoiceElectionVotingStatusDisplayLabel("CLOSED", t), "Закрито");
    assert.equal(resolvePublicChoiceElectionVotingStatusDisplayLabel("EXPIRED", t), "Термін минув");
    assert.equal(
      resolvePublicChoiceElectionVotingStatusDisplayLabel("WEIRD_STATUS", t),
      "WEIRD_STATUS",
    );
  });

  it("mounted Initiative surfaces do not use English publicChoiceElectionVotingStatusLabel", () => {
    const files = [
      "features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
      "features/public-choice-candidate/components/PublicChoiceCollectiveDecisionStage.tsx",
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionPublicResult.tsx",
    ];
    for (const relative of files) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /publicChoiceElectionVotingStatusLabel/);
      assert.doesNotMatch(source, /PUBLIC_CHOICE_COMMUNITY_RESULTS_DISCLAIMER/);
    }
    assert.match(
      readWeb("features/public-initiative-experience/components/PublicChoiceElectionPage.tsx"),
      /resolvePublicChoiceElectionVotingStatusDisplayLabel/,
    );
    assert.match(
      readWeb(
        "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionPublicResult.tsx",
      ),
      /resolvePublicChoiceElectionVotingStatusDisplayLabel/,
    );
  });

  it("canonical candidate/result data remains data-bound; no civic content from next-intl", () => {
    const board = readWeb(
      "features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
    );
    assert.match(board, /candidate\?\.name/);
    assert.match(board, /candidate\.name/);
    assert.match(board, /candidate\.campaignPageUrl/);
    assert.match(board, /tally\.count/);
    assert.match(board, /tally\.percentage/);
    assert.match(board, /tally\.rank/);
    assert.doesNotMatch(board, /t\(".*candidate\.name/);
    assert.doesNotMatch(board, /Applied AI suggestions/);
    assert.match(board, /collaboration\.vote\.campaignPage/);
  });

  it("download button localized; PDF endpoint call unchanged", () => {
    const board = readWeb(
      "features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
    );
    const page = readWeb(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    assert.match(board, /publicChoice\.results\.download/);
    assert.match(board, /publicChoice\.results\.preparing/);
    assert.match(page, /downloadPublicChoiceResultsPdf\(initiativeId, decision\.decisionId\)/);
    assert.doesNotMatch(page, /"Download results"/);
  });

  it("PublicChoiceSelectOneVotingBoard remains unmounted quarantine", () => {
    const board = readWeb(
      "features/public-choice-candidate/components/PublicChoiceSelectOneVotingBoard.tsx",
    );
    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    const page = readWeb(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    assert.doesNotMatch(center, /PublicChoiceSelectOneVotingBoard/);
    assert.doesNotMatch(page, /PublicChoiceSelectOneVotingBoard/);
    assert.match(board, /Do not mount from new surfaces/);
  });

  it("layout resilience markers for election rows", () => {
    const css = readWeb(
      "features/public-initiative-experience/public-initiative-experience.css",
    );
    assert.match(css, /\.pie-election-results__row\s*\{[^}]*minmax\(0,\s*1fr\)/s);
    assert.match(css, /\.pie-election-results__identity\s*\{[^}]*min-width:\s*0/s);
    assert.match(css, /\.pie-election-results__identity > div\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(css, /\.pie-election-results__heading-row\s*\{[^}]*min-width:\s*0/s);
  });

  it("missing publicChoice.results.download fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        publicChoice?: { results?: { download?: string } };
      }
    ).publicChoice?.results?.download;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.publicChoice.results.download"),
      ),
    );
  });
});
