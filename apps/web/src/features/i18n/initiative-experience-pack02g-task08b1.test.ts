/**
 * Pack 02G Task 08B.1 — Initiative Experience shared chrome i18n.
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
import {
  loadUiMessagesForLocale,
  resolveMergedMessage,
} from "../i18n/load-ui-messages.js";
import {
  ACTIVITY_AREA_MESSAGE_KEY_BY_VALUE,
  formatInitiativeExperienceDate,
  formatInitiativeExperienceLanguageName,
  listActivityAreaValuesForI18n,
  listPublicLifecycleStageIdsForI18n,
  resolveActivityAreaDisplayLabel,
  resolveInitiativeExperienceMessage,
  resolveInitiativeStatusDisplayLabel,
  resolveLifecyclePhaseDisplayLabel,
  resolveLifecycleStageDisplayLabel,
  resolveLifecycleStateDisplayLabel,
} from "../public-initiative-experience/initiative-experience-i18n.js";
import { INITIATIVE_LIFECYCLE_PHASE_LABELS, PUBLIC_INITIATIVE_EXPERIENCE_STAGES } from "@hu/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("Pack 02G Task 08B.1 — Initiative Experience shared chrome i18n", () => {
  it("bundled catalog parity remains green including initiativeExperience", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    const en = await loadUiMessagesForLocale("en");
    const uk = await loadUiMessagesForLocale("uk");
    assert.ok(en.messages.initiativeExperience);
    assert.ok(uk.messages.initiativeExperience);
    assert.equal(
      resolveInitiativeExperienceMessage(en.messages, "tabs.manage"),
      "Manage",
    );
    assert.equal(
      resolveInitiativeExperienceMessage(uk.messages, "tabs.manage"),
      "Керування",
    );
  });

  it("Ukrainian shared chrome strings resolve for tabs/hero/lifecycle/translation", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(resolveInitiativeExperienceMessage(uk.messages, "tabs.overview"), "Огляд");
    assert.equal(
      resolveInitiativeExperienceMessage(uk.messages, "hero.activityArea"),
      "Сфера діяльності",
    );
    assert.equal(
      resolveInitiativeExperienceMessage(uk.messages, "lifecycle.title"),
      "Життєвий цикл",
    );
    assert.equal(
      resolveInitiativeExperienceMessage(uk.messages, "translation.machineTranslated"),
      "Машинний переклад",
    );
    assert.equal(
      resolveInitiativeExperienceMessage(uk.messages, "translation.viewOriginal"),
      "Переглянути оригінал",
    );
  });

  it("stage/state/phase display localization uses codes without mutating English registries", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    for (const stageId of listPublicLifecycleStageIdsForI18n()) {
      const label = resolveLifecycleStageDisplayLabel(stageId, uk.messages);
      assert.ok(label.length > 0, stageId);
      assert.notEqual(label, stageId);
    }
    assert.equal(
      resolveLifecycleStateDisplayLabel("not_started", uk.messages),
      "Не розпочато",
    );
    assert.equal(resolveLifecyclePhaseDisplayLabel("draft", uk.messages), "Чернетка");

    // Canonical English registry values unchanged.
    assert.equal(INITIATIVE_LIFECYCLE_PHASE_LABELS.draft, "Draft");
    assert.equal(
      PUBLIC_INITIATIVE_EXPERIENCE_STAGES.find((s) => s.stageId === "petition")?.label,
      "Petition",
    );
  });

  it("activity-area display localization maps stored English values", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    for (const value of listActivityAreaValuesForI18n()) {
      assert.ok(ACTIVITY_AREA_MESSAGE_KEY_BY_VALUE[value]);
      const localized = resolveActivityAreaDisplayLabel(value, uk.messages);
      assert.ok(localized.length > 0);
      if (value === "Public Health") {
        assert.equal(localized, "Громадське здоров'я");
      }
    }
    // Unknown custom "Other" free text stays unchanged.
    assert.equal(resolveActivityAreaDisplayLabel("Custom Area Text", uk.messages), "Custom Area Text");
  });

  it("status display localization and English canonical status codes remain stable", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(resolveInitiativeStatusDisplayLabel("proposal", uk.messages), "Пропозиція");
    assert.equal(resolveInitiativeStatusDisplayLabel("proposal", (await loadUiMessagesForLocale("en")).messages), "Proposal");
  });

  it("locale-aware date formatting uses the interface locale", () => {
    const iso = "2024-06-15T12:00:00.000Z";
    const en = formatInitiativeExperienceDate("en", iso);
    const uk = formatInitiativeExperienceDate("uk", iso);
    assert.match(en, /2024/);
    assert.match(uk, /2024/);
    // Month names should differ across locales for long month style.
    assert.notEqual(en, uk);
  });

  it("language display names prefer human-readable forms over raw codes", () => {
    const ukName = formatInitiativeExperienceLanguageName("en", "uk");
    assert.match(ukName.toLowerCase(), /ukrain/);
    const native = formatInitiativeExperienceLanguageName("uk", "uk");
    assert.ok(native.length > 2);
    assert.notEqual(native, "uk");
  });

  it("translation chrome consolidation and i18n wiring are present in source", () => {
    const hero = readWeb(
      "features/public-initiative-experience/components/PublicExperienceHero.tsx",
    );
    const view = readWeb("features/language/components/TranslatedContentView.tsx");
    const nav = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeLifecycleNav.tsx",
    );
    assert.match(hero, /TranslatedContentSharedChrome/);
    assert.match(hero, /chrome="body"/);
    assert.match(view, /translation\.machineTranslated/);
    assert.match(view, /TranslatedContentSharedChrome/);
    assert.match(nav, /resolveLifecycleStageDisplayLabel/);
    assert.match(nav, /resolveLifecycleStateDisplayLabel/);
    assert.doesNotMatch(nav, /stage\.stateLabel\}/);
  });

  it("accessible names use initiativeExperience messages in shared shell components", () => {
    const layout = readWeb(
      "features/public-initiative-experience/components/PublicCivicRecordExperienceLayout.tsx",
    );
    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    const loader = readWeb(
      "features/public-initiative-experience/components/CanonicalInitiativeExperienceLoader.tsx",
    );
    assert.match(layout, /common\.lifecycleStagesAria/);
    assert.match(center, /common\.initiativeContentAria/);
    assert.match(loader, /common\.loadingExperience/);
    assert.doesNotMatch(layout, /aria-label="Lifecycle stages"/);
    assert.doesNotMatch(center, /aria-label="Initiative content"/);
  });

  it("missing initiativeExperience key fails raw catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone((await import("../i18n/messages/uk.json", { with: { type: "json" } })).default);
    delete (uk.initiativeExperience as { tabs?: { manage?: string } }).tabs?.manage;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.path.includes("initiativeExperience.tabs.manage")));
  });

  it("workspace shell parity helper still green (02E regression)", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true);
    const en = await loadUiMessagesForLocale("en");
    assert.equal(resolveMergedMessage(en.messages, "workspace", "profile"), "Profile");
  });
});
