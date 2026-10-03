/**
 * TG.02 — single-language Terminology Glossary editor selection.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  formatGlossaryLanguageOptionLabel,
  resolveGlossaryEditorLocale,
} from "./admin-terminology-glossary-locale";
import { buildTerminologySavePatch } from "./admin-terminology-glossary-patch";

const sectionPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "components/AdminTerminologyGlossarySection.tsx",
);

function sectionSource(): string {
  return readFileSync(sectionPath, "utf8");
}

function functionBody(source: string, name: string, nextName: string): string {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`);
  assert.ok(start >= 0 && end > start, `${name} body not found`);
  return source.slice(start, end);
}

describe("TG.02 terminology glossary single-language editor", () => {
  it("formats registry options and collapses identical English and native names", () => {
    assert.equal(
      formatGlossaryLanguageOptionLabel({
        englishName: "Spanish",
        nativeName: "Español",
        locale: "es",
      }),
      "Spanish — Español (es)",
    );
    assert.equal(
      formatGlossaryLanguageOptionLabel({
        englishName: "Ukrainian",
        nativeName: "Українська",
        locale: "uk",
      }),
      "Ukrainian — Українська (uk)",
    );
    assert.equal(
      formatGlossaryLanguageOptionLabel({
        englishName: "English",
        nativeName: "English",
        locale: "en",
      }),
      "English (en)",
    );
  });

  it("defaults to the first registry language and keeps a still-present selection", () => {
    const languages = [{ locale: "uk" }, { locale: "es" }, { locale: "he" }];
    assert.equal(
      resolveGlossaryEditorLocale({ languages, selectedLocale: null }),
      "uk",
    );
    assert.equal(
      resolveGlossaryEditorLocale({ languages, selectedLocale: "es" }),
      "es",
    );
    assert.equal(
      resolveGlossaryEditorLocale({ languages, selectedLocale: "missing" }),
      "uk",
    );
    assert.equal(
      resolveGlossaryEditorLocale({ languages: [], selectedLocale: "es" }),
      null,
    );
  });

  it("renders one selected locale card from the loaded registry list", () => {
    const section = sectionSource();
    assert.match(section, /fetchAdminLanguages/);
    assert.match(section, /data-glossary-language-select/);
    assert.match(section, /formatGlossaryLanguageOptionLabel\(registryLanguage\)/);
    assert.match(section, /htmlFor=\{languageSelectId\}/);
    assert.match(section, /const language = activeLanguage/);
    assert.equal(section.match(/data-locale=\{language\.locale\}/g)?.length, 1);
    assert.doesNotMatch(section, /languages\.map\(\(language\)/);
    assert.match(section, /data-glossary-language-empty/);
    assert.match(section, /No registry languages are available/);
  });

  it("keeps the selected language across concepts and Close, without touching drafts", () => {
    const section = sectionSource();
    assert.match(section, /setSelectedGlossaryLocale\(event\.target\.value\)/);
    const openConcept = functionBody(section, "openConcept", "closeEditor");
    const closeEditor = functionBody(section, "closeEditor", "updateLocaleDraft");
    assert.doesNotMatch(openConcept, /setSelectedGlossaryLocale/);
    assert.doesNotMatch(openConcept, /setLocaleDrafts\(\{\}\)/);
    assert.doesNotMatch(closeEditor, /setSelectedGlossaryLocale/);
    const selectBlock = section.slice(
      section.indexOf("admin-glossary__language-row"),
      section.indexOf("data-glossary-language-empty"),
    );
    assert.match(selectBlock, /setSelectedGlossaryLocale\(event\.target\.value\)/);
    assert.doesNotMatch(selectBlock, /setLocaleDrafts|updateLocaleDraft|handleSave/);
  });

  it("Save still submits every dirty locale held in memory", () => {
    const section = sectionSource();
    const save = functionBody(section, "handleSave", "handleRemoveLocaleTranslation");
    assert.match(save, /buildTerminologySavePatch\(\{\s*languages,/);
    assert.doesNotMatch(save, /activeLanguage|activeGlossaryLocale|selectedGlossaryLocale/);

    const built = buildTerminologySavePatch({
      languages: [{ locale: "es" }, { locale: "uk" }],
      localeDrafts: {
        es: { preferredTerm: "Participante", aliasesText: "", guidance: "" },
        uk: { preferredTerm: "Учасник", aliasesText: "учасниця", guidance: "" },
      },
      baselineLocales: {
        es: { preferredTerm: "", aliasesText: "", guidance: "" },
        uk: { preferredTerm: "", aliasesText: "", guidance: "" },
      },
      statusDraft: "published",
      baselineStatus: "published",
    });
    assert.equal(built.ok, true);
    if (built.ok && built.patch) {
      assert.equal(built.patch.translations?.es?.preferredTerm, "Participante");
      assert.equal(built.patch.translations?.uk?.preferredTerm, "Учасник");
      assert.deepEqual(built.patch.translations?.uk?.aliases, ["учасниця"]);
    }
  });
});
