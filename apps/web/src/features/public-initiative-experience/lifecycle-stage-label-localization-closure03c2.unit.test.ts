/**
 * Closure 03C.2 — Single Initiative Lifecycle stage-label localization.
 * WEB_UI resolver only; no CT / PLP / Gemini.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  formatLifecycleStageDisplayList,
  resolveLifecycleStageDisplayLabel,
  resolveInitiativeExperienceMessage,
} from "../public-initiative-experience/initiative-experience-i18n.js";
import { resolveSidebarAdvisoryDisplay } from "../initiative-lifecycle-stage-workspace/resolve-sidebar-advisory-display.js";
import type { InitiativeExperienceTranslator } from "../public-initiative-experience/initiative-experience-i18n.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function translatorFor(messages: Record<string, unknown>): InitiativeExperienceTranslator {
  return ((key: string, values?: Record<string, string | number | Date>) => {
    const template = resolveInitiativeExperienceMessage(messages, key);
    if (!template) {
      throw new Error(`missing key ${key}`);
    }
    if (!values) {
      return template;
    }
    let result = template;
    for (const [name, value] of Object.entries(values)) {
      result = result.replaceAll(`{${name}}`, String(value));
    }
    return result;
  }) as InitiativeExperienceTranslator;
}

describe("Closure 03C.2 — lifecycle stage label localization", () => {
  it("non-shell PIE stage headings resolve via resolveLifecycleStageDisplayLabel", () => {
    const panel = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(panel, /id=\{`pie-stage-\$\{activeStage\.stageId\}`\}/);
    assert.match(
      panel,
      /resolveLifecycleStageDisplayLabel\(\s*activeStage\.stageId/,
    );
    assert.doesNotMatch(
      panel,
      /id=\{`pie-stage-\$\{activeStage\.stageId\}`\}[\s\S]{0,200}\?\.label\s*\?\?/,
    );
  });

  it("preserves stable pie-stage DOM ids for initiative and discussion", () => {
    const panel = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(panel, /pie-stage-\$\{activeStage\.stageId\}/);
    // Identity is stageId-driven — not derived from translated labels.
    assert.doesNotMatch(panel, /pie-stage-\$\{.*label/);
  });

  it("initiative and discussion resolve to non-English labels under uk", async () => {
    const { messages } = await loadUiMessagesForLocale("uk");
    const initiative = resolveLifecycleStageDisplayLabel("initiative", messages);
    const discussion = resolveLifecycleStageDisplayLabel("discussion", messages);
    const analysis = resolveLifecycleStageDisplayLabel("analysis", messages);
    assert.notEqual(initiative, "Initiative");
    assert.notEqual(discussion, "Discussion");
    assert.notEqual(analysis, "Collaborative Analysis");
    assert.ok(initiative.length > 0);
    assert.ok(discussion.length > 0);
    assert.ok(analysis.length > 0);
  });

  it("stage-list interpolation localizes names, not raw ids or English registry labels", async () => {
    const { messages } = await loadUiMessagesForLocale("uk");
    const list = formatLifecycleStageDisplayList(["discussion", "analysis"], messages);
    assert.doesNotMatch(list, /\bdiscussion\b/);
    assert.doesNotMatch(list, /\banalysis\b/);
    assert.doesNotMatch(list, /Collaborative Analysis/);
    assert.doesNotMatch(list, /^Discussion/);
    assert.match(list, /,/);

    const en = await loadUiMessagesForLocale("en");
    assert.equal(
      formatLifecycleStageDisplayList(["discussion", "analysis"], en.messages),
      "Discussion, Collaborative Analysis",
    );
  });

  it("advisory {stages} resolves controlled stage ids before display", async () => {
    const { messages } = await loadUiMessagesForLocale("uk");
    const t = translatorFor(messages);
    const presentation = resolveSidebarAdvisoryDisplay(
      {
        code: "civic_archive.completeness.missing_optional_stages",
        severity: "warning",
        params: { stages: "discussion, analysis" },
      },
      t,
    );
    assert.doesNotMatch(presentation.text, /Collaborative Analysis/);
    assert.doesNotMatch(presentation.text, /\bdiscussion\b/);
    assert.doesNotMatch(presentation.text, /\banalysis\b/);
    const discussionLabel = resolveLifecycleStageDisplayLabel("discussion", messages);
    const analysisLabel = resolveLifecycleStageDisplayLabel("analysis", messages);
    assert.match(presentation.text, new RegExp(discussionLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(presentation.text, new RegExp(analysisLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("completeness panel formats stage lists through the lifecycle resolver", () => {
    const panel = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveCompletenessPanel.tsx",
    );
    assert.match(panel, /formatLifecycleStageDisplayList/);
    assert.doesNotMatch(panel, /stagesPublished\.join/);
    assert.doesNotMatch(panel, /missingOptionalStages\.join/);
  });

  it("LifecycleStagePanel prefers WEB_UI lifecycleEmpty over API English fallback", () => {
    const panel = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(panel, /lifecycleEmpty\.\$\{code\}/);
    assert.match(panel, /WEB_UI catalog is participant-visible authority/);
    // Catalog resolution precedes emptyStateMessage assignment as authority.
    const emptyFnStart = panel.indexOf("function LifecycleStagePanel");
    const emptyFn = panel.slice(emptyFnStart, emptyFnStart + 900);
    assert.match(emptyFn, /const localized = t\(key\)/);
    assert.match(emptyFn, /message = localized/);
    assert.match(emptyFn, /stage\.emptyStateMessage/);
    const localizedAssign = emptyFn.indexOf("message = localized");
    const apiFallback = emptyFn.indexOf("stage.emptyStateMessage");
    assert.ok(localizedAssign > 0 && apiFallback > localizedAssign);
  });

  it("introduces no CT / PLP / Gemini path on corrected Lifecycle surfaces", () => {
    const files = [
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
      "features/public-initiative-experience/initiative-experience-i18n.ts",
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveCompletenessPanel.tsx",
      "features/initiative-lifecycle-stage-workspace/resolve-sidebar-advisory-display.ts",
      "features/initiative-lifecycle-stage-workspace/resolve-api-consistency-display.ts",
    ];
    for (const relative of files) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /gemini|Gemini/i);
      assert.doesNotMatch(
        source,
        /generateContentTranslation|content.?translation\.service|plpEnqueue|warmCt/i,
      );
    }
  });
});
