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
    assert.match(section, /translationsPatch\[language\.locale\]/);
    assert.match(section, /updateAdminTerminologyConcept/);
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
