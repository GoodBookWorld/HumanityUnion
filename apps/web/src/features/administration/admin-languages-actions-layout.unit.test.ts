/**
 * Admin Languages actions column + Edit form viewport.
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

describe("Admin Languages actions layout", () => {
  it("1–2. ACTIONS column has a stable width and does not break labels per character", () => {
    const css = read("features/administration/components/admin-languages.css");
    assert.match(css, /admin-languages__actions-col[\s\S]*min-width:\s*12\.5rem/);
    assert.match(css, /\.admin-languages__row-actions\s*\{[^}]*flex-direction:\s*column/s);
    assert.match(
      css,
      /\.admin-languages__row-actions \.hu-button\s*\{[^}]*overflow-wrap:\s*normal/s,
    );
    assert.match(css, /\.admin-languages__row-actions \.hu-button\s*\{[^}]*word-break:\s*normal/s);
    assert.doesNotMatch(css, /admin-languages__row-actions[\s\S]*overflow-wrap:\s*anywhere/);
    assert.doesNotMatch(css, /admin-languages__actions-col[\s\S]*word-break:\s*break-all/);
  });

  it("3–6. Edit selects the row, opens the same form, and scrolls it into view", () => {
    const section = read("features/administration/components/AdminLanguagesSection.tsx");
    assert.match(section, /function openEdit\(row: LanguageRegistryAdmin\)/);
    assert.match(section, /setEditingId\(row\.languageId\)/);
    assert.match(section, /setForm\(toForm\(row\)\)/);
    assert.match(section, /editingId \? "Edit language"/);
    assert.match(section, /ref=\{formRef\}/);
    assert.match(section, /scrollIntoView\(\{\s*block:\s*"start"/);
    assert.match(section, /useLayoutEffect\(\(\) => \{[\s\S]*editingId/);
    assert.equal((section.match(/aria-label=\{editingId \? "Edit language"/g) ?? []).length, 1);
  });

  it("7. PWA persisted reading stays bound to the selected row, not forced on", () => {
    const section = read("features/administration/components/AdminLanguagesSection.tsx");
    assert.match(section, /pwaPersistedReadingEnabled:\s*row\.pwaPersistedReadingEnabled/);
    assert.match(section, /checked=\{form\.pwaPersistedReadingEnabled\}/);
    assert.doesNotMatch(section, /pwaPersistedReadingEnabled:\s*true/);
  });

  it("8. Readiness still uses the authenticated read-only endpoint", () => {
    const section = read("features/administration/components/AdminLanguagesSection.tsx");
    const api = read("features/administration/admin-languages-api.ts");
    const readinessFn = section.slice(
      section.indexOf("async function handleCheckReadiness"),
      section.indexOf("async function handleActivateLocalization"),
    );
    assert.match(readinessFn, /fetchAdminLanguageLocalizationReadiness\(row\.languageId\)/);
    assert.match(api, /\/localization-readiness/);
    assert.doesNotMatch(readinessFn, /activateAdminLanguageLocalization/);
  });

  it("alias field placeholder is example text, not a stored Georgian alias list", () => {
    const section = read("features/administration/components/AdminLanguagesSection.tsx");
    assert.match(section, /placeholder="zh-TW, zh-HK"/);
    assert.match(section, /aliasesText:\s*row\.aliases\.join\(", "\)/);
  });
});
