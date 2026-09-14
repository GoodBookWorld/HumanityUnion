/**
 * Decision Session public structured display — localized structuredContent wins
 * as a coherent bag; never mosaic with canonical nested lists.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { DecisionSessionStructuredContent } from "@hu/types";

import {
  parseDecisionSessionStructuredContent,
  selectDecisionSessionStructuredForDisplay,
} from "./decision-session-structured-display.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const canonical: DecisionSessionStructuredContent = {
  decisionContext: "Canonical context",
  objectives: ["Canonical objective"],
  options: ["Canonical option"],
  supportingArguments: ["Canonical argument"],
  risks: ["Canonical risk"],
  dependencies: [],
  requiredResources: ["Canonical resource"],
  suggestedTimeline: "Canonical timeline",
  suggestedParticipants: [],
  suggestedResponsibleRoles: ["Canonical role"],
  unresolvedQuestions: [],
};

const localizedBag: DecisionSessionStructuredContent = {
  decisionContext: "Контекст",
  objectives: ["Ціль локалізована"],
  options: ["Варіант локалізований"],
  supportingArguments: ["Аргумент локалізований"],
  risks: ["Ризик локалізований"],
  dependencies: [],
  requiredResources: ["Ресурс локалізований"],
  suggestedTimeline: "Графік локалізований",
  suggestedParticipants: [],
  suggestedResponsibleRoles: ["Роль локалізована"],
  unresolvedQuestions: [],
};

describe("Decision Session structured display selection", () => {
  it("parses localized structuredContent JSON into nested lists", () => {
    const parsed = parseDecisionSessionStructuredContent(JSON.stringify(localizedBag));
    assert.ok(parsed);
    assert.deepEqual(parsed.objectives, ["Ціль локалізована"]);
    assert.deepEqual(parsed.options, ["Варіант локалізований"]);
    assert.equal(parsed.suggestedTimeline, "Графік локалізований");
  });

  it("localized structuredContent drives visible nested lists when presentation is complete", () => {
    const selected = selectDecisionSessionStructuredForDisplay({
      localizationComplete: true,
      localizedStructuredJson: JSON.stringify(localizedBag),
      canonicalStructured: canonical,
    });
    assert.ok(selected);
    assert.deepEqual(selected.objectives, ["Ціль локалізована"]);
    assert.doesNotMatch(selected.objectives.join(" "), /Canonical/);
    assert.doesNotMatch(selected.options.join(" "), /Canonical/);
  });

  it("does not render canonical nested arrays over usable localized arrays", () => {
    const selected = selectDecisionSessionStructuredForDisplay({
      localizationComplete: true,
      localizedStructuredJson: JSON.stringify({
        ...localizedBag,
        objectives: ["Only localized objective"],
        options: [],
      }),
      canonicalStructured: canonical,
    });
    assert.ok(selected);
    assert.deepEqual(selected.objectives, ["Only localized objective"]);
    // Coherent localized bag — empty localized options stay empty (no mosaic fill).
    assert.deepEqual(selected.options, []);
    assert.notDeepEqual(selected.options, canonical.options);
  });

  it("falls back coherently to canonical when localized presentation is unavailable", () => {
    const incomplete = selectDecisionSessionStructuredForDisplay({
      localizationComplete: false,
      localizedStructuredJson: JSON.stringify(localizedBag),
      canonicalStructured: canonical,
    });
    assert.deepEqual(incomplete, canonical);

    const unusableJson = selectDecisionSessionStructuredForDisplay({
      localizationComplete: true,
      localizedStructuredJson: "{not-json",
      canonicalStructured: canonical,
    });
    assert.deepEqual(unusableJson, canonical);

    const emptyBag = selectDecisionSessionStructuredForDisplay({
      localizationComplete: true,
      localizedStructuredJson: JSON.stringify({
        decisionContext: "",
        objectives: [],
        options: [],
        supportingArguments: [],
        risks: [],
        dependencies: [],
        requiredResources: [],
        suggestedTimeline: "",
        suggestedParticipants: [],
        suggestedResponsibleRoles: [],
        unresolvedQuestions: [],
      }),
      canonicalStructured: canonical,
    });
    assert.deepEqual(emptyBag, canonical);
  });

  it("works for an arbitrary locale code without locale branching", () => {
    const source = readFileSync(
      path.join(here, "decision-session-structured-display.ts"),
      "utf8",
    );
    const publicResult = readFileSync(
      path.join(here, "components/InitiativeDecisionSessionPublicResult.tsx"),
      "utf8",
    );
    assert.doesNotMatch(source, /\b(uk|ar|zh-Hant|zh_Hant)\b/);
    assert.doesNotMatch(publicResult, /locale\s*===\s*["'](uk|ar|zh)/);
    assert.doesNotMatch(publicResult, /switch\s*\(\s*locale/);
    assert.match(publicResult, /selectDecisionSessionStructuredForDisplay/);
    assert.match(publicResult, /isCompleteLocalizedProseBag/);
    assert.doesNotMatch(publicResult, /CivicPublicTranslatedSection/);
  });
});
