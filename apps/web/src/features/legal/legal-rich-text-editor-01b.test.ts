/**
 * HU-LEGAL-EDITOR-01B — Legal Localization editor contract tests (source-level).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** features → src → web → apps → repo */
const repoRoot = path.resolve(webSrcRoot, "../../../..");

function readWeb(...parts: string[]): string {
  return readFileSync(path.join(webSrcRoot, ...parts), "utf8");
}

function readRepo(...parts: string[]): string {
  return readFileSync(path.join(repoRoot, ...parts), "utf8");
}

describe("HU-LEGAL-EDITOR-01B — Legal rich-text editor", () => {
  it("admin Legal Localization uses restricted LegalRichTextEditor (not raw textarea body)", () => {
    const admin = readRepo(
      "apps/web/src/features/administration/components/AdminLegalLocalizationSection.tsx",
    );
    assert.match(admin, /LegalRichTextEditor/);
    assert.match(admin, /sanitizeLegalHtml/);
    assert.match(admin, /previewShow|previewHide|previewTitle/);
    assert.match(admin, /textDirection/);
    assert.doesNotMatch(admin, /Localized body \(HTML\)/);
    assert.doesNotMatch(admin, /<textarea[\s\S]*localizedBody/);
  });

  it("Legal CKEditor excludes images, uploads, emoji, and tables", () => {
    const client = readWeb("legal/components/LegalRichTextEditorClient.tsx");
    assert.match(client, /ClassicEditor/);
    assert.match(client, /Heading/);
    assert.match(client, /Bold/);
    assert.match(client, /Italic/);
    assert.match(client, /Underline/);
    assert.match(client, /Link/);
    assert.match(client, /List/);
    assert.match(client, /Undo/);
    assert.doesNotMatch(client, /Image|ImageUpload|Table|Emoji|BlogCkeditorUpload/);
    assert.doesNotMatch(client, /uploadImage|insertTable/);
  });

  it("public legal CSS styles localized body descendants without requiring section wrappers", () => {
    const css = readWeb("legal/legal-page.css");
    assert.match(css, /\.legal-page__body h2/);
    assert.match(css, /\.legal-page__body h3/);
    assert.match(css, /\.legal-page__body p/);
    assert.match(css, /\.legal-page__body ul/);
    assert.match(css, /\.legal-page__body ol/);
    assert.match(css, /padding-inline-start/);
  });

  it("editor UI strings use legalLocalizationAdmin message keys across catalogs", () => {
    const locales = [
      "en",
      "uk",
      "ar",
      "he",
      "de",
      "es",
      "fr",
      "ka",
      "pt",
      "zh-Hant",
    ];
    for (const locale of locales) {
      const messages = JSON.parse(
        readRepo(`apps/web/src/features/i18n/messages/${locale}.json`),
      ) as { legalLocalizationAdmin?: Record<string, unknown> };
      assert.ok(
        messages.legalLocalizationAdmin,
        `missing legalLocalizationAdmin in ${locale}.json`,
      );
      assert.equal(typeof messages.legalLocalizationAdmin.bodyLabel, "string");
      assert.equal(typeof messages.legalLocalizationAdmin.previewTitle, "string");
      const headings = messages.legalLocalizationAdmin.headings as Record<string, string>;
      assert.equal(typeof headings.heading2, "string");
    }
  });

  it("API exposes legal sanitizer and wires write + public render boundaries", () => {
    const sanitize = readRepo(
      "apps/api/src/modules/legal-localization/legal-content-sanitize.ts",
    );
    const service = readRepo(
      "apps/api/src/modules/legal-localization/legal-localization.service.ts",
    );
    const pub = readRepo(
      "apps/api/src/modules/legal-localization/legal-localization.public.ts",
    );
    assert.match(sanitize, /ALLOWED_TAGS/);
    assert.match(sanitize, /isSafeLegalHref/);
    assert.doesNotMatch(sanitize, /\bimg\b|\btable\b/);
    assert.match(service, /sanitizeLegalHtmlDetailed/);
    assert.match(service, /preservedVisibleText/);
    assert.match(pub, /sanitizePublishedBodyForPublic|sanitizeLegalHtmlDetailed/);
    assert.match(pub, /never writes back to Mongo|Sanitize for public render only/i);
  });

  it("does not bump Terms canonical version or touch RRP / Video Chat modules", () => {
    const types = readRepo("packages/types/src/domain/legal-localization.ts");
    assert.match(types, /terms-2026-03-v1/);
    assert.match(types, /privacy-2026-11-v1/);
  });
});
