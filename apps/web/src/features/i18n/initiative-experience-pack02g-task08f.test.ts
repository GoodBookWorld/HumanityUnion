/**
 * Pack 02G Task 08F — Assistant entry + PUBLIC_CHOICE intake + geography residuals.
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
  resolvePublicChoiceElectionVotingStatusDisplayLabel,
} from "../public-initiative-experience/initiative-experience-i18n.js";
import { assistantWidgetCopyKey } from "../humanity-union-assistant/resolve-assistant-surface.js";

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

const ASSISTANT_ENTRY_KEYS = [
  "assistant.entry.title",
  "assistant.entry.openAria",
  "assistant.entry.askAssistant",
  "assistant.entry.openAssistant",
  "assistant.entry.shortLabel",
  "assistant.entry.preferencesLauncher",
  "assistant.entry.widgetCopy.workspace",
  "assistant.entry.widgetCopy.initiatives",
  "assistant.entry.widgetCopy.commitment",
  "assistant.entry.widgetCopy.notifications",
  "assistant.entry.widgetCopy.messages",
  "assistant.entry.widgetCopy.preferences",
  "assistant.entry.widgetCopy.profile",
  "assistant.entry.widgetCopy.blog",
  "assistant.entry.widgetCopy.default",
] as const;

const GEOGRAPHY_KEYS = [
  "geography.world",
  "geography.country",
  "geography.region",
  "geography.community",
  "geography.navigatorAria",
  "geography.exploreByPlace",
  "geography.approximateLocationAria",
  "geography.approximateLocation",
  "geography.approximateLocationSummary",
  "geography.resolvingApproximateLocation",
] as const;

const INTAKE_SAMPLE_KEYS = [
  "publicChoice.candidateIntake.title",
  "publicChoice.candidateIntake.lead",
  "publicChoice.candidateIntake.select",
  "publicChoice.candidateIntake.recall",
  "publicChoice.candidateIntake.addCandidateCta",
  "publicChoice.candidateIntake.electionStatus",
  "publicChoice.candidateSubmit.addTitle",
  "publicChoice.candidateSubmit.nameLabel",
  "publicChoice.candidateSubmit.deleteConfirmTitle",
] as const;

describe("Pack 02G Task 08F — Assistant entry / PC intake / geography", () => {
  it("catalog parity includes assistant.entry, geography, candidateIntake/Submit", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of [...ASSISTANT_ENTRY_KEYS, ...GEOGRAPHY_KEYS, ...INTAKE_SAMPLE_KEYS]) {
        assert.equal(typeof ieKey(loaded.messages, key), "string");
      }
    }

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });

  it("Ukrainian Assistant entry / PC intake / geography resolve without English leftovers", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.doesNotMatch(ieKey(uk.messages, "assistant.entry.openAria"), /Open Humanity/);
    assert.doesNotMatch(ieKey(uk.messages, "assistant.entry.askAssistant"), /Ask Assistant/);
    assert.doesNotMatch(ieKey(uk.messages, "geography.world"), /^World$/);
    assert.doesNotMatch(ieKey(uk.messages, "publicChoice.candidateIntake.select"), /^Select$/);
    assert.match(ieKey(uk.messages, "publicChoice.candidateIntake.title"), /Кандидат/i);
  });

  it("Ukrainian Public Impact stage terminology uses громадський вплив", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const stage = ieKey(uk.messages, "stages.public_impact");
    assert.match(stage, /Громадський вплив/i);
    assert.doesNotMatch(stage, /публічний вплив/i);

    const blob = JSON.stringify(
      (uk.messages as { initiativeExperience?: Record<string, unknown> }).initiativeExperience ??
        {},
    );
    assert.doesNotMatch(blob, /публічний вплив/i);
    assert.doesNotMatch(blob, /Публічний вплив/);
  });

  it("widget copy keys map surfaces; English catalog matches legacy blurbs", async () => {
    const en = await loadUiMessagesForLocale("en");
    assert.equal(
      ieKey(en.messages, assistantWidgetCopyKey("workspace")),
      "I can help you understand your Workspace, priorities, notifications and next civic actions.",
    );
    assert.equal(
      ieKey(en.messages, assistantWidgetCopyKey("blog")),
      "I can explain the Blog publishing workflow, authorship, and categories — I never publish for you.",
    );
  });

  it("mounted Assistant entry surfaces use catalog keys", () => {
    const fab = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantFloatingButton.tsx",
    );
    assert.match(fab, /assistant\.entry\.openAria/);
    assert.match(fab, /assistant\.entry\.title/);
    assert.doesNotMatch(fab, /aria-label="Open Humanity Union Assistant"/);

    const widget = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantWidget.tsx",
    );
    assert.match(widget, /assistantWidgetCopyKey/);
    assert.match(widget, /assistant\.entry\.askAssistant/);
    assert.doesNotMatch(widget, />\s*Ask Assistant\s*</);

    const surface = readWeb(
      "features/humanity-union-assistant/components/SurfaceAssistantEntry.tsx",
    );
    assert.match(surface, /assistant\.entry\.openAssistant/);
    assert.doesNotMatch(surface, /label = "Open Humanity Union Assistant"/);

    const preferences = readWeb("features/preferences/components/PreferencesWorkspace.tsx");
    assert.match(preferences, /assistant\.entry\.preferencesLauncher/);
    assert.doesNotMatch(preferences, /Ask Humanity Union Assistant about Preferences"/);

    const pwa = readWeb("features/pwa/components/PwaBottomNav.tsx");
    assert.match(pwa, /assistant\.entry\.openAria/);
    assert.match(pwa, /assistant\.entry\.shortLabel/);
    assert.doesNotMatch(pwa, /aria-label="Open Humanity Union Assistant"/);
  });

  it("PUBLIC_CHOICE intake uses display resolver and catalog chrome", () => {
    const intake = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(intake, /useTranslations\("initiativeExperience"\)/);
    assert.match(intake, /resolvePublicChoiceElectionVotingStatusDisplayLabel/);
    assert.match(intake, /publicChoice\.candidateIntake\./);
    assert.doesNotMatch(intake, /publicChoiceElectionVotingStatusLabel/);
    assert.doesNotMatch(intake, /"Loading candidates…"/);
    assert.doesNotMatch(intake, />\s*Candidates\s*</);
    assert.doesNotMatch(intake, />\s*Select\s*</);

    const submit = readWeb(
      "features/public-choice-candidate/components/PublicChoiceCandidateSubmitPanel.tsx",
    );
    assert.match(submit, /publicChoice\.candidateSubmit\./);
    assert.doesNotMatch(submit, />\s*Add a candidate\s*</);
    assert.doesNotMatch(submit, />\s*Submit candidate\s*</);
  });

  it("geography World is display-only localized", () => {
    const navigator = readWeb(
      "features/global-experience/components/GeographicNavigator.tsx",
    );
    assert.match(navigator, /geography\.world/);
    assert.doesNotMatch(navigator, />\s*World\s*</);

    const approx = readWeb(
      "features/public-home-v2/components/ApproximateIpGeographicNavigator.tsx",
    );
    assert.match(approx, /geography\.world/);
    assert.doesNotMatch(approx, /label: "World"/);
  });

  it("status display resolver still maps OPEN for intake reuse", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    const t = (key: string) => ieKey(uk.messages, key);
    assert.equal(resolvePublicChoiceElectionVotingStatusDisplayLabel("OPEN", t), "Відкрито");
  });
});
