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

  it("1–2. renders CT totals and CT kindRows with counts", () => {
    assert.match(details, /report\.ct\.current/);
    assert.match(details, /report\.ct\.stale/);
    assert.match(details, /report\.ct\.missing/);
    assert.match(details, /report\.ct\.workItemsRequired/);
    assert.match(details, /row\.ownership === "CT_OWNED"/);
    assert.match(details, /row\.kindId/);
    assert.match(details, /row\.counts!\.current|counts\.current/);
  });

  it("3–4. renders PLP totals without overstating scope", () => {
    assert.match(details, /report\.plpMedia\.current/);
    assert.match(details, /report\.plpMedia\.workItemsRequired/);
    assert.match(details, /Civic Media PLP \(measured editorial coverage\)/);
    assert.doesNotMatch(details, /fact-check|propaganda|participant_public/);
  });

  it("5. renders controlled vocabulary counts", () => {
    assert.match(details, /report\.controlledVocabulary\.conceptsChecked/);
    assert.match(details, /report\.controlledVocabulary\.conceptsMissingLocalizedLabel/);
    assert.match(details, /report\.controlledVocabulary\.conceptsWithTerminologyPreferredTerm/);
    assert.match(details, /report\.controlledVocabulary\.conceptsWithWebUiFallbackOnly/);
    assert.match(details, /report\.controlledVocabulary\.presentationReady/);
  });

  it("6. renders WEB_UI counts and keeps Extended Localization separate", () => {
    assert.match(details, /report\.webUi\.missingKeyCount/);
    assert.match(details, /report\.webUi\.emptyKeyCount/);
    assert.match(details, /report\.webUi\.englishFallbackKeyCount/);
    assert.match(details, /report\.webUi\.dataReady/);
    assert.match(details, /report\.state/);
    assert.match(
      details,
      /Extended Localization readiness is separate from Unified Persisted Reading/,
    );
  });

  it("7. shows PWA coverage even when the persisted-reading gate is disabled", () => {
    assert.match(details, /report\.registry\.pwaPersistedReadingEnabled/);
    assert.match(details, /report\.pwaCivic\.pwaCivicReadinessStatus/);
    assert.match(details, /report\.pwaCivic\.coverage\.current/);
    assert.match(details, /report\.pwaCivic\.coverage\.missing/);
    assert.match(details, /report\.pwaCivic\.coverage\.workItemsRequired/);
    assert.doesNotMatch(
      details,
      /pwaPersistedReadingEnabled[\s\S]{0,80}return null/,
    );
  });

  it("8. lists every returned gap instead of the first two", () => {
    assert.match(details, /report\.gaps\.map/);
    assert.doesNotMatch(section, /gaps\.slice\(0,\s*2\)/);
  });

  it("9. keeps Search and SEO in their own section", () => {
    assert.match(details, /Search \/ SEO/);
    assert.match(details, /report\.registry\.searchEnabled/);
    assert.match(details, /report\.searchLocalizationReady/);
    assert.match(details, /report\.seoReady/);
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
