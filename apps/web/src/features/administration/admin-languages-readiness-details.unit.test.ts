/**
 * Admin Languages readiness details presentation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Admin Languages readiness details", () => {
  const section = read("features/administration/components/AdminLanguagesSection.tsx");
  const details = section.slice(
    section.indexOf("function LanguageReadinessDetails"),
    section.indexOf("export function AdminLanguagesSection"),
  );

  it("1–2. labels civic persisted content and still renders CT counts", () => {
    assert.match(details, /Civic persisted content/);
    assert.match(details, /Work remaining counts those records only/);
    assert.doesNotMatch(details, /Content translation<\/h4>/);
    assert.match(details, /report\.ct\.current/);
    assert.match(details, /report\.ct\.stale/);
    assert.match(details, /report\.ct\.missing/);
    assert.match(details, /report\.ct\.failed/);
    assert.match(details, /report\.ct\.workItemsRequired/);
    assert.match(details, /row\.ownership === "CT_OWNED"/);
    assert.match(details, /row\.kindId/);
    assert.match(section, /Blocked=/);
  });

  it("3–4. labels Civic Media presentation without overstating scope", () => {
    assert.match(details, /Civic Media presentation/);
    assert.match(details, /Public News remains source-original/);
    assert.match(details, /report\.plpMedia\.current/);
    assert.match(details, /report\.plpMedia\.workItemsRequired/);
    assert.doesNotMatch(details, /fact-check|propaganda|participant_public/);
  });

  it("5. renders controlled vocabulary counts", () => {
    assert.match(details, /Controlled Vocabulary/);
    assert.match(details, /report\.controlledVocabulary\.conceptsChecked/);
    assert.match(details, /report\.controlledVocabulary\.conceptsMissingLocalizedLabel/);
    assert.match(details, /report\.controlledVocabulary\.conceptsWithTerminologyPreferredTerm/);
    assert.match(details, /report\.controlledVocabulary\.conceptsWithWebUiFallbackOnly/);
    assert.match(details, /report\.controlledVocabulary\.presentationReady/);
  });

  it("6. labels the public catalog and keeps Step 13A metrics", () => {
    assert.match(details, /Public interface &amp; platform catalog/);
    assert.match(details, /report\.webUi\.requiredKeyCount/);
    assert.match(details, /report\.webUi\.missingKeyCount/);
    assert.match(details, /report\.webUi\.emptyKeyCount/);
    assert.match(details, /report\.webUi\.englishFallbackKeyCount/);
    assert.match(details, /report\.webUi\.dataReady/);
    assert.match(details, /Author and steward workspace/);
    assert.doesNotMatch(details, /isPublicReaderWebUiRequiredPath|collectStringPaths/);
    assert.match(details, /Overall presentation/);
    assert.match(details, /report\.state/);
    assert.match(details, /report\.state === "DATA_NOT_READY"/);
  });

  it("6b. labels the Participant interface catalog", () => {
    assert.match(details, /Participant interface/);
    assert.match(details, /report\.participantWebUi\.requiredKeyCount/);
    assert.match(details, /report\.participantWebUi\.missingKeyCount/);
    assert.match(details, /report\.participantWebUi\.emptyKeyCount/);
    assert.match(details, /report\.participantWebUi\.englishFallbackKeyCount/);
    assert.match(details, /report\.participantWebUi\.dataReady/);
    assert.match(details, /ordinary signed-in Participant surfaces/);
    assert.doesNotMatch(details, /isParticipantWebUiRequiredPath/);
  });

  it("7. shows persisted reading coverage even when the feature flag is disabled", () => {
    assert.match(details, /Persisted reading enabled/);
    assert.match(details, /report\.registry\.pwaPersistedReadingEnabled/);
    assert.match(details, /report\.pwaCivic\.pwaCivicReadinessStatus/);
    assert.match(details, /report\.pwaCivic\.coverage\.current/);
    assert.match(details, /report\.pwaCivic\.coverage\.missing/);
    assert.match(details, /report\.pwaCivic\.coverage\.workItemsRequired/);
    assert.doesNotMatch(details, /PWA civic|PWA persisted reading/);
    assert.doesNotMatch(
      details,
      /pwaPersistedReadingEnabled[\s\S]{0,80}return null/,
    );
  });

  it("8. lists every returned gap instead of the first two", () => {
    assert.match(details, /report\.gaps\.map/);
    assert.doesNotMatch(section, /gaps\.slice\(0,\s*2\)/);
  });

  it("9. keeps Search and SEO in separate sections", () => {
    assert.match(details, /<h4[^>]*>Search<\/h4>/);
    assert.match(details, /<h4[^>]*>SEO<\/h4>/);
    assert.match(details, /report\.registry\.searchEnabled/);
    assert.match(details, /report\.searchLocalizationReady/);
    assert.match(details, /report\.seoReady/);
    assert.match(details, /independent of the catalog/);
    assert.match(details, /independent of localization completeness/);
  });

  it("10. keeps Knowledge debt separate from civic work", () => {
    assert.match(details, /Knowledge/);
    assert.match(details, /NO_TRANSLATION_OWNER/);
    assert.match(details, /Article localization owner not implemented yet/);
    assert.match(details, /does not add civic work/);
    assert.match(details, /Does not block overall presentation/);
  });

  it("11. uses the same labels for every locale", () => {
    assert.doesNotMatch(details, /locale\s*===?\s*["'](?:ka|he|uk|ar|zh-Hant)["']/);
    assert.doesNotMatch(details, /\b(?:ka|he)\.json\b/);
  });

  it("10–11. Readiness click only fetches the existing report", () => {
    const readinessFn = section.slice(
      section.indexOf("async function handleCheckReadiness"),
      section.indexOf("async function handleActivateLocalization"),
    );
    assert.match(readinessFn, /fetchAdminLanguageLocalizationReadiness\(row\.languageId\)/);
    assert.doesNotMatch(readinessFn, /activateAdminLanguageLocalization|updateAdminLanguage|generateContentTranslation/);
    assert.doesNotMatch(details, /fetch\(|updateAdminLanguage|activateAdminLanguageLocalization/);
  });

  it("12. Actions column and Edit scroll from 482a4162 remain", () => {
    assert.match(section, /admin-languages__actions-col/);
    assert.match(section, /scrollIntoView\(\{\s*block:\s*"start"/);
    assert.match(section, /setEditingId\(row\.languageId\)/);
  });
});
