/**
 * Production Completion Pack 02B Task 05 — Admin Languages UI wiring tests.
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

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Production Completion Pack 02B Task 05 — Admin Languages UI", () => {
  it("adds Languages to Admin navigation and resolves the route", () => {
    assert.ok(ADMIN_PANEL_SECTIONS.some((section) => section.id === "languages"));
    assert.equal(resolveAdminPanelSectionId("/admin/languages"), "languages");
    assert.match(read("app/admin/languages/page.tsx"), /AdminAccessGate/);
    assert.match(read("app/admin/languages/page.tsx"), /AdminLanguagesSection/);
  });

  it("Languages UI uses Admin Registry APIs only — no providerMappings / hardcoded catalog", () => {
    const api = read("features/administration/admin-languages-api.ts");
    assert.match(api, /\/api\/v1\/admin\/languages/);
    assert.match(api, /method: "POST"/);
    assert.match(api, /method: "PATCH"/);
    assert.match(api, /invalidatePublicLanguagesClientCache/);
    assert.doesNotMatch(api, /providerMappings/);

    const section = read("features/administration/components/AdminLanguagesSection.tsx");
    assert.match(section, /fetchAdminLanguages|createAdminLanguage|updateAdminLanguage/);
    assert.match(section, /Add Language/);
    assert.match(section, /immutable/);
    assert.match(section, /English cannot be disabled/);
    assert.doesNotMatch(section, /PRIORITY_LANGUAGE_CATALOG|PRIORITY_LANGUAGE_CODES/);
    assert.doesNotMatch(section, /providerMappings/);
  });
});
