/**
 * Pack 02G Task 08B.2 — Initiative Manage form UI localization.
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
  listActivityAreaValuesForI18n,
  resolveActivityAreaDisplayLabel,
  resolveInitiativeExperienceMessage,
} from "../public-initiative-experience/initiative-experience-i18n.js";
import { INITIATIVE_ACTIVITY_AREA_OPTIONS } from "../initiatives/initiative-activity-areas.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function manageKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, `manage.${key}`);
  assert.ok(value, `missing manage.${key}`);
  return value;
}

describe("Pack 02G Task 08B.2 — Initiative Manage form i18n", () => {
  it("catalog parity en/uk/zh-Hant/ar includes initiativeExperience.manage", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.ok(loaded.messages.initiativeExperience);
      assert.equal(
        typeof resolveInitiativeExperienceMessage(loaded.messages, "manage.title"),
        "string",
      );
      assert.equal(
        typeof resolveInitiativeExperienceMessage(loaded.messages, "manage.cover.chooseImage"),
        "string",
      );
    }
  });

  it("Ukrainian Manage labels and actions resolve natively", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(manageKey(uk.messages, "title"), "Керування ініціативою");
    assert.equal(manageKey(uk.messages, "backToWorkspace"), "Назад до ініціатив робочого простору");
    assert.equal(manageKey(uk.messages, "fields.title"), "Назва");
    assert.equal(manageKey(uk.messages, "fields.shortDescription"), "Короткий опис");
    assert.equal(manageKey(uk.messages, "actions.saveDraft"), "Зберегти чернетку");
    assert.equal(manageKey(uk.messages, "actions.publish"), "Опублікувати ініціативу");
    assert.equal(manageKey(uk.messages, "actions.update"), "Оновити");
    assert.equal(manageKey(uk.messages, "actions.republish"), "Переопублікувати");
    assert.equal(manageKey(uk.messages, "actions.archive"), "В архів");
    assert.equal(manageKey(uk.messages, "actions.deleteDraft"), "Видалити чернетку");
    assert.equal(manageKey(uk.messages, "cover.chooseImage"), "Вибрати зображення");
    assert.equal(manageKey(uk.messages, "cover.removeMedia"), "Видалити медіа");
  });

  it("draft and published editor paths wire manage.* keys", () => {
    const draft = readWeb("features/initiatives/components/InitiativeDraftEditor.tsx");
    const published = readWeb("features/initiatives/components/InitiativePublishedEditor.tsx");
    const panel = readWeb(
      "features/initiative-owner-studio/components/InitiativeOwnerManagePanel.tsx",
    );

    assert.match(draft, /useTranslations\("initiativeExperience"\)/);
    assert.match(draft, /manage\.actions\.publish/);
    assert.match(draft, /manage\.actions\.saveDraft/);
    assert.match(draft, /manage\.actions\.archive/);
    assert.match(draft, /manage\.danger\.deleteConfirmTitle/);
    assert.match(draft, /manage\.messages\.draftSaved/);
    assert.match(draft, /manage\.messages\.deleteForbidden/);
    assert.doesNotMatch(draft, />Publish Initiative</);
    assert.doesNotMatch(draft, />Save Draft</);

    assert.match(published, /useTranslations\("initiativeExperience"\)/);
    assert.match(published, /manage\.actions\.update/);
    assert.match(published, /manage\.actions\.republish/);
    assert.match(published, /manage\.election\.confirmTitle/);
    assert.doesNotMatch(published, />Update</);
    assert.doesNotMatch(published, />Republish</);

    assert.match(panel, /manage\.title/);
    assert.match(panel, /manage\.backToWorkspace/);
  });

  it("canonical authoring values stay bound to form state (not translated catalogs)", () => {
    const draft = readWeb("features/initiatives/components/InitiativeDraftEditor.tsx");
    const published = readWeb("features/initiatives/components/InitiativePublishedEditor.tsx");
    const fields = readWeb("features/initiatives/components/InitiativeFormFields.tsx");

    assert.match(draft, /value=\{form\.title\}/);
    assert.match(draft, /value=\{form\.description\}/);
    assert.match(published, /value=\{form\.title\}/);
    assert.match(published, /value=\{form\.description\}/);
    assert.match(fields, /value=\{values\.communityAssociation\}/);
    assert.match(fields, /value=\{values\.activityArea\}/);
    assert.match(fields, /value=\{values\.participationScope\}/);
    // Labels come from catalogs; civic field values do not.
    assert.doesNotMatch(draft, /value=\{t\(/);
    assert.doesNotMatch(published, /value=\{t\(/);
  });

  it("select display labels localize while option values stay canonical English codes", async () => {
    const fields = readWeb("features/initiatives/components/InitiativeFormFields.tsx");
    assert.match(fields, /option value="community"/);
    assert.match(fields, /option value="region"/);
    assert.match(fields, /option value="country"/);
    assert.match(fields, /option value="world"/);
    assert.match(fields, /t\("manage\.scopes\.community"\)/);
    assert.match(fields, /t\("manage\.scopes\.world"\)/);
    assert.match(fields, /resolveActivityAreaDisplayLabel\(option, t\)/);
    assert.match(fields, /key=\{option\}\s+value=\{option\}/);

    const uk = await loadUiMessagesForLocale("uk");
    for (const value of listActivityAreaValuesForI18n()) {
      const localized = resolveActivityAreaDisplayLabel(value, uk.messages);
      assert.ok(localized.length > 0);
      assert.ok(INITIATIVE_ACTIVITY_AREA_OPTIONS.includes(value));
    }
    assert.equal(
      resolveActivityAreaDisplayLabel("Public Health", uk.messages),
      "Громадське здоров'я",
    );
    assert.equal(
      resolveInitiativeExperienceMessage(uk.messages, "manage.scopes.community"),
      "Спільнота",
    );
  });

  it("client-owned validation/success messages use manage.messages; arbitrary detail is interpolated", () => {
    const draft = readWeb("features/initiatives/components/InitiativeDraftEditor.tsx");
    const published = readWeb("features/initiatives/components/InitiativePublishedEditor.tsx");
    const cover = readWeb("features/media-upload/components/InitiativeCoverMediaField.tsx");

    assert.match(draft, /manage\.messages\.saveFailed/);
    assert.match(draft, /manage\.messages\.publishFailed/);
    assert.match(draft, /manage\.messages\.deleteConflict/);
    assert.match(draft, /detailFromError/);
    assert.match(published, /manage\.messages\.updateFailed/);
    assert.match(published, /manage\.messages\.republishFailed/);
    assert.match(cover, /manage\.cover\.imageUploadFailed/);
    // No brittle English sentence matching for translation.
    assert.doesNotMatch(draft, /message === "/);
    assert.doesNotMatch(published, /includes\("Initiative updated/);
  });

  it("cover-media chrome and accessible names are localized", () => {
    const cover = readWeb("features/media-upload/components/InitiativeCoverMediaField.tsx");
    assert.match(cover, /useTranslations\("initiativeExperience"\)/);
    assert.match(cover, /manage\.cover\.chooseImage/);
    assert.match(cover, /manage\.cover\.removeMedia/);
    assert.match(cover, /manage\.cover\.cropInstructions/);
    assert.match(cover, /manage\.cover\.chooseImageFileAria/);
    assert.match(cover, /manage\.cover\.cropAria/);
    assert.match(cover, /aria-label=\{t\("manage\.cover\.playPreview"\)\}/);
    assert.doesNotMatch(cover, />Choose Image</);
    assert.doesNotMatch(cover, />Remove Media</);
    assert.doesNotMatch(cover, /aria-label="Choose an image file"/);
  });

  it("layout-sensitive action rows allow wrapping (no fixed English text widths)", () => {
    const editorCss = readWeb("features/initiatives/components/initiative-draft-editor.css");
    const coverCss = readWeb("features/media-upload/components/initiative-cover-media-field.css");
    assert.match(editorCss, /flex-wrap:\s*wrap/);
    assert.match(editorCss, /white-space:\s*normal/);
    assert.match(editorCss, /margin-inline-start:\s*auto/);
    assert.match(coverCss, /flex-wrap:\s*wrap/);
    assert.match(coverCss, /white-space:\s*normal/);
    assert.doesNotMatch(editorCss, /width:\s*\d+ch/);
    assert.doesNotMatch(editorCss, /min-width:\s*\d+rem/);
  });

  it("no runtime Gemini / machine UI translation for Manage chrome", () => {
    const panel = readWeb(
      "features/initiative-owner-studio/components/InitiativeOwnerManagePanel.tsx",
    );
    const draft = readWeb("features/initiatives/components/InitiativeDraftEditor.tsx");
    const published = readWeb("features/initiatives/components/InitiativePublishedEditor.tsx");
    const fields = readWeb("features/initiatives/components/InitiativeFormFields.tsx");
    const cover = readWeb("features/media-upload/components/InitiativeCoverMediaField.tsx");
    for (const source of [panel, draft, published, fields, cover]) {
      assert.doesNotMatch(source, /gemini/i);
      assert.doesNotMatch(source, /translateUi/i);
      assert.doesNotMatch(source, /machineTranslat/i);
      assert.match(source, /useTranslations\("initiativeExperience"\)|manage\./);
    }
  });

  it("missing manage key fails raw catalog parity", async () => {
    const en = await import("../i18n/messages/en.json", { with: { type: "json" } });
    const uk = structuredClone(
      (await import("../i18n/messages/uk.json", { with: { type: "json" } })).default,
    );
    delete (uk.initiativeExperience as { manage?: { title?: string } }).manage?.title;
    const report = compareCatalogParityToEnglish(en.default, uk, "uk");
    assert.equal(report.ok, false);
    assert.ok(
      report.issues.some((issue) => issue.path.includes("initiativeExperience.manage.title")),
    );
  });

  it("Ukrainian geography empty/loading/fallback labels resolve; canonical IDs stay English", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(
      manageKey(uk.messages, "geography.loadingCities"),
      "Завантаження міст і спільнот…",
    );
    assert.equal(
      manageKey(uk.messages, "geography.selectCountryFirst"),
      "Спочатку виберіть країну.",
    );
    assert.equal(
      manageKey(uk.messages, "geography.otherNotListed"),
      "Інше / Не в списку",
    );
    assert.equal(
      manageKey(uk.messages, "geography.noCityMatches"),
      "Не знайдено відповідних міст або спільнот.",
    );
    assert.match(manageKey(uk.messages, "geography.citiesAvailable"), /\{count\}/);

    const { OTHER_REGION_SLUG, OTHER_COMMUNITY_SLUG } = await import("@hu/geography");
    assert.equal(OTHER_REGION_SLUG, "other-not-listed");
    assert.equal(OTHER_COMMUNITY_SLUG, "other-not-listed");

    const region = readWeb("features/geography-integrity/RegionSelect.tsx");
    const city = readWeb("features/geography-integrity/CitySelect.tsx");
    assert.match(region, /OTHER_REGION_SLUG/);
    assert.match(region, /manage\.geography\.otherNotListed/);
    assert.match(city, /OTHER_COMMUNITY_SLUG/);
    assert.match(city, /manage\.geography\.otherNotListed/);
    assert.match(city, /manage\.geography\.loadingCities/);
    // Display-only remap; slug/value contracts unchanged.
    assert.match(region, /option\.slug === OTHER_REGION_SLUG/);
    assert.match(city, /option\.slug === OTHER_COMMUNITY_SLUG/);
  });

  it("Ukrainian View* loading/empty states use manage.links catalog", async () => {
    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(
      manageKey(uk.messages, "links.collaborativeAnalysisLoading"),
      "Завантаження спільного аналізу…",
    );
    assert.equal(
      manageKey(uk.messages, "links.collaborativeAnalysisEmptyTitle"),
      "Спільний аналіз ще не створено.",
    );
    assert.equal(
      manageKey(uk.messages, "links.collectiveDecisionLoading"),
      "Завантаження колективного рішення…",
    );
    assert.equal(
      manageKey(uk.messages, "links.petitionLoading"),
      "Завантаження петиції…",
    );
    assert.equal(
      manageKey(uk.messages, "links.petitionEmptyTitle"),
      "Пов’язаної петиції немає.",
    );

    const analysis = readWeb("features/initiatives/components/ViewCollaborativeAnalysisLink.tsx");
    const decision = readWeb(
      "features/collective-decision/components/ViewCollectiveDecisionLink.tsx",
    );
    const petition = readWeb("features/petition/components/ViewPetitionLink.tsx");
    for (const source of [analysis, decision, petition]) {
      assert.match(source, /useTranslations\("initiativeExperience"\)/);
      assert.doesNotMatch(source, /title="No /);
      assert.doesNotMatch(source, /message="Loading /);
    }
    assert.match(analysis, /manage\.links\.collaborativeAnalysisLoading/);
    assert.match(decision, /manage\.links\.collectiveDecisionEmptyTitle/);
    assert.match(petition, /manage\.links\.petitionUnavailableTitle/);
  });
});
