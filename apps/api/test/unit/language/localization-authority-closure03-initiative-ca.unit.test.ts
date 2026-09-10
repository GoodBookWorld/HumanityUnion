/**
 * Localization Authority Closure 03 — Initiative / Collaborative Analysis migration.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyControlledPublicVocabularyToProse,
  lifecycleStageToken,
  presentCollaborativeAnalysisFieldsWithControlledVocabulary,
  resolveControlledLifecycleLabel,
  resolvePublicPresentationField,
  type ControlledVocabularyLabelLookup,
} from "@hu/types";

import { findControlledEnglishLifecycleLeaks } from "../../../../web/src/features/public-initiative-experience/assert-no-controlled-english-lifecycle-leaks.js";
import { resolveWorkflowStageControlledLabel } from "../../../src/modules/language/content-translation-lifecycle-slots.js";
import { loadWebUiControlledLifecycleStageLabel } from "../../../src/modules/language/controlled-lifecycle-web-ui-labels.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../../../web");
const typesDomain = path.resolve(here, "../../../../../packages/types/src/domain");

function webUiLookup(locale: "uk" | "ar" | "zh-Hant"): ControlledVocabularyLabelLookup {
  const stages = [
    "initiative",
    "discussion",
    "analysis",
    "proposal",
    "petition",
    "decision_session",
    "collective_decision",
    "commitment",
    "tracking",
    "official_response",
    "public_impact",
    "archive",
  ] as const;
  const lookup: Record<
    string,
    {
      terminologyPreferredTerm?: string | null;
      webUiControlledLabel?: string | null;
      stageId?: string | null;
      registryCanonicalEnglishLabel?: string | null;
    }
  > = {};
  for (const stageId of stages) {
    lookup[stageId] = {
      terminologyPreferredTerm: null,
      webUiControlledLabel: loadWebUiControlledLifecycleStageLabel({
        stageId,
        locale,
      }),
      stageId,
    };
  }
  const messages = JSON.parse(
    readFileSync(path.join(webRoot, "src/features/i18n/messages", `${locale}.json`), "utf8"),
  ) as {
    initiativeExperience: {
      collaboration: { discussion: { chrome: { readyToCollaborate: string } } };
    };
  };
  lookup.ready_to_collaborate = {
    terminologyPreferredTerm: null,
    webUiControlledLabel:
      messages.initiativeExperience.collaboration.discussion.chrome.readyToCollaborate,
    registryCanonicalEnglishLabel: "Ready to Collaborate",
  };
  return lookup as ControlledVocabularyLabelLookup;
}

describe("Localization Authority Closure 03 — Initiative / CA controlled presentation", () => {
  it("A/B/C. uk / ar / zh-Hant Collaborative Analysis resolves via the same authority path", () => {
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const lookup = webUiLookup(locale);
      const presented = presentCollaborativeAnalysisFieldsWithControlledVocabulary({
        fields: {
          title: "Collaborative Analysis: Garden",
          summary: `See ${lifecycleStageToken("analysis")} and Discussion.`,
        },
        labelLookup: lookup,
      });
      const expected = loadWebUiControlledLifecycleStageLabel({
        stageId: "analysis",
        locale,
      });
      assert.ok(expected);
      assert.match(
        presented.title,
        new RegExp(expected!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
      assert.doesNotMatch(presented.title, /Collaborative Analysis/);
      assert.doesNotMatch(presented.summary, /\{lifecycleStage:/);
      assert.doesNotMatch(presented.summary, /\bDiscussion\b/);
    }
  });

  it("D. preferredTerm exists: Terminology wins over WEB_UI", () => {
    const resolved = resolveControlledLifecycleLabel({
      terminologyPreferredTerm: "Term Analysis",
      webUiControlledLabel: "UI Analysis",
      stageId: "analysis",
    });
    assert.equal(resolved.source, "terminology_preferred_term");
    assert.equal(resolved.label, "Term Analysis");
  });

  it("E. preferredTerm missing: WEB_UI wins over Registry English", () => {
    const resolved = resolvePublicPresentationField({
      controlledLifecycle: {
        terminologyPreferredTerm: null,
        webUiControlledLabel: "Спільний аналіз",
        registryCanonicalEnglishLabel: "Collaborative Analysis",
        stageId: "analysis",
      },
    });
    assert.equal(resolved?.value, "Спільний аналіз");
    assert.equal(resolved?.controlledLifecycleSource, "web_ui_controlled_label");
  });

  it("F/G/H/I. Initiative / Discussion / Analysis / Proposal tokens resolve", () => {
    // Empty concepts = no preferredTerm → WEB_UI (provider/Mongo-free unit path).
    const concepts: never[] = [];
    const cases = [
      ["initiative", "uk"],
      ["discussion", "ar"],
      ["analysis", "zh-Hant"],
      ["proposal", "uk"],
    ] as const;
    for (const [stageId, locale] of cases) {
      const label = resolveWorkflowStageControlledLabel({
        concepts,
        stageId,
        targetLocale: locale,
      });
      const webUi = loadWebUiControlledLifecycleStageLabel({ stageId, locale });
      assert.ok(webUi);
      assert.equal(label, webUi);
    }
  });

  it("J. Ready to Collaborate controlled domain term resolves", () => {
    const lookup = webUiLookup("uk");
    const applied = applyControlledPublicVocabularyToProse({
      prose: "3 participants Ready to Collaborate.",
      labelLookup: lookup,
    });
    assert.match(applied.text, /Готовий до співпраці/);
    assert.doesNotMatch(applied.text, /Ready to Collaborate/);
  });

  it("K. historical translated prose with English controlled labels is corrected at presentation", () => {
    const lookup = webUiLookup("ar");
    const presented = presentCollaborativeAnalysisFieldsWithControlledVocabulary({
      fields: {
        title: "Collaborative Analysis draft",
        summary: "Initiative and Improvement Proposals were discussed.",
      },
      labelLookup: lookup,
    });
    assert.doesNotMatch(presented.title, /Collaborative Analysis/);
    assert.doesNotMatch(presented.summary, /\bInitiative\b/);
    assert.doesNotMatch(presented.summary, /Improvement Proposals/);
  });

  it("L. tokenized surrounding machine prose remains intact except controlled substitution", () => {
    const lookup = webUiLookup("uk");
    const token = lifecycleStageToken("discussion");
    const applied = applyControlledPublicVocabularyToProse({
      prose: `Machine prose about ${token} stays otherwise intact.`,
      labelLookup: lookup,
    });
    assert.match(applied.text, /^Machine prose about /);
    assert.match(applied.text, / stays otherwise intact\.$/);
    assert.doesNotMatch(applied.text, /\{lifecycleStage:/);
  });

  it("M. no uncontrolled English lifecycle fallback when WEB_UI translation exists", () => {
    const lookup = webUiLookup("uk");
    const presented = presentCollaborativeAnalysisFieldsWithControlledVocabulary({
      fields: { title: "Collaborative Analysis: X" },
      labelLookup: lookup,
    });
    const leaks = findControlledEnglishLifecycleLeaks({
      presentationText: presented.title,
      documentLocale: "uk",
      labelLookup: lookup,
    });
    assert.equal(leaks.length, 0);
  });

  it("N/O. presentation path has no provider invocation or localization writes", () => {
    const presenter = readFileSync(
      path.join(typesDomain, "present-controlled-collaborative-analysis.ts"),
      "utf8",
    );
    const fields = readFileSync(
      path.join(webRoot, "src/features/language/components/PublicTranslatedFields.tsx"),
      "utf8",
    );
    for (const src of [presenter, fields]) {
      assert.doesNotMatch(src, /\bTranslationProvider\b/);
      assert.doesNotMatch(src, /\/translations\/generate/);
      assert.doesNotMatch(src, /\binsertOne\b|\bupdateOne\b|\benqueueContentTranslation/);
    }
  });

  it("Q. Reset 01 — PublicTranslatedFields uses complete bag or coherent original (no CV prose substitute)", () => {
    const publicFields = readFileSync(
      path.join(webRoot, "src/features/language/components/PublicTranslatedFields.tsx"),
      "utf8",
    );
    assert.match(publicFields, /isCompleteLocalizedProseBag/);
    assert.match(publicFields, /data-hu-localization-boundary=["']visible-content["']/);
    assert.doesNotMatch(publicFields, /presentCollaborativeAnalysisFieldsWithControlledVocabulary/);
  });

  it("R. user-authored arbitrary English prose is not globally rewritten", () => {
    const lookup = webUiLookup("uk");
    const applied = applyControlledPublicVocabularyToProse({
      prose: "The garden needs watering before Friday.",
      labelLookup: lookup,
    });
    assert.equal(applied.text, "The garden needs watering before Friday.");
    assert.equal(applied.substitutions.length, 0);
  });
});

describe("Localization Authority Closure 03 — leakage helper", () => {
  it("detects remaining English controlled labels when localized authority exists", () => {
    const lookup = webUiLookup("uk");
    const leaks = findControlledEnglishLifecycleLeaks({
      presentationText: "Collaborative Analysis remains English",
      documentLocale: "uk",
      labelLookup: lookup,
    });
    assert.ok(leaks.some((row) => row.conceptId === "analysis"));
  });
});
