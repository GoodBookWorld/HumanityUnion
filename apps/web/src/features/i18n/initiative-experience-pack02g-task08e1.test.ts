/**
 * Pack 02G Task 08E.1 — Public Initiative reaction widget i18n.
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

describe("Pack 02G Task 08E.1 — public reaction widget i18n", () => {
  it("catalog parity en/uk/zh-Hant/ar includes collaboration.reaction", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof ieKey(loaded.messages, "collaboration.reaction.signInToReact"), "string");
      assert.equal(typeof ieKey(loaded.messages, "collaboration.reaction.noteLegal"), "string");
      assert.equal(typeof ieKey(loaded.messages, "collaboration.reaction.targets.analysis"), "string");
      assert.equal(typeof ieKey(loaded.messages, "collaboration.reaction.targets.proposal"), "string");
      assert.equal(typeof ieKey(loaded.messages, "collaboration.reaction.targets.revision"), "string");
    }
  });

  it("Ukrainian Analysis/Proposal/Revision reaction chrome resolves natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(ieKey(uk.messages, "collaboration.reaction.targets.analysis"), "Спільний аналіз");
    assert.equal(ieKey(uk.messages, "collaboration.reaction.targets.proposal"), "Пропозиція");
    assert.equal(ieKey(uk.messages, "collaboration.reaction.targets.revision"), "Ревізія");
    assert.equal(ieKey(uk.messages, "collaboration.reaction.signInToReact"), "Увійдіть, щоб відреагувати");
    assert.equal(
      ieKey(uk.messages, "collaboration.reaction.noteLegal"),
      "Лише репрезентативна статистика — це не юридичне голосування.",
    );
    assert.match(ieKey(uk.messages, "collaboration.reaction.supportTarget"), /Підтримати/);
    assert.match(ieKey(uk.messages, "collaboration.reaction.opposeTarget"), /Не підтримувати/);
    assert.notEqual(
      ieKey(uk.messages, "collaboration.reaction.signInToReact"),
      "Sign in to react",
    );
    assert.equal(ieKey(uk.messages, "sidebar.support.support"), "Підтримати");
    assert.equal(ieKey(uk.messages, "sidebar.support.doNotSupport"), "Не підтримувати");
  });

  it("three reaction widgets wire shared collaboration.reaction keys", () => {
    const analysis = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeAnalysisReactionWidget.tsx",
    );
    const proposal = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeProposalReactionWidget.tsx",
    );
    const revision = readWeb(
      "features/initiative-version-revision/components/InitiativeRevisionReactionWidget.tsx",
    );

    for (const source of [analysis, proposal, revision]) {
      assert.match(source, /useTranslations\("initiativeExperience"\)/);
      assert.match(source, /collaboration\.reaction\.supportTarget/);
      assert.match(source, /collaboration\.reaction\.opposeTargetWithCount/);
      assert.match(source, /collaboration\.reaction\.signInToReact/);
      assert.match(source, /collaboration\.reaction\.noteLegal/);
      assert.match(source, /collaboration\.reaction\.aria/);
      assert.match(source, /sidebar\.support\.support/);
      assert.match(source, /sidebar\.support\.doNotSupport/);
      assert.match(source, /detailFromError/);
      assert.doesNotMatch(source, /aria-label="Analysis reaction"/);
      assert.doesNotMatch(source, /aria-label="Proposal reaction"/);
      assert.doesNotMatch(source, /aria-label="Revision reaction"/);
      assert.doesNotMatch(source, />Sign in to react</);
      assert.doesNotMatch(source, />Support Analysis</);
      assert.doesNotMatch(source, /Representative statistics only — this is not a legal vote/);
    }

    assert.match(analysis, /collaboration\.reaction\.targets\.analysis/);
    assert.match(proposal, /collaboration\.reaction\.targets\.proposal/);
    assert.match(revision, /collaboration\.reaction\.targets\.revision/);
  });

  it("canonical reaction codes and auth/API behavior remain unchanged", () => {
    const analysis = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeAnalysisReactionWidget.tsx",
    );
    const proposal = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeProposalReactionWidget.tsx",
    );
    const revision = readWeb(
      "features/initiative-version-revision/components/InitiativeRevisionReactionWidget.tsx",
    );
    const analysisApi = readWeb("features/initiative-collaborative-analysis/api.ts");
    const proposalApi = readWeb("features/initiative-improvement-proposals-stage/api.ts");
    const revisionApi = readWeb("features/initiative-version-revision/api.ts");

    for (const source of [analysis, proposal, revision]) {
      assert.match(source, /handleReact\("support"\)/);
      assert.match(source, /handleReact\("do_not_support"\)/);
      assert.match(source, /currentUserReaction === kind \? "none" : kind/);
      assert.match(source, /authStatus !== "authenticated"/);
      assert.match(source, /authStatus === "unauthenticated"/);
      assert.match(source, /\/login\?returnTo=/);
      assert.match(source, /reactionSummary\.support/);
      assert.match(source, /reactionSummary\.doNotSupport/);
      assert.doesNotMatch(source, /replaceAll\("_", " "\)/);
      assert.doesNotMatch(source, /\.includes\("Support/);
      assert.doesNotMatch(source, /gemini/i);
    }

    assert.match(analysis, /setInitiativeAnalysisReaction\(analysisId, next\)/);
    assert.match(proposal, /setInitiativeProposalReaction\(collectionId, proposalId, next\)/);
    assert.match(revision, /setInitiativeRevisionReaction\(initiativeId, version, next\)/);
    assert.match(analysisApi, /setInitiativeAnalysisReaction/);
    assert.match(proposalApi, /setInitiativeProposalReaction/);
    assert.match(revisionApi, /setInitiativeRevisionReaction/);
  });

  it("arbitrary server Error.message is preserved without English sentence matching", () => {
    const analysis = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeAnalysisReactionWidget.tsx",
    );
    assert.match(analysis, /detailFromError\(reactionError, t\("collaboration\.reaction\.saveFailed"\)\)/);
    assert.doesNotMatch(analysis, /reactionError\.message === "/);
    assert.doesNotMatch(analysis, /message\.includes\(/);
  });

  it("layout resilience for reaction CSS", () => {
    const analysisCss = readWeb(
      "features/initiative-collaborative-analysis/components/initiative-collaborative-analysis-workspace.css",
    );
    const proposalCss = readWeb(
      "features/initiative-improvement-proposals-stage/components/initiative-improvement-proposals-stage-workspace.css",
    );
    const revisionCss = readWeb(
      "features/initiative-version-revision/components/initiative-revision-stage-workspace.css",
    );
    for (const css of [analysisCss, proposalCss, revisionCss]) {
      assert.match(css, /\.i[a-z]+-reaction[^}]*min-width:\s*0/s);
      assert.match(css, /overflow-wrap:\s*anywhere/);
      assert.match(css, /flex-wrap:\s*wrap/);
      assert.match(css, /white-space:\s*normal/);
    }
  });

  it("missing collaboration.reaction key fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        collaboration?: { reaction?: { signInToReact?: string } };
      }
    ).collaboration?.reaction?.signInToReact;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.collaboration.reaction.signInToReact"),
      ),
    );
  });

  it("Petition SignatureWidget and PUBLIC_CHOICE board remain outside this slice", () => {
    const signature = readWeb(
      "features/initiative-petition-lifecycle/components/InitiativePetitionSignatureWidget.tsx",
    );
    const election = readWeb(
      "features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
    );
    assert.doesNotMatch(signature, /collaboration\.reaction/);
    assert.doesNotMatch(election, /collaboration\.reaction/);
    assert.match(signature, /petitionSignature\./);
  });
});
