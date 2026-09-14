/**
 * Pack 08I.5 — Legal Localization web wiring + resolve fallback.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADMIN_PANEL_SECTIONS,
  resolveAdminPanelSectionId,
} from "../administration/admin-panel-sections";
import {
  APPROVED_LOCALIZED_LEGAL_BODIES,
  EXPECTED_LEGAL_FALLBACK,
  resolveLegalDocumentPresentation,
} from "./resolve-legal-document-presentation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const repoRoot = path.resolve(webSrc, "../../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readRepo(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

/** Strip block/line comments so negative import scans ignore documentation mentions. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("Pack 08I.5 — Legal Localization web", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = (async () => {
      throw new Error("network unavailable in unit test");
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("Admin legal-localization surface exists after brand-localization", () => {
    assert.ok(ADMIN_PANEL_SECTIONS.some((section) => section.id === "legal-localization"));
    assert.equal(
      resolveAdminPanelSectionId("/admin/legal-localization"),
      "legal-localization",
    );

    const brandIndex = ADMIN_PANEL_SECTIONS.findIndex((s) => s.id === "brand-localization");
    const legalIndex = ADMIN_PANEL_SECTIONS.findIndex((s) => s.id === "legal-localization");
    const glossaryIndex = ADMIN_PANEL_SECTIONS.findIndex(
      (s) => s.id === "terminology-glossary",
    );
    assert.ok(brandIndex >= 0 && legalIndex === brandIndex + 1 && glossaryIndex === legalIndex + 1);

    assert.match(readWeb("app/admin/legal-localization/page.tsx"), /AdminAccessGate/);
    assert.match(
      readWeb("app/admin/legal-localization/page.tsx"),
      /AdminLegalLocalizationSection/,
    );
    assert.match(
      readWeb("features/administration/admin-legal-localization-api.ts"),
      /\/api\/v1\/admin\/legal-localization/,
    );
    assert.match(
      readWeb("features/administration/components/AdminLegalLocalizationSection.tsx"),
      /counsel-approved|Never machine-translated|English remains/i,
    );
    assert.match(
      readWeb("features/administration/components/AdminPlatformSection.tsx"),
      /\/admin\/legal-localization/,
    );
  });

  it("API public and admin routes are mounted (mechanism residual 0)", () => {
    const app = readRepo("apps/api/src/app.ts");
    assert.match(app, /\/api\/v1\/legal-localization/);
    assert.match(app, /\/api\/v1\/admin\/legal-localization/);
    assert.match(app, /publicLegalLocalizationRouter/);
    assert.match(app, /adminLegalLocalizationRouter/);
  });

  it("approved localized legal bodies map stays empty (no fabricated translations)", () => {
    assert.deepEqual(APPROVED_LOCALIZED_LEGAL_BODIES, {});
    assert.equal(Object.keys(APPROVED_LOCALIZED_LEGAL_BODIES).length, 0);
  });

  it("resolver falls back when no published body (fetch failure → expected_legal_fallback)", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      for (const documentId of ["privacy", "terms"] as const) {
        const presentation = await resolveLegalDocumentPresentation(locale, documentId);
        assert.equal(presentation.body.source, EXPECTED_LEGAL_FALLBACK);
        assert.equal(presentation.body.localizedBodyHtml, null);
        assert.equal(typeof presentation.chrome.title, "string");
        assert.ok(presentation.chrome.title.length > 0);
      }
    }
  });

  it("legal resolve path never uses Gemini / TranslationProvider / content_translations", () => {
    const presentation = readWeb("features/legal/resolve-legal-document-presentation.ts");
    const bodyHelper = readWeb("features/legal/resolve-localized-legal-body.ts");
    const adminSection = readWeb(
      "features/administration/components/AdminLegalLocalizationSection.tsx",
    );
    const adminApi = readWeb("features/administration/admin-legal-localization-api.ts");

    for (const source of [presentation, bodyHelper, adminSection, adminApi]) {
      const code = withoutComments(source);
      assert.doesNotMatch(code, /generateContentTranslation/);
      assert.doesNotMatch(code, /from\s+["'][^"']*gemini/i);
      assert.doesNotMatch(code, /TranslationProvider/);
      assert.doesNotMatch(code, /content_translations|content-translation/);
      assert.doesNotMatch(code, /providerId:\s*["']gemini["']/);
      assert.doesNotMatch(code, /google_cloud|deepl/);
    }

    assert.match(bodyHelper, /\/api\/v1\/legal-localization/);
    assert.match(bodyHelper, /expected_legal_fallback/);
    assert.match(presentation, /resolveLocalizedLegalBody/);
    assert.match(presentation, /Do NOT call Gemini/);
  });
});
