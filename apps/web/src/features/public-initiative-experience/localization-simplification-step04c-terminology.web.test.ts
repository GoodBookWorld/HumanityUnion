/**
 * Localization Simplification Step 04C —
 * remaining public controlled-term surfaces reuse Terminology preferredTerm.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

import { applyControlledPublicVocabularyToProse } from "@hu/types";

import {
  getControlledVocabularyPreferredTermsMap,
  resetControlledLifecyclePreferredTermsCacheForTests,
  seedControlledLifecyclePreferredTermsForTests,
} from "../language/controlled-lifecycle-preferred-terms";
import { buildInitiativeControlledVocabularyLabelLookup } from "./build-initiative-controlled-vocabulary-label-lookup";
import {
  resolveInitiativeCardStageLabel,
  resolveInitiativeCardStatusLabel,
} from "../public-initiative-mini-card/resolve-initiative-card-semantic-labels";
import { resolveActivityAreaDisplayLabel } from "./initiative-experience-i18n";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

const ukMessages = {
  initiativeExperience: {
    stages: {
      discussion: "Обговорення (WEB_UI)",
      analysis: "Спільний аналіз (WEB_UI)",
      proposal: "Пропозиції покращення (WEB_UI)",
    },
    statuses: {
      discussion: "Обговорення (status WEB_UI)",
    },
    activityAreas: {
      humanRights: "Права людини (WEB_UI)",
    },
    collaboration: {
      discussion: {
        chrome: {
          readyToCollaborate: "Готовий співпрацювати (WEB_UI)",
        },
      },
    },
  },
} as const;

function tFromMessages(messages: typeof ukMessages) {
  return (key: string) => {
    const parts = key.split(".");
    let cursor: unknown = messages.initiativeExperience;
    for (const part of parts) {
      if (!cursor || typeof cursor !== "object") {
        return key;
      }
      cursor = (cursor as Record<string, unknown>)[part];
    }
    return typeof cursor === "string" ? cursor : key;
  };
}

describe("Localization Simplification Step 04C — residual controlled Terminology coverage", () => {
  afterEach(() => {
    resetControlledLifecyclePreferredTermsCacheForTests();
  });

  it("card stage labels use preferredTerm when available", () => {
    seedControlledLifecyclePreferredTermsForTests({
      locale: "uk",
      preferredTermsByStageId: {
        discussion: "Обговорення",
      },
    });

    assert.equal(
      resolveInitiativeCardStageLabel("discussion", ukMessages, { locale: "uk" }),
      "Обговорення",
    );
  });

  it("card stage WEB_UI fallback still works without preferredTerm", () => {
    seedControlledLifecyclePreferredTermsForTests({
      locale: "uk",
      preferredTermsByStageId: {},
    });

    assert.equal(
      resolveInitiativeCardStageLabel("discussion", ukMessages, { locale: "uk" }),
      "Обговорення (WEB_UI)",
    );
  });

  it("card stage canonical English remains final fallback", () => {
    const empty = { stages: {} } as const;
    assert.equal(
      resolveInitiativeCardStageLabel("discussion", empty, {
        locale: "uk",
        terminologyPreferredTerm: null,
      }),
      "Discussion",
    );
  });

  it("status badges stay on ordinary WEB_UI and do not use Terminology preferredTerm", () => {
    seedControlledLifecyclePreferredTermsForTests({
      locale: "uk",
      preferredTermsByStageId: {
        discussion: "Термінологія-стадія",
      },
      preferredTermsByConceptId: {
        discussion: "Термінологія-стадія",
      },
    });

    assert.equal(
      resolveInitiativeCardStatusLabel("Discussion", ukMessages),
      "Обговорення (status WEB_UI)",
    );
    assert.notEqual(
      resolveInitiativeCardStatusLabel("Discussion", ukMessages),
      "Термінологія-стадія",
    );
  });

  it("activity areas stay ordinary WEB_UI and are not Terminology-routed", () => {
    seedControlledLifecyclePreferredTermsForTests({
      locale: "uk",
      preferredTermsByStageId: {},
      preferredTermsByConceptId: {
        human_rights: "НЕ МАЄ ВИКОРИСТОВУВАТИСЬ",
      },
    });

    const i18n = readWeb("features/public-initiative-experience/initiative-experience-i18n.ts");
    assert.match(i18n, /export function resolveActivityAreaDisplayLabel/);
    assert.doesNotMatch(
      i18n.slice(
        i18n.indexOf("export function resolveActivityAreaDisplayLabel"),
        i18n.indexOf("export function resolveActivityAreaDisplayLabel") + 800,
      ),
      /getControlledLifecyclePreferredTerm|preferredTerm/,
    );
    assert.equal(
      resolveActivityAreaDisplayLabel("Human Rights", ukMessages),
      "Права людини (WEB_UI)",
    );
  });

  it("Improvement Proposal controlled-vocabulary lookup prefers Terminology preferredTerm", () => {
    seedControlledLifecyclePreferredTermsForTests({
      locale: "uk",
      preferredTermsByStageId: {
        discussion: "Обговорення",
      },
      preferredTermsByConceptId: {
        ready_to_collaborate: "Готовий співпрацювати",
      },
    });

    const terminologyPreferredTerms = getControlledVocabularyPreferredTermsMap("uk");
    const labelLookup = buildInitiativeControlledVocabularyLabelLookup({
      tInitiativeExperience: tFromMessages(ukMessages),
      terminologyPreferredTerms,
    });

    const substituted = applyControlledPublicVocabularyToProse({
      prose: "Ready to Collaborate during Discussion",
      labelLookup,
    });

    assert.match(substituted.text, /Готовий співпрацювати/);
    assert.match(substituted.text, /Обговорення/);
    assert.doesNotMatch(substituted.text, /Ready to Collaborate/);
    assert.doesNotMatch(substituted.text, /Discussion/);
  });

  it("Improvement Proposal WEB_UI fallback still works when preferredTerm absent", () => {
    seedControlledLifecyclePreferredTermsForTests({
      locale: "uk",
      preferredTermsByStageId: {},
    });

    const labelLookup = buildInitiativeControlledVocabularyLabelLookup({
      tInitiativeExperience: tFromMessages(ukMessages),
      terminologyPreferredTerms: getControlledVocabularyPreferredTermsMap("uk"),
    });

    const substituted = applyControlledPublicVocabularyToProse({
      prose: "Discussion",
      labelLookup,
    });
    assert.equal(substituted.text, "Обговорення (WEB_UI)");
  });

  it("ordinary participant prose without controlled tokens is left untouched", () => {
    seedControlledLifecyclePreferredTermsForTests({
      locale: "uk",
      preferredTermsByStageId: { discussion: "Обговорення" },
    });
    const labelLookup = buildInitiativeControlledVocabularyLabelLookup({
      tInitiativeExperience: tFromMessages(ukMessages),
      terminologyPreferredTerms: getControlledVocabularyPreferredTermsMap("uk"),
    });

    const prose = "Neighbors planted trees near the school gate.";
    assert.equal(
      applyControlledPublicVocabularyToProse({ prose, labelLookup }).text,
      prose,
    );
  });

  it("residual controlled surfaces wire locale / preferredTerm / translate=no", () => {
    const latest = readWeb("features/public-experience/components/LatestInitiativeCard.tsx");
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    const participation = readWeb(
      "features/public-initiative-experience/components/YourParticipationPanel.tsx",
    );
    const overview = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    const ipFields = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsContentFields.tsx",
    );
    const protectedText = readWeb(
      "features/language/components/ProtectedAuthoritativeText.tsx",
    );

    assert.match(latest, /useControlledLifecyclePreferredTermsLocale/);
    assert.match(latest, /resolveInitiativeCardStageLabel\([\s\S]*\{\s*locale\s*,?\s*\}/);
    assert.match(latest, /ProtectedAuthoritativeText/);
    assert.match(sidebar, /resolveLifecycleStageDisplayLabel\([\s\S]*\{\s*locale\s*\}/);
    assert.match(sidebar, /wrapAuthoritativeTermInMessage/);
    assert.match(participation, /wrapAuthoritativeTermInMessage/);
    assert.match(overview, /overview\.status[\s\S]*ProtectedAuthoritativeText/);
    assert.match(ipFields, /terminologyPreferredTerms/);
    assert.match(ipFields, /getControlledVocabularyPreferredTermsMap/);
    assert.match(protectedText, /translate:\s*"no"/);
  });

  it("future locales remain Registry-driven (no hardcoding)", () => {
    const cache = readWeb("features/language/controlled-lifecycle-preferred-terms.ts");
    const cardLabels = readWeb(
      "features/public-initiative-mini-card/resolve-initiative-card-semantic-labels.ts",
    );
    const apiPublic = readFileSync(
      path.join(
        webSrc,
        "../../api/src/modules/language/terminology-glossary/terminology-glossary.public.ts",
      ),
      "utf8",
    );

    assert.doesNotMatch(cache, /\b(?:uk|ar|zh-Hant|ka)\b/);
    assert.doesNotMatch(cardLabels, /\b(?:uk|ar|zh-Hant|ka)\b/);
    assert.doesNotMatch(apiPublic, /\b(?:uk|ar|zh-Hant|ka)\b/);
    assert.match(apiPublic, /preferredTermsByConceptId/);
    assert.match(apiPublic, /CONTROLLED_PUBLIC_VOCABULARY_REGISTRY/);
  });
});
