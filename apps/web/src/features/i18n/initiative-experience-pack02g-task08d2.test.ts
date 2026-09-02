/**
 * Pack 02G Task 08D.2 — shared Author Mode shell + Working Sidebar i18n.
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
  resolveLifecycleStageDisplayLabel,
  resolvePresentationStatusDisplayLabel,
} from "../public-initiative-experience/initiative-experience-i18n.js";

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

describe("Pack 02G Task 08D.2 — Author shared shell / Working Sidebar i18n", () => {
  it("catalog parity en/uk/zh-Hant/ar includes author.shared and author.sidebar", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof authorKey(loaded.messages, "shared.publicPreview"), "string");
      assert.equal(typeof authorKey(loaded.messages, "sidebar.stageStatus"), "string");
      assert.equal(typeof authorKey(loaded.messages, "sidebar.draftCompleteness"), "string");
    }
  });

  it("Ukrainian shared stage-shell and Working Sidebar chrome resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "shared.publicPreview"), "Публічний перегляд");
    assert.equal(authorKey(uk.messages, "shared.returnToEditing"), "Повернутися до редагування");
    assert.ok(authorKey(uk.messages, "sidebar.stageStatus").length > 0);
    assert.notEqual(authorKey(uk.messages, "sidebar.stageStatus"), "Stage Status");
    assert.ok(authorKey(uk.messages, "sidebar.nextStage").includes("{stage}"));
    assert.equal(authorKey(uk.messages, "sidebar.aria"), "Робочі інструменти етапу");
  });

  it("stage ID maps to localized stage label; canonical ID unchanged", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const en = await loadUiMessagesForLocale("en");
    const canonical = "analysis";

    assert.equal(
      resolveLifecycleStageDisplayLabel(canonical, en.messages),
      "Collaborative Analysis",
    );
    assert.equal(
      resolveLifecycleStageDisplayLabel(canonical, uk.messages),
      "Спільний аналіз",
    );
    assert.notEqual(resolveLifecycleStageDisplayLabel(canonical, uk.messages), canonical);

    const shell = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleStageWorkspace.tsx",
    );
    assert.match(shell, /resolveLifecycleStageDisplayLabel/);
    assert.doesNotMatch(shell, /<h2[^>]*>\s*\{projection\.stageLabel\}\s*<\/h2>/);
  });

  it("presentationStatus maps to localized display; canonical status unchanged", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const en = await loadUiMessagesForLocale("en");
    const canonical = "draft";

    assert.equal(
      resolvePresentationStatusDisplayLabel(canonical, en.messages),
      "Draft Saved",
    );
    assert.equal(
      resolvePresentationStatusDisplayLabel(canonical, uk.messages),
      "Чернетку збережено",
    );

    const shell = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleStageWorkspace.tsx",
    );
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    assert.match(shell, /resolvePresentationStatusDisplayLabel/);
    assert.match(sidebar, /resolvePresentationStatusDisplayLabel/);
    assert.match(shell, /status=\{projection\.metadata\.presentationStatus\}/);
  });

  it("Public Preview / Return to Editing / Next Stage use author catalogs", () => {
    const shell = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleStageWorkspace.tsx",
    );
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );

    assert.match(shell, /author\.shared\.publicPreview/);
    assert.match(shell, /author\.shared\.returnToEditing/);
    assert.match(shell, /author\.shared\.nextStage/);
    assert.match(sidebar, /author\.sidebar\.publicPreview/);
    assert.match(sidebar, /author\.sidebar\.nextStage/);
    assert.doesNotMatch(shell, />Public Preview</);
    assert.doesNotMatch(shell, />Return to Editing</);
    assert.doesNotMatch(sidebar, />Public Preview</);
  });

  it("source/public-result civic content bindings remain; chrome localized", () => {
    const sources = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleSourceSnapshotPanel.tsx",
    );
    const result = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecyclePublicResultPanel.tsx",
    );

    assert.match(sources, /author\.shared\.sourcesUsed/);
    assert.match(sources, /item\.label/);
    assert.match(sources, /item\.summary/);
    assert.doesNotMatch(sources, />Sources Used</);
    assert.match(result, /publicResultSlot/);
    assert.match(result, /resolveLifecycleStageDisplayLabel/);
  });

  it("localized shared aria labels; Support/Allies reuse without duplicate catalogs", () => {
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    const shell = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleStageWorkspace.tsx",
    );

    assert.match(sidebar, /author\.sidebar\.aria/);
    assert.match(sidebar, /author\.sidebar\.actionsAria/);
    assert.match(shell, /author\.shared\.stageNavigationAria/);
    assert.doesNotMatch(sidebar, /aria-label="Stage working tools"/);
    assert.doesNotMatch(sidebar, /aria-label="Stage actions"/);

    assert.match(sidebar, /PublicInitiativeSupportStatistics/);
    assert.match(sidebar, /InitiativeActiveAlliesWidget/);
    assert.doesNotMatch(sidebar, /sidebar\.support\.|sidebar\.allies\./);
  });

  it("no Gemini/runtime UI translation in shared shell/sidebar", () => {
    const files = [
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleStageWorkspace.tsx",
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleSourceSnapshotPanel.tsx",
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecyclePublicResultPanel.tsx",
    ];
    for (const file of files) {
      const source = readWeb(file);
      assert.doesNotMatch(source, /gemini/i);
      assert.doesNotMatch(source, /translateUi/i);
      assert.match(source, /useTranslations\("initiativeExperience"\)/);
    }
  });

  it("layout resilience uses wrap-safe / logical styles where touched", () => {
    const css = readWeb(
      "features/initiative-lifecycle-stage-workspace/initiative-lifecycle-stage-workspace.css",
    );
    assert.match(css, /text-align:\s*start/);
    assert.match(css, /min-width:\s*0/);
    assert.match(css, /overflow-wrap:\s*anywhere/);
    assert.match(css, /white-space:\s*normal/);
  });

  it("derive* AI insight template banks remain English (deferred)", () => {
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    assert.match(sidebar, /<h4>Sources Used<\/h4>|<h4>Missing Evidence<\/h4>/);
    assert.match(sidebar, /author\.sidebar\.askAssistant/);
  });

  it("missing author key fails raw catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (uk.initiativeExperience as { author?: { shared?: { publicPreview?: string } } }).author
      ?.shared?.publicPreview;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.author.shared.publicPreview"),
      ),
    );
  });
});
