/**
 * Production Completion Pack 02F Task 04 — Admin Terminology Glossary UI tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADMIN_PANEL_SECTIONS,
  resolveAdminPanelSectionId,
} from "../administration/admin-panel-sections";
import {
  buildTerminologyRemoveLocalePatch,
  buildTerminologySavePatch,
} from "../administration/admin-terminology-glossary-patch";
import { resolveGlossaryEditorScrollBehavior } from "../administration/admin-terminology-glossary-scroll";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Production Completion Pack 02F Task 04 — Admin Terminology Glossary UI", () => {
  it("adds Terminology Glossary to Admin navigation and resolves the route", () => {
    assert.ok(ADMIN_PANEL_SECTIONS.some((section) => section.id === "terminology-glossary"));
    assert.equal(
      resolveAdminPanelSectionId("/admin/terminology-glossary"),
      "terminology-glossary",
    );
    assert.equal(resolveAdminPanelSectionId("/admin/languages"), "languages");
    assert.match(read("app/admin/terminology-glossary/page.tsx"), /AdminAccessGate/);
    assert.match(
      read("app/admin/terminology-glossary/page.tsx"),
      /AdminTerminologyGlossarySection/,
    );
  });

  it("list loads seeded concepts via Admin glossary API", () => {
    const api = read("features/administration/admin-terminology-glossary-api.ts");
    assert.match(api, /\/api\/v1\/admin\/terminology-glossary/);
    assert.match(api, /fetchAdminTerminologyGlossary/);
    assert.match(api, /method: "PATCH"/);
    assert.doesNotMatch(api, /method: "POST"/);
    assert.doesNotMatch(api, /method: "DELETE"/);

    const section = read(
      "features/administration/components/AdminTerminologyGlossarySection.tsx",
    );
    assert.match(section, /fetchAdminTerminologyGlossary/);
    assert.match(section, /canonicalEnglishTerm/);
    assert.match(section, /coverageSummary|Coverage/);
    assert.match(section, /updatedAt/);
  });

  it("conceptId / category / English canonical term are read-only and no create/delete controls", () => {
    const section = read(
      "features/administration/components/AdminTerminologyGlossarySection.tsx",
    );
    assert.match(section, /data-readonly="conceptId"/);
    assert.match(section, /data-readonly="canonicalEnglishTerm"/);
    assert.match(section, /data-readonly="category"/);
    assert.match(section, /data-readonly="linkedRefs"/);
    assert.doesNotMatch(section, /Add Concept|Create concept|Delete concept/i);
    assert.doesNotMatch(section, /method:\s*"POST"|method:\s*"DELETE"/);
  });

  it("Registry locales populate editor; disabled locale remains editable but visibly disabled", () => {
    const section = read(
      "features/administration/components/AdminTerminologyGlossarySection.tsx",
    );
    assert.match(section, /fetchAdminLanguages/);
    assert.match(section, /data-locale-editor/);
    assert.match(section, /data-registry-enabled/);
    assert.match(section, /admin-glossary__locale-card--disabled/);
    assert.match(section, /Registry: \{language\.enabled \? "enabled" : "disabled"\}/);
    assert.match(section, /[Gg]lossary translations may\s+still be edited/);
    assert.match(section, /Language enablement is managed only under/);
    assert.doesNotMatch(section, /updateAdminLanguage/);
  });

  it("edit one locale PATCHes without replacing others; zh-Hant is canonical", () => {
    const section = read(
      "features/administration/components/AdminTerminologyGlossarySection.tsx",
    );
    const patch = read("features/administration/admin-terminology-glossary-patch.ts");
    assert.match(section, /buildTerminologySavePatch/);
    assert.match(section, /updateAdminTerminologyConcept/);
    assert.match(patch, /translationsPatch\[language\.locale\]/);
    assert.match(section, /Canonical locale/);
    assert.doesNotMatch(section, /zh-TW/);
    assert.match(section, /Not Language Registry locale aliases/);
  });

  it("aliases / guidance / status editable; backend validation error surfaced", () => {
    const section = read(
      "features/administration/components/AdminTerminologyGlossarySection.tsx",
    );
    assert.match(section, /data-editable="status"/);
    assert.match(section, /data-editable="preferredTerm"/);
    assert.match(section, /data-editable="aliases"/);
    assert.match(section, /data-editable="guidance"/);
    assert.match(section, /formatAuthFormError/);
    assert.match(section, /StatusBanner/);
    assert.match(section, /Saving…|Save concept/);
  });

  it("Participant/Member/Membership distinction help appears", () => {
    const section = read(
      "features/administration/components/AdminTerminologyGlossarySection.tsx",
    );
    assert.match(section, /data-help="participant-member-membership"/);
    assert.match(section, /Keep Participant \/ Member \/ Membership distinct/);
    assert.match(section, /A Participant is not necessarily a Member/);
  });

  it("workflow stage note / linkedRefs presentation is non-editable", () => {
    const section = read(
      "features/administration/components/AdminTerminologyGlossarySection.tsx",
    );
    assert.match(section, /data-help="workflow-stage"/);
    assert.match(section, /Lifecycle structure, stage ordering/);
    assert.match(section, /data-readonly="linkedRefs"/);
    assert.match(section, /data-help="brand"/);
    assert.match(section, /constrained brand terminology/);
  });

  it("successful save refreshes state; no provider/search side effects", () => {
    const section = read(
      "features/administration/components/AdminTerminologyGlossarySection.tsx",
    );
    assert.match(section, /setConcepts\(\(current\) =>/);
    assert.match(section, /openConcept\(updated\)/);
    assert.match(section, /Terminology concept saved/);
    assert.doesNotMatch(section, /resolveTranslationProvider|Gemini|global-search|searchPublic/);
  });

  it("concept selection scrolls editor into view; save/filter/refresh do not re-request it", () => {
    const section = read(
      "features/administration/components/AdminTerminologyGlossarySection.tsx",
    );
    const scrollHelper = read(
      "features/administration/admin-terminology-glossary-scroll.ts",
    );
    assert.match(section, /resolveGlossaryEditorScrollBehavior/);
    assert.match(section, /admin-terminology-glossary-scroll/);
    assert.match(section, /editorScrollRequestId/);
    assert.match(section, /editorRef/);
    assert.match(section, /data-glossary-editor/);
    assert.match(section, /openConcept\(concept,\s*\{\s*scrollIntoView:\s*true\s*\}\)/);
    assert.match(section, /prefers-reduced-motion:\s*reduce/);
    assert.match(
      section,
      /resolveGlossaryEditorScrollBehavior\(prefersReducedMotion\)/,
    );
    // Save path reopens without requesting scroll.
    assert.match(section, /openConcept\(updated\);/);
    assert.doesNotMatch(section, /openConcept\(updated,\s*\{\s*scrollIntoView/);
    // Scroll request is only declared + bumped inside openConcept({ scrollIntoView: true }).
    assert.equal((section.match(/setEditorScrollRequestId/g) ?? []).length, 2);
    assert.match(
      section,
      /if \(options\?\.scrollIntoView === true\) \{\s*setEditorScrollRequestId\(\(current\) => current \+ 1\);/,
    );

    assert.match(scrollHelper, /prefersReducedMotion \? "auto" : "smooth"/);
    assert.equal(resolveGlossaryEditorScrollBehavior(true), "auto");
    assert.equal(resolveGlossaryEditorScrollBehavior(false), "smooth");
  });

  it("clearing preferredTerm is rejected without inventing delete semantics; save pending reconciles", () => {
    const section = read(
      "features/administration/components/AdminTerminologyGlossarySection.tsx",
    );
    const patch = read("features/administration/admin-terminology-glossary-patch.ts");
    assert.match(patch, /Preferred term for \$\{language\.locale\} cannot be cleared/);
    assert.match(patch, /requires a preferredTerm/);
    assert.match(patch, /English remains the runtime fallback/);
    assert.match(section, /buildTerminologySavePatch/);
    assert.match(section, /if \(!selected \|\| saving \|\| removingLocale\)/);
    assert.match(section, /setSaving\(true\)/);
    assert.match(section, /Saving…/);
    assert.match(section, /data-glossary-save/);
    assert.match(section, /data-glossary-save-error/);
    assert.match(section, /openConcept\(updated\)/);
    assert.match(section, /formatAuthFormError\(saveError\)/);
    // No silent locale-key deletion via blank preferredTerm.
    assert.doesNotMatch(section, /delete translations\[|translationsPatch\[.+\].*=\s*null/);
    const saveFn = patch.slice(
      patch.indexOf("export function buildTerminologySavePatch"),
      patch.length,
    );
    assert.doesNotMatch(saveFn, /removeTranslationLocales/);
    // Scroll request still only on table select.
    assert.doesNotMatch(section, /openConcept\(updated,\s*\{\s*scrollIntoView/);
  });

  it("explicit Remove translation deletes stored locale via removeTranslationLocales", () => {
    const section = read(
      "features/administration/components/AdminTerminologyGlossarySection.tsx",
    );
    const api = read("features/administration/admin-terminology-glossary-api.ts");
    const patch = read("features/administration/admin-terminology-glossary-patch.ts");
    assert.match(section, /Remove translation/);
    assert.match(section, /Removing…/);
    assert.match(section, /handleRemoveLocaleTranslation/);
    assert.match(section, /buildTerminologyRemoveLocalePatch\(locale\)/);
    assert.match(section, /buildTerminologySavePatch/);
    assert.match(section, /data-glossary-remove-locale/);
    assert.match(section, /data-has-stored-translation/);
    assert.match(section, /window\.confirm/);
    assert.match(section, /hasStoredTranslation \?/);
    assert.match(api, /TerminologyConceptUpdateInput/);
    assert.match(patch, /removeTranslationLocales:\s*\[locale\]/);
    // Remove builder must not emit translations.
    const removeFn = patch.slice(
      patch.indexOf("export function buildTerminologyRemoveLocalePatch"),
      patch.indexOf("export type GlossarySavePatchBuildResult"),
    );
    assert.doesNotMatch(removeFn, /translations/);
    // Empty preferredTerm path remains validation-only (not removal).
    assert.match(patch, /cannot be cleared/);
    assert.match(patch, /Remove translation/);
  });

  it("Remove wire payload is removeTranslationLocales only; Save blank preferredTerm rejected", () => {
    const removePayload = buildTerminologyRemoveLocalePatch("uk");
    assert.deepEqual(removePayload, { removeTranslationLocales: ["uk"] });
    assert.equal("translations" in removePayload, false);
    assert.equal(JSON.stringify(removePayload).includes("preferredTerm"), false);

    const blankSave = buildTerminologySavePatch({
      languages: [{ locale: "uk" }],
      localeDrafts: {
        uk: { preferredTerm: "", aliasesText: "", guidance: "" },
      },
      baselineLocales: {
        uk: { preferredTerm: "Учасник", aliasesText: "", guidance: "" },
      },
      statusDraft: "published",
      baselineStatus: "published",
    });
    assert.equal(blankSave.ok, false);
    if (!blankSave.ok) {
      assert.match(blankSave.error, /cannot be cleared/);
      assert.match(blankSave.error, /Remove translation/);
    }

    // Save builder must never emit removeTranslationLocales.
    const validSave = buildTerminologySavePatch({
      languages: [{ locale: "uk" }],
      localeDrafts: {
        uk: { preferredTerm: "Учасник", aliasesText: "учасниця", guidance: "" },
      },
      baselineLocales: {
        uk: { preferredTerm: "Учасник", aliasesText: "", guidance: "" },
      },
      statusDraft: "published",
      baselineStatus: "published",
    });
    assert.equal(validSave.ok, true);
    if (validSave.ok && validSave.patch) {
      assert.equal("removeTranslationLocales" in validSave.patch, false);
      assert.equal(validSave.patch.translations?.uk?.preferredTerm, "Учасник");
    }
  });

  it("existing Admin Languages UI remains unchanged in contract", () => {
    const languagesPage = read("app/admin/languages/page.tsx");
    assert.match(languagesPage, /AdminLanguagesSection/);
    assert.doesNotMatch(languagesPage, /TerminologyGlossary/);

    const languagesSection = read(
      "features/administration/components/AdminLanguagesSection.tsx",
    );
    assert.match(languagesSection, /fetchAdminLanguages/);
    assert.match(languagesSection, /Add Language/);
    assert.doesNotMatch(languagesSection, /terminology-glossary|TerminologyGlossary/);

    assert.equal(resolveAdminPanelSectionId("/admin/languages"), "languages");
  });
});
