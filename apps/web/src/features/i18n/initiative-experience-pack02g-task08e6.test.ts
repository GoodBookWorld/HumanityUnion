/**
 * Pack 02G Task 08E.6 — Humanity Union Assistant modal chrome localization.
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

const ASSISTANT_MODAL_KEYS = [
  "assistant.modal.title",
  "assistant.modal.close",
  "assistant.modal.closeAria",
  "assistant.modal.loadingContext",
  "assistant.modal.loading",
  "assistant.modal.working",
  "assistant.modal.conversationAria",
  "assistant.modal.sourcesPrefix",
  "assistant.modal.platformKnowledge",
  "assistant.modal.roleAssistant",
  "assistant.modal.roleYou",
  "assistant.modal.suggestedQuestions",
  "assistant.modal.privacyNotice",
  "assistant.modal.askLabel",
  "assistant.modal.askPlaceholder",
  "assistant.modal.send",
  "assistant.modal.explainContext",
  "assistant.modal.useSuggestion",
  "assistant.modal.newConversation",
  "assistant.modal.clearContext",
  "assistant.modal.continueDefault",
  "assistant.modal.guestGuidance",
  "assistant.modal.signIn",
  "assistant.modal.register",
] as const;

const ASSISTANT_MESSAGE_KEYS = [
  "assistant.messages.openFailed",
  "assistant.messages.rateLimited",
  "assistant.messages.temporarilyUnavailable",
  "assistant.messages.autoApplyForbidden",
  "assistant.messages.appliedToDraft",
  "assistant.messages.appliedToBlog",
] as const;

describe("Pack 02G Task 08E.6 — Humanity Union Assistant modal chrome", () => {
  it("catalog parity includes assistant.modal / assistant.messages", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of [...ASSISTANT_MODAL_KEYS, ...ASSISTANT_MESSAGE_KEYS]) {
        assert.equal(typeof ieKey(loaded.messages, key), "string");
      }
    }
  });

  it("Ukrainian modal chrome resolves for title / composer / loading / close", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(ieKey(uk.messages, "assistant.modal.title"), "Асистент Humanity Union");
    assert.equal(ieKey(uk.messages, "assistant.modal.close"), "Закрити");
    assert.equal(ieKey(uk.messages, "assistant.modal.closeAria"), "Закрити асистента");
    assert.equal(ieKey(uk.messages, "assistant.modal.send"), "Надіслати");
    assert.equal(ieKey(uk.messages, "assistant.modal.askLabel"), "Запитати асистента");
    assert.match(ieKey(uk.messages, "assistant.modal.askPlaceholder"), /Запитайте/);
    assert.equal(ieKey(uk.messages, "assistant.modal.working"), "Працюємо…");
    assert.equal(ieKey(uk.messages, "assistant.modal.loading"), "Завантаження асистента…");
    assert.equal(
      ieKey(uk.messages, "assistant.modal.useSuggestion"),
      "Використати пропозицію в редакторі чернетки",
    );
    assert.equal(ieKey(uk.messages, "assistant.modal.newConversation"), "Нова розмова");
    assert.doesNotMatch(ieKey(uk.messages, "assistant.modal.title"), /^Humanity Union Assistant$/);
    assert.doesNotMatch(ieKey(uk.messages, "assistant.modal.send"), /^Send$/);
    assert.doesNotMatch(ieKey(uk.messages, "assistant.modal.working"), /^Working/);
  });

  it("uk/zh-Hant/ar assistant chrome is not accidental English UI", async () => {
    const englishMarkers = [
      "Close Assistant",
      "Ask the Assistant",
      "Working…",
      "Send",
      "New Conversation",
      "Clear Current Context",
      "Use suggestion in draft editor",
      "Could not open Humanity Union Assistant.",
      "Too many Assistant requests",
    ];
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of [
        "assistant.modal.closeAria",
        "assistant.modal.askLabel",
        "assistant.modal.working",
        "assistant.modal.send",
        "assistant.modal.newConversation",
        "assistant.modal.clearContext",
        "assistant.modal.useSuggestion",
        "assistant.messages.openFailed",
        "assistant.messages.rateLimited",
      ] as const) {
        const value = ieKey(loaded.messages, key);
        for (const marker of englishMarkers) {
          assert.notEqual(value, marker, `${locale} ${key} must not equal English "${marker}"`);
        }
      }
    }
  });

  it("active modal wires next-intl chrome keys; AI/API content stays data-bound", () => {
    const modal = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantModal.tsx",
    );
    assert.match(modal, /useTranslations\("initiativeExperience"\)/);
    assert.match(modal, /assistant\.modal\.title/);
    assert.match(modal, /assistant\.modal\.closeAria/);
    assert.match(modal, /assistant\.modal\.askPlaceholder/);
    assert.match(modal, /assistant\.modal\.send/);
    assert.match(modal, /assistant\.modal\.working/);
    assert.match(modal, /assistant\.modal\.useSuggestion/);
    assert.match(modal, /assistant\.messages\.appliedToDraft/);
    assert.match(modal, /author\.actions\.saveDraft/);
    assert.match(modal, /author\.actions\.preview/);
    assert.match(modal, /author\.actions\.publish/);

    assert.doesNotMatch(modal, />\s*Humanity Union Assistant\s*</);
    assert.doesNotMatch(modal, /"Close Assistant"/);
    assert.doesNotMatch(modal, /"Ask the Assistant"/);
    assert.doesNotMatch(modal, /"Working…"/);
    assert.doesNotMatch(modal, /"Use suggestion in draft editor"/);

    // AI / API / civic content rendered raw
    assert.match(modal, /\{turn\.text\}/);
    assert.match(modal, /\{suggestion\}/);
    assert.match(modal, /assistResult\.suggestions\.map/);
    assert.match(modal, /context\?\.currentFeatureLabel/);
    assert.match(modal, /context\.stageLabel/);
    assert.match(modal, /context\.initiativeTitle/);
    assert.match(modal, /context\.suggestedQuestions/);
    assert.doesNotMatch(modal, /t\(".*turn\.text/);
    assert.doesNotMatch(modal, /t\(".*suggestedText/);
    assert.doesNotMatch(modal, /t\(".*stageLabel/);
    assert.doesNotMatch(modal, /t\(".*currentFeatureLabel/);
  });

  it("OpenButton default label reuses author.sidebar.askAssistant", () => {
    const openButton = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantOpenButton.tsx",
    );
    assert.match(openButton, /useTranslations\("initiativeExperience"\)/);
    assert.match(openButton, /author\.sidebar\.askAssistant/);
    assert.doesNotMatch(openButton, /label = "Ask Assistant"/);
    assert.doesNotMatch(openButton, /"Ask Assistant"/);
  });

  it("LifecycleAiAssistantModal remains quarantined / unmounted from Initiative Experience", () => {
    const quarantine = readWeb("features/lifecycle-ai-assistant/QUARANTINE.md");
    const host = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantHost.tsx",
    );
    const sidebar = readWeb(
      "features/initiative-lifecycle-stage-workspace/components/InitiativeLifecycleWorkingSidebar.tsx",
    );
    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(quarantine, /LifecycleAiAssistantModal/);
    assert.match(host, /HumanityUnionAssistantModal/);
    assert.doesNotMatch(host, /LifecycleAiAssistantModal/);
    assert.doesNotMatch(sidebar, /LifecycleAiAssistantModal/);
    assert.doesNotMatch(center, /LifecycleAiAssistantModal/);
    assert.match(sidebar, /HumanityUnionAssistantOpenButton/);
  });

  it("prompt / provider / API contracts are unchanged", () => {
    const api = readWeb("features/humanity-union-assistant/api.ts");
    const modal = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantModal.tsx",
    );
    assert.match(api, /\/api\/v1\/assistant\/session-context/);
    assert.match(api, /\/api\/v1\/assistant\/assist/);
    assert.match(modal, /requestHumanityUnionAssistantAssist\(/);
    assert.match(modal, /getHumanityUnionAssistantSessionContext\(/);
    assert.doesNotMatch(modal, /systemPrompt/);
    assert.doesNotMatch(modal, /temperature/);
    assert.doesNotMatch(modal, /gemini/i);
    assert.doesNotMatch(api, /temperature/);
    assert.doesNotMatch(api, /gemini/i);
  });

  it("apply path keeps structured suggestions; no English apply-sentence contract", () => {
    const modal = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantModal.tsx",
    );
    assert.match(modal, /dispatchLifecycleAiApplySuggestions\(/);
    assert.match(modal, /suggestions:\s*result\.suggestions/);
    assert.doesNotMatch(modal, /Applied AI suggestions to:/);
    assert.doesNotMatch(modal, /Review before Save Draft/);
    assert.match(modal, /assistant\.messages\.appliedToDraft/);
    assert.match(modal, /assistant\.messages\.appliedToBlog/);
    assert.match(modal, /role="status"/);
  });

  it("no copy-to-clipboard chrome is mounted in the active Assistant modal", () => {
    const modal = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantModal.tsx",
    );
    assert.doesNotMatch(modal, /navigator\.clipboard/);
    assert.doesNotMatch(modal, /"Copy"/);
    assert.doesNotMatch(modal, /"Copied"/);
    assert.doesNotMatch(modal, /assistant\.modal\.copy/);
  });

  it("deterministic error fallbacks are localized; arbitrary Error.message is not sentence-translated", () => {
    const modal = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantModal.tsx",
    );
    assert.match(modal, /assistant\.messages\.openFailed/);
    assert.match(modal, /assistant\.messages\.rateLimited/);
    assert.match(modal, /assistant\.messages\.temporarilyUnavailable/);
    assert.match(modal, /assistant\.messages\.autoApplyForbidden/);
    // Existing safe-detail policy: some raw API messages remain as Error.message
    assert.match(modal, /setAssistError\(raw\)/);
    assert.match(modal, /error instanceof Error \? error\.message/);
    // No new English sentence-matching translation table
    assert.doesNotMatch(modal, /if \(raw === "/);
    assert.doesNotMatch(modal, /messageMap/);
  });

  it("dialog / Escape / focus / status semantics remain", () => {
    const modal = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantModal.tsx",
    );
    const context = readWeb("features/humanity-union-assistant/assistant-context.tsx");
    assert.match(modal, /role="dialog"/);
    assert.match(modal, /aria-modal="true"/);
    assert.match(modal, /aria-labelledby=\{titleId\}/);
    assert.match(modal, /aria-live="polite"/);
    assert.match(modal, /Escape/);
    assert.match(modal, /closeButtonRef/);
    assert.match(context, /returnFocusRef/);
    assert.match(context, /focusTarget\?\.focus/);
  });

  it("layout resilience markers for long labels / RTL-safe wrap", () => {
    const css = readWeb("features/humanity-union-assistant/humanity-union-assistant.css");
    assert.match(css, /\.hu-assistant-modal\s*\{[^}]*min-width:\s*0/s);
    assert.match(css, /\.hu-assistant-modal__header\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(css, /\.hu-assistant-modal__title\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(css, /\.hu-assistant-modal__body\s*\{[^}]*min-width:\s*0/s);
    assert.match(css, /\.hu-assistant-modal__actions\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(css, /\.hu-assistant-modal__bubble\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    assert.match(css, /\.hu-assistant-modal__conversation\s*\{[^}]*padding-inline-end:/s);
  });

  it("missing assistant.modal.title fails catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (
      uk.initiativeExperience as {
        assistant?: { modal?: { title?: string } };
      }
    ).assistant?.modal?.title;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) =>
        issue.path.includes("initiativeExperience.assistant.modal.title"),
      ),
    );
  });
});
