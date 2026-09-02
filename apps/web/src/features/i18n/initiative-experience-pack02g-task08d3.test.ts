/**
 * Pack 02G Task 08D.3 — shared Author actions + Translate Draft chrome i18n.
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
import { resolveSaveButtonLabel } from "../member-profile/use-save-button-phase.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function authorKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, `author.${key}`);
  assert.ok(value, `missing author.${key}`);
  return value;
}

describe("Pack 02G Task 08D.3 — Author shared actions / Translate Draft i18n", () => {
  it("catalog parity en/uk/zh-Hant/ar includes author.actions/translation/sources", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof authorKey(loaded.messages, "actions.saveDraft"), "string");
      assert.equal(typeof authorKey(loaded.messages, "translation.translate"), "string");
      assert.equal(typeof authorKey(loaded.messages, "sources.toggle"), "string");
    }
  });

  it("Ukrainian shared Generate/Save/Preview/Publish chrome resolves natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "actions.generateDraft"), "Згенерувати чернетку");
    assert.equal(authorKey(uk.messages, "actions.saveDraft"), "Зберегти чернетку");
    assert.equal(authorKey(uk.messages, "actions.preview"), "Перегляд");
    assert.equal(authorKey(uk.messages, "actions.publish"), "Опублікувати");
    assert.equal(authorKey(uk.messages, "actions.saving"), "Збереження…");
    assert.equal(authorKey(uk.messages, "actions.saved"), "Збережено");
    assert.notEqual(authorKey(uk.messages, "actions.saveDraft"), "Save Draft");
  });

  it("Ukrainian Translate Draft and Sources chrome resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "translation.title"), "Перекласти чернетку");
    assert.equal(authorKey(uk.messages, "translation.translating"), "Переклад…");
    assert.equal(authorKey(uk.messages, "sources.toggle"), "Джерела");
    assert.equal(authorKey(uk.messages, "sources.hide"), "Приховати джерела");
  });

  it("save-phase helper localizes phases without mutating idle labels", () => {
    assert.equal(resolveSaveButtonLabel("idle", "Save Draft"), "Save Draft");
    assert.equal(
      resolveSaveButtonLabel("saving", "Save Draft", { saving: "Збереження…", success: "Збережено" }),
      "Збереження…",
    );
    assert.equal(
      resolveSaveButtonLabel("success", "Save Draft", { saving: "Збереження…", success: "Збережено" }),
      "Збережено",
    );
    assert.equal(resolveSaveButtonLabel("idle", "Generate Analysis Draft"), "Generate Analysis Draft");
  });

  it("TranslateDraftControl uses author.translation catalogs; draft payload bindings remain", () => {
    const control = readWeb("features/language/components/TranslateDraftControl.tsx");
    assert.match(control, /author\.translation\.translate/);
    assert.match(control, /author\.translation\.translating/);
    assert.match(control, /draftContent/);
    assert.match(control, /onApplyWorkingTranslation/);
    assert.match(control, /requestTranslateDraft/);
    assert.doesNotMatch(control, />Translate Draft</);
    assert.doesNotMatch(control, /gemini/i);
    assert.doesNotMatch(control, /includes\("/);
  });

  it("shared editors bind canonical form values; actions use catalogs", () => {
    const form = readWeb(
      "features/initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisForm.tsx",
    );
    assert.match(form, /useAuthorActionLabels/);
    assert.match(form, /actions\.saveLabel\(savePhase\.phase, actions\.saveDraft\)/);
    assert.match(form, /actions\.preview/);
    assert.match(form, /value=\{form\.title\}/);
    assert.match(form, /value=\{form\.summary\}/);
    assert.match(form, /draftContent=\{\{ \.\.\.form \}\}/);
    assert.doesNotMatch(form, />Save Draft</);
    assert.doesNotMatch(form, />Preview</);
  });

  it("shared Sources chrome uses author.sources; civic source content not dictionary-driven", () => {
    const workspace = readWeb(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionAuthorWorkspace.tsx",
    );
    assert.match(workspace, /actions\.sources|actions\.hideSources/);
    assert.doesNotMatch(workspace, />Sources</);
    assert.doesNotMatch(workspace, />Hide Sources</);

    const sourcesPanel = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleSourceSnapshotPanel.tsx",
    );
    assert.match(sourcesPanel, /item\.label/);
    assert.match(sourcesPanel, /item\.summary/);
  });

  it("accessible names localize for Translate Draft controls", () => {
    const control = readWeb("features/language/components/TranslateDraftControl.tsx");
    assert.match(control, /author\.translation\.aria/);
    assert.match(control, /aria-label=\{t\("author\.translation\.targetLanguage"\)\}/);
    assert.match(control, /aria-label=\{busy \? t\("author\.translation\.translating"\)/);
  });

  it("no Gemini/runtime UI translation and no English sentence matching in shared action helpers", () => {
    const hook = readWeb("features/public-initiative-experience/use-author-action-labels.ts");
    const control = readWeb("features/language/components/TranslateDraftControl.tsx");
    for (const source of [hook, control]) {
      assert.doesNotMatch(source, /gemini/i);
      assert.doesNotMatch(source, /translateUi/i);
      assert.doesNotMatch(source, /\.includes\("/);
      assert.doesNotMatch(source, /\.match\(/);
    }
  });

  it("layout resilience for Translate Draft control CSS", () => {
    const css = readWeb("features/language/components/translate-draft-control.css");
    assert.match(css, /flex-wrap:\s*wrap/);
    assert.match(css, /white-space:\s*normal/);
    assert.match(css, /min-width:\s*0|overflow-wrap:\s*anywhere/);
  });

  it("missing author.actions key fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (uk.initiativeExperience as { author?: { actions?: { saveDraft?: string } } }).author
      ?.actions?.saveDraft;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.author.actions.saveDraft"),
      ),
    );
  });
});
