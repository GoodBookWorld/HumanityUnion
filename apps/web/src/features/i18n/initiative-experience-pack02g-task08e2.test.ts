/**
 * Pack 02G Task 08E.2 — Public Petition SignatureWidget i18n.
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
import { resolveInitiativeExperienceMessage } from "../public-initiative-experience/initiative-experience-i18n.js";

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

describe("Pack 02G Task 08E.2 — Petition SignatureWidget i18n", () => {
  it("catalog parity en/uk/zh-Hant/ar includes petitionSignature", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof ieKey(loaded.messages, "petitionSignature.sign"), "string");
      assert.equal(typeof ieKey(loaded.messages, "petitionSignature.withdraw"), "string");
      assert.equal(typeof ieKey(loaded.messages, "petitionSignature.disclaimer"), "string");
      assert.equal(typeof ieKey(loaded.messages, "petitionSignature.aria"), "string");
    }
  });

  it("Ukrainian Sign / Withdraw / busy / disclaimer resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(ieKey(uk.messages, "petitionSignature.sign"), "Підписати цю петицію");
    assert.equal(ieKey(uk.messages, "petitionSignature.withdraw"), "Відкликати підпис");
    assert.equal(ieKey(uk.messages, "petitionSignature.recording"), "Запис…");
    assert.equal(ieKey(uk.messages, "petitionSignature.withdrawing"), "Відкликання…");
    assert.equal(ieKey(uk.messages, "petitionSignature.signedStatus"), "Ви підписали цю петицію.");
    assert.match(ieKey(uk.messages, "petitionSignature.disclaimer"), /громадянську участь/);
    assert.notEqual(ieKey(uk.messages, "petitionSignature.sign"), "Sign this Petition");
    assert.notEqual(ieKey(uk.messages, "petitionSignature.withdraw"), "Withdraw Signature");
  });

  it("SignatureWidget wires petitionSignature keys; gateway prose stays raw", () => {
    const widget = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionSignatureWidget.tsx",
    );
    assert.match(widget, /useTranslations\("initiativeExperience"\)/);
    assert.match(widget, /petitionSignature\.sign/);
    assert.match(widget, /petitionSignature\.withdraw/);
    assert.match(widget, /petitionSignature\.recording/);
    assert.match(widget, /petitionSignature\.withdrawing/);
    assert.match(widget, /petitionSignature\.signedStatus/);
    assert.match(widget, /petitionSignature\.disclaimer/);
    assert.match(widget, /petitionSignature\.aria/);
    assert.match(widget, /petitionSignature\.recordFailed/);
    assert.match(widget, /petitionSignature\.withdrawFailed/);
    assert.match(widget, /detailFromError/);
    assert.match(
      widget,
      /\{participationEntryGuidance\.registrationGatewayMessage\}/,
    );
    assert.doesNotMatch(widget, /registrationGatewayMessage\)/);
    assert.doesNotMatch(widget, />Sign this Petition</);
    assert.doesNotMatch(widget, />Withdraw Signature</);
    assert.doesNotMatch(widget, /You have signed this Petition/);
    assert.doesNotMatch(widget, /Signing records your civic participation/);
  });

  it("signature behavior, auth gates, and API calls remain unchanged", () => {
    const widget = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionSignatureWidget.tsx",
    );
    const petitionApi = readWeb("features/petition/api.ts");
    assert.match(widget, /signPetitionAsCurrentParticipant\(petitionId\)/);
    assert.match(widget, /withdrawPetitionSignature\(petitionId\)/);
    assert.match(widget, /onSignatureChange\(true\)/);
    assert.match(widget, /onSignatureChange\(false\)/);
    assert.match(widget, /authStatus !== "authenticated"/);
    assert.match(widget, /!signingAvailable/);
    assert.match(widget, /viewerHasSigned/);
    assert.match(widget, /busy/);
    assert.match(petitionApi, /signPetitionAsCurrentParticipant/);
    assert.match(petitionApi, /withdrawPetitionSignature/);
    assert.doesNotMatch(widget, /replaceAll\("_", " "\)/);
    assert.doesNotMatch(widget, /\.includes\("Sign/);
    assert.doesNotMatch(widget, /gemini/i);
  });

  it("arbitrary Error.message is preserved without English sentence matching", () => {
    const widget = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionSignatureWidget.tsx",
    );
    assert.match(
      widget,
      /detailFromError\(submissionError, t\("petitionSignature\.recordFailed"\)\)/,
    );
    assert.match(
      widget,
      /detailFromError\(submissionError, t\("petitionSignature\.withdrawFailed"\)\)/,
    );
    assert.doesNotMatch(widget, /submissionError\.message === "/);
    assert.doesNotMatch(widget, /message\.includes\(/);
  });

  it("signature counters remain data-bound on PublicResult; counts not from catalogs", () => {
    const publicResult = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionPublicResult.tsx",
    );
    assert.match(publicResult, /supportBreakdown\.participantSignatures/);
    assert.match(publicResult, /supportBreakdown\.memberSignatures/);
    assert.match(publicResult, /supportBreakdown\.visitorSignals/);
    assert.match(publicResult, /InitiativePetitionSignatureWidget/);
  });

  it("layout resilience for signature CSS", () => {
    const css = readWeb(
      "features/initiative-petition-lifecycle/components/initiative-petition-stage-workspace.css",
    );
    assert.match(css, /\.ipl-signature\s*\{[^}]*min-width:\s*0/s);
    assert.match(css, /\.ipl-signature\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(css, /\.ipl-signature__actions\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(css, /\.ipl-signature \.workspace-button[^}]*white-space:\s*normal/s);
    assert.match(css, /\.ipl-signature__prompt\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  });

  it("missing petitionSignature key fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as { petitionSignature?: { sign?: string } }
    ).petitionSignature?.sign;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.petitionSignature.sign"),
      ),
    );
  });

  it("reaction widgets and PUBLIC_CHOICE remain outside this slice", () => {
    const analysis = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeAnalysisReactionWidget.tsx",
    );
    const election = readWeb(
      "features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
    );
    assert.doesNotMatch(analysis, /petitionSignature/);
    assert.doesNotMatch(election, /petitionSignature/);
  });
});
