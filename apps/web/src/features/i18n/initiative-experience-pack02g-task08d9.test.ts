/**
 * Pack 02G Task 08D.9 — Official Response + Public Impact + Civic Archive author i18n.
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
  resolveCivicArchiveSectionDisplayLabel,
  resolveCivicArchiveTimelineStatusDisplayLabel,
  resolveInitiativeExperienceMessage,
  resolveOfficialResponseTypeDisplayLabel,
  resolveOfficialResponseVerificationDisplayLabel,
  resolvePublicImpactSectionDisplayLabel,
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

describe("Pack 02G Task 08D.9 — Official Response + Public Impact + Archive author i18n", () => {
  it("catalog parity en/uk/zh-Hant/ar includes officialResponse, publicImpact, archive", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(typeof authorKey(loaded.messages, "officialResponse.generateOpenDraft"), "string");
      assert.equal(
        typeof authorKey(loaded.messages, "officialResponse.responseTypes.official_letter"),
        "string",
      );
      assert.equal(typeof authorKey(loaded.messages, "publicImpact.generateImpactDraft"), "string");
      assert.equal(
        typeof authorKey(loaded.messages, "publicImpact.sections.executive_summary"),
        "string",
      );
      assert.equal(typeof authorKey(loaded.messages, "archive.generateArchiveDraft"), "string");
      assert.equal(
        typeof authorKey(loaded.messages, "archive.timelineStatuses.published"),
        "string",
      );
    }
  });

  it("Ukrainian Official Response headings/fields/actions resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "officialResponse.fields.organization"), "Організація");
    assert.equal(
      authorKey(uk.messages, "officialResponse.fields.referenceNumber"),
      "Номер посилання",
    );
    assert.equal(
      authorKey(uk.messages, "officialResponse.generateOpenDraft"),
      "Згенерувати / Відкрити чернетку",
    );
    assert.equal(
      authorKey(uk.messages, "officialResponse.responseTypes.official_letter"),
      "Офіційний лист",
    );
    assert.equal(authorKey(uk.messages, "officialResponse.verificationStatuses.pending"), "Очікує");
    assert.notEqual(
      authorKey(uk.messages, "officialResponse.generateOpenDraft"),
      "Generate / Open Draft",
    );
    assert.equal(authorKey(uk.messages, "actions.saveDraft"), "Зберегти чернетку");
  });

  it("Ukrainian Public Impact headings/fields/actions resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(authorKey(uk.messages, "publicImpact.fields.title"), "Заголовок");
    assert.equal(authorKey(uk.messages, "publicImpact.fields.body"), "Текст");
    assert.equal(
      authorKey(uk.messages, "publicImpact.generateImpactDraft"),
      "Згенерувати чернетку публічного впливу",
    );
    assert.equal(
      authorKey(uk.messages, "publicImpact.sections.executive_summary"),
      "Короткий підсумок",
    );
    assert.notEqual(
      authorKey(uk.messages, "publicImpact.generateImpactDraft"),
      "Generate Public Impact Draft",
    );
  });

  it("Ukrainian Civic Archive headings/fields/actions resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(
      authorKey(uk.messages, "archive.fields.finalArchiveTitle"),
      "Фінальний заголовок архіву",
    );
    assert.equal(
      authorKey(uk.messages, "archive.generateArchiveDraft"),
      "Згенерувати чернетку громадянського архіву",
    );
    assert.equal(
      authorKey(uk.messages, "archive.publishAndComplete"),
      "Опублікувати та завершити життєвий цикл ініціативи",
    );
    assert.equal(authorKey(uk.messages, "archive.timelineStatuses.published"), "Опубліковано");
    assert.notEqual(
      authorKey(uk.messages, "archive.generateArchiveDraft"),
      "Generate Civic Archive Draft",
    );
  });

  it("Official Response canonical org/reference/body stay state-bound; status display-only", () => {
    const editor = readWeb(
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponseEditor.tsx",
    );
    const preview = readWeb(
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponseDraftPreview.tsx",
    );
    assert.match(editor, /value=\{candidate\.organization\}/);
    assert.match(editor, /value=\{candidate\.institution\}/);
    assert.match(editor, /value=\{candidate\.subject\}/);
    assert.match(editor, /value=\{candidate\.summary\}/);
    assert.match(editor, /value=\{candidate\.referenceNumber\}/);
    assert.match(editor, /value=\{candidate\.responseType\}/);
    assert.match(editor, /value=\{candidate\.verificationStatus\}/);
    assert.match(editor, /resolveOfficialResponseTypeDisplayLabel\(option, t\)/);
    assert.match(editor, /resolveOfficialResponseVerificationDisplayLabel\(option, t\)/);
    assert.match(preview, /resolveOfficialResponseVerificationDisplayLabel\(/);
    assert.doesNotMatch(editor, /value=\{t\(/);
    assert.doesNotMatch(editor, />Generate \/ Open Draft</);
    assert.doesNotMatch(editor, /replaceAll\("_", " "\)/);
  });

  it("Official Response type/verification resolvers are display-only; unknown safe", async () => {
    const en = await loadUiMessagesForLocale("en");
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(
      resolveOfficialResponseTypeDisplayLabel("official_letter", en.messages),
      "Official letter",
    );
    assert.equal(
      resolveOfficialResponseTypeDisplayLabel("official_letter", uk.messages),
      "Офіційний лист",
    );
    assert.equal(
      resolveOfficialResponseTypeDisplayLabel("weird_type", en.messages),
      "weird_type",
    );
    assert.equal(
      resolveOfficialResponseVerificationDisplayLabel("pending", uk.messages),
      "Очікує",
    );
    assert.equal(
      resolveOfficialResponseVerificationDisplayLabel("weird_status", en.messages),
      "weird_status",
    );
  });

  it("Public Impact canonical civic content and numeric metrics stay data-bound", () => {
    const editor = readWeb(
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactEditor.tsx",
    );
    const renderer = readWeb(
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactReportRenderer.tsx",
    );
    const panel = readWeb(
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactIntelligenceSnapshotPanel.tsx",
    );
    assert.match(editor, /value=\{title\}/);
    assert.match(editor, /value=\{section\.body\}/);
    assert.match(editor, /value=\{section\.evidenceReferences\.join/);
    assert.match(editor, /section\.title \|\|/);
    assert.match(editor, /resolvePublicImpactSectionDisplayLabel\(section\.sectionId, t\)/);
    assert.match(renderer, /title \|\| t\("author\.publicImpact\.report\.untitled"\)/);
    assert.match(renderer, /section\.title \|\|/);
    assert.match(renderer, /participationStats/);
    assert.match(panel, /signatures: snapshot\.participationStatistics\.signatureCount/);
    assert.doesNotMatch(editor, /value=\{t\(/);
    assert.doesNotMatch(editor, />Generate Public Impact Draft</);
    assert.doesNotMatch(editor, /replaceAll\("_", " "\)/);
  });

  it("Public Impact section resolvers are display-only; unknown safe", async () => {
    const en = await loadUiMessagesForLocale("en");
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(
      resolvePublicImpactSectionDisplayLabel("executive_summary", en.messages),
      "Executive summary",
    );
    assert.equal(
      resolvePublicImpactSectionDisplayLabel("executive_summary", uk.messages),
      "Короткий підсумок",
    );
    assert.equal(
      resolvePublicImpactSectionDisplayLabel("unknown_section", en.messages),
      "unknown_section",
    );
  });

  it("Civic Archive canonical archive content and IDs stay data-bound", () => {
    const editor = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveEditor.tsx",
    );
    const document = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveDocumentRenderer.tsx",
    );
    const completeness = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveCompletenessPanel.tsx",
    );
    assert.match(editor, /value=\{finalArchiveTitle\}/);
    assert.match(editor, /value=\{finalSummary\}/);
    assert.match(editor, /value=\{lessonsLearned\}/);
    assert.match(editor, /value=\{knowledgeContribution\}/);
    assert.match(editor, /section\.title \|\|/);
    assert.match(editor, /section\.body\.trim\(\)/);
    assert.match(document, /document\.finalArchiveTitle/);
    assert.match(document, /section\.title \|\|/);
    assert.match(document, /resolveCivicArchiveSectionDisplayLabel/);
    assert.match(document, /resolveCivicArchiveTimelineStatusDisplayLabel/);
    assert.match(document, /section\.sourceRecordIds/);
    assert.match(completeness, /completeness\.summary/);
    assert.doesNotMatch(editor, /value=\{t\(/);
    assert.doesNotMatch(editor, />Generate Civic Archive Draft</);
    assert.doesNotMatch(editor, /Applied AI suggestions to:/);
    assert.doesNotMatch(editor, /replaceAll\("_", " "\)/);
  });

  it("Civic Archive section/timeline resolvers are display-only; unknown safe", async () => {
    const en = await loadUiMessagesForLocale("en");
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(
      resolveCivicArchiveSectionDisplayLabel("archive_overview", en.messages),
      "Archive overview",
    );
    assert.equal(
      resolveCivicArchiveTimelineStatusDisplayLabel("published", uk.messages),
      "Опубліковано",
    );
    assert.equal(
      resolveCivicArchiveSectionDisplayLabel("weird_section", en.messages),
      "weird_section",
    );
    assert.equal(
      resolveCivicArchiveTimelineStatusDisplayLabel("weird_status", en.messages),
      "weird_status",
    );
  });

  it("preview/public chrome localized for all three stages", () => {
    const orPreview = readWeb(
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponseDraftPreview.tsx",
    );
    const orPublic = readWeb(
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponsePublicResult.tsx",
    );
    const piPreview = readWeb(
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactDraftPreview.tsx",
    );
    const piPublic = readWeb(
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactPublicResult.tsx",
    );
    const arPreview = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveDraftPreview.tsx",
    );
    const arPublic = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchivePublicResult.tsx",
    );
    assert.match(orPreview, /author\.officialResponse\.preview\./);
    assert.match(orPublic, /author\.officialResponse\.public\./);
    assert.match(piPreview, /author\.publicImpact\.preview\./);
    assert.match(piPublic, /author\.publicImpact\.public\./);
    assert.match(arPreview, /author\.archive\.preview\./);
    assert.match(arPublic, /author\.archive\.public\./);
  });

  it("localized a11y names for Official Response, Public Impact, Archive author chrome", () => {
    const orPreview = readWeb(
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponseDraftPreview.tsx",
    );
    const orPublic = readWeb(
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponsePublicResult.tsx",
    );
    const orPanel = readWeb(
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponseIntelligenceSnapshotPanel.tsx",
    );
    const piRenderer = readWeb(
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactReportRenderer.tsx",
    );
    const piPanel = readWeb(
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactIntelligenceSnapshotPanel.tsx",
    );
    const arDocument = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveDocumentRenderer.tsx",
    );
    const arShare = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveShareToolbar.tsx",
    );
    assert.match(orPreview, /author\.officialResponse\.preview\.aria/);
    assert.match(orPublic, /author\.officialResponse\.public\.aria/);
    assert.match(orPanel, /author\.officialResponse\.sourceSnapshot\.aria/);
    assert.match(piRenderer, /author\.publicImpact\.report\.aria/);
    assert.match(piPanel, /author\.publicImpact\.sourceSnapshot\.aria/);
    assert.match(arDocument, /author\.archive\.document\.aria/);
    assert.match(arShare, /aria-label=\{`\$\{t\("author\.archive\.share\.share"\)/);
    assert.doesNotMatch(orPreview, /aria-label="Official Responses draft preview"/);
    assert.doesNotMatch(piRenderer, /aria-label="Public Impact Report"/);
    assert.doesNotMatch(arDocument, /aria-label="Civic Archive"/);
  });

  it("source excerpts/API prose preserved; snapshot chrome localized", () => {
    const orPanel = readWeb(
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponseIntelligenceSnapshotPanel.tsx",
    );
    const piPanel = readWeb(
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactIntelligenceSnapshotPanel.tsx",
    );
    const arPanel = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveIntelligenceSnapshotPanel.tsx",
    );
    const completeness = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveCompletenessPanel.tsx",
    );
    assert.match(orPanel, /author\.officialResponse\.sourceSnapshot\./);
    assert.match(piPanel, /author\.publicImpact\.sourceSnapshot\./);
    assert.match(arPanel, /author\.archive\.sourceSnapshot\./);
    assert.match(completeness, /\{completeness\.summary\}/);
    assert.match(orPanel, /snapshot\.trackingPackageReference\.title/);
    assert.match(piPanel, /snapshot\.officialResponsePackageReference/);
  });

  it("AI-generated civic content is not sourced from next-intl; derive banks untouched", () => {
    const orEditor = readWeb(
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponseEditor.tsx",
    );
    const piEditor = readWeb(
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactEditor.tsx",
    );
    const arEditor = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveEditor.tsx",
    );
    const orDerive = readWeb(
      "features/initiative-official-response-lifecycle/derive-official-response-ai-assistant-insights.ts",
    );
    const piDerive = readWeb(
      "features/initiative-public-impact-lifecycle/derive-public-impact-ai-assistant-insights.ts",
    );
    const arDerive = readWeb(
      "features/initiative-civic-archive-lifecycle/derive-civic-archive-ai-assistant-insights.ts",
    );
    assert.match(orEditor, /generateInitiativeOfficialResponseDraft|generateOfficialResponse/i);
    assert.match(piEditor, /generateInitiativePublicImpactDraft|generatePublicImpact/i);
    assert.match(arEditor, /generateInitiativeCivicArchiveDraft/);
    assert.match(orEditor, /detailFromError/);
    assert.match(piEditor, /detailFromError/);
    assert.match(arEditor, /detailFromError/);
    assert.doesNotMatch(orEditor, /gemini/i);
    assert.doesNotMatch(piEditor, /gemini/i);
    assert.doesNotMatch(arEditor, /gemini/i);
    assert.doesNotMatch(orDerive, /useTranslations/);
    assert.doesNotMatch(piDerive, /useTranslations/);
    assert.doesNotMatch(arDerive, /useTranslations/);
    assert.doesNotMatch(orDerive, /author\.officialResponse/);
    assert.doesNotMatch(piDerive, /author\.publicImpact/);
    assert.doesNotMatch(arDerive, /author\.archive/);
  });

  it("no Gemini/runtime UI translation in Official Response / Public Impact / Archive author components", () => {
    const files = [
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponseAuthorWorkspace.tsx",
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponseEditor.tsx",
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactAuthorWorkspace.tsx",
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactEditor.tsx",
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveAuthorWorkspace.tsx",
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveEditor.tsx",
      "features/public-initiative-experience/initiative-experience-i18n.ts",
    ];
    for (const relative of files) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /gemini/i);
      assert.doesNotMatch(source, /translateUi/i);
    }
  });

  it("no English sentence matching for errors/status on these author paths", () => {
    const files = [
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponseEditor.tsx",
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactEditor.tsx",
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveEditor.tsx",
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponsePublicResult.tsx",
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactPublicResult.tsx",
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchivePublicResult.tsx",
    ];
    for (const relative of files) {
      const source = readWeb(relative);
      assert.doesNotMatch(source, /replaceAll\("_", " "\)/);
      assert.doesNotMatch(source, /\.includes\("Generate /);
      assert.doesNotMatch(source, /\.startsWith\("Applied AI/);
      assert.doesNotMatch(source, /toLowerCase\(\)\.includes/);
    }
  });

  it("layout resilience for Official Response, Public Impact, Archive CSS", () => {
    const orCss = readWeb(
      "features/initiative-official-response-lifecycle/components/initiative-official-response-stage-workspace.css",
    );
    const piCss = readWeb(
      "features/initiative-public-impact-lifecycle/components/initiative-public-impact-stage-workspace.css",
    );
    const arCss = readWeb(
      "features/initiative-civic-archive-lifecycle/components/initiative-civic-archive-stage-workspace.css",
    );
    for (const css of [orCss, piCss, arCss]) {
      assert.match(css, /min-width:\s*0/);
      assert.match(css, /overflow-wrap:\s*anywhere|overflow-wrap:\s*break-word/);
      assert.match(css, /flex-wrap:\s*wrap/);
      assert.match(css, /padding-inline-start/);
    }
  });

  it("missing author.officialResponse key fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        author?: { officialResponse?: { generateOpenDraft?: string } };
      }
    ).author?.officialResponse?.generateOpenDraft;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.author.officialResponse.generateOpenDraft"),
      ),
    );
  });

  it("shared author.actions reused; stage keys do not duplicate Save/Preview/Publish", () => {
    const orEditor = readWeb(
      "features/initiative-official-response-lifecycle/components/InitiativeOfficialResponseEditor.tsx",
    );
    const piEditor = readWeb(
      "features/initiative-public-impact-lifecycle/components/InitiativePublicImpactEditor.tsx",
    );
    const arEditor = readWeb(
      "features/initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveEditor.tsx",
    );
    for (const editor of [orEditor, piEditor, arEditor]) {
      assert.match(editor, /useAuthorActionLabels/);
      assert.match(editor, /actions\.saveDraft|actions\.saveLabel/);
      assert.match(editor, /actions\.preview/);
    }
  });
});
