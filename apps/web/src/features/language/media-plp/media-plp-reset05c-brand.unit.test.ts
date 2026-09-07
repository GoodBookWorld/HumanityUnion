/**
 * RESET 05C Checkpoints 7–9 — Media FAQ Brand Localization authority closure.
 *
 * Fingerprint note: CIVIC_MEDIA_FAQ `{siteName}` tokens change civic_media_editorial
 * canonical fingerprint. Existing published editorial PLP snapshots need a later
 * rebuild (not in this pack — no materialize / Mongo writes).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  BRAND_SITE_NAME_MACHINE_SENTINEL,
  BRAND_SITE_NAME_TOKEN,
  CANONICAL_ENGLISH_BRAND_FALLBACK,
  LOCALIZATION_RESOLUTION_PRIORITY,
  PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY,
  composeBrandTokens,
  protectBrandTokensForMachineTranslation,
  restoreBrandTokensAfterMachineTranslation,
  splitBrandTokenParts,
  templateHasBrandSiteNameToken,
} from "@hu/types";

import { BrandTokenizedSemanticText } from "../../civic-media-center/components/BrandTokenizedSemanticText.js";
import {
  assertMediaSemanticCoverageComplete,
  MEDIA_SEMANTIC_INVENTORY,
  summarizeMediaSemanticCoverage,
} from "./media-semantic-inventory.js";
import {
  assertNoMediaFaqBrandSemanticGaps,
  evaluateMediaFaqBrandSemanticGaps,
} from "../plp-semantic-gap/index.js";

(globalThis as { React?: typeof React }).React = React;

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../../..");
const repoRoot = path.resolve(webSrc, "../../..");

function readRepo(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("RESET 05C — Media FAQ Brand Localization", () => {
  it("canonical FAQ prose uses {siteName} tokens (not English brand literals)", () => {
    const sections = readRepo(
      "apps/api/src/modules/civic-media-center/content/sections.ts",
    );
    assert.match(sections, /\{siteName\} curates sources/);
    assert.match(sections, /Can \{siteName\} recommend/);
    assert.match(sections, /Does \{siteName\} verify/);
    assert.match(sections, /No\. \{siteName\} recommends/);
    assert.doesNotMatch(
      sections,
      /CIVIC_MEDIA_FAQ[\s\S]*Humanity Union/,
    );
  });

  it("Brand-owned FAQ identity resolves through Brand Localization for any published locale", () => {
    const template = "Can {siteName} recommend new sources?";
    assert.equal(templateHasBrandSiteNameToken(template), true);

    const uk = composeBrandTokens(template, { siteName: "Союз Людяності" });
    assert.equal(uk, "Can Союз Людяності recommend new sources?");
    assert.doesNotMatch(uk, /Humanity Union|\{siteName\}/);

    const zh = composeBrandTokens(template, { siteName: "人道聯盟" });
    assert.equal(zh, "Can 人道聯盟 recommend new sources?");
    assert.doesNotMatch(zh, /Humanity Union|\{siteName\}/);

    const enFallback = composeBrandTokens(template, {
      siteName: CANONICAL_ENGLISH_BRAND_FALLBACK.siteName,
    });
    assert.equal(enFallback, "Can Humanity Union recommend new sources?");

    const parts = splitBrandTokenParts("No. {siteName} recommends organizations.");
    assert.deepEqual(
      parts.map((p) => (p.kind === "brand" ? p.token : p.text)),
      ["No. ", BRAND_SITE_NAME_TOKEN, " recommends organizations."],
    );
  });

  it("render path wraps Brand spans; PLP owns surrounding prose", () => {
    const html = renderToStaticMarkup(
      createElement(BrandTokenizedSemanticText, {
        as: "p",
        template: "No. {siteName} recommends organizations.",
        siteName: "人道聯盟",
        plpResult: "PUBLISHED_LOCALIZED",
        entityType: "civic_media_editorial",
        entityId: "civic-media-center",
        semanticPath: "faq[3].answer",
      }),
    );
    assert.match(html, /data-hu-semantic-owner="BRAND"/);
    assert.match(html, /data-hu-semantic-owner="PLP_ENTITY"/);
    assert.match(html, /人道聯盟/);
    assert.doesNotMatch(html, /Humanity Union|\{siteName\}/);

    const page = readWeb(
      "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
    );
    assert.match(page, /useLocalizedBrand/);
    assert.match(page, /BrandTokenizedSemanticText/);
  });

  it("legacy snapshots without tokens still render as PLP_ENTITY (no Brand split required)", () => {
    const html = renderToStaticMarkup(
      createElement(BrandTokenizedSemanticText, {
        as: "h3",
        template: "Can Humanity Union recommend new sources?",
        siteName: "Союз Людяності",
        plpResult: "CANONICAL_FALLBACK",
        entityType: "civic_media_editorial",
        entityId: "civic-media-center",
        semanticPath: "faq[2].question",
      }),
    );
    assert.match(html, /data-hu-semantic-owner="PLP_ENTITY"/);
    assert.doesNotMatch(html, /data-hu-semantic-owner="BRAND"/);
    assert.match(html, /Humanity Union/);
  });

  it("MACHINE cannot overwrite Brand authority (provenance + resolution priority)", () => {
    assert.ok(
      PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY.indexOf("BRAND_LOCALIZATION") <
        PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY.indexOf("MACHINE"),
    );
    assert.equal(LOCALIZATION_RESOLUTION_PRIORITY[0], "BRAND_LOCALIZATION");
    assert.ok(
      LOCALIZATION_RESOLUTION_PRIORITY.includes("CIVIC_CONTENT_CURRENT_MACHINE"),
    );
    assert.ok(
      LOCALIZATION_RESOLUTION_PRIORITY.indexOf("BRAND_LOCALIZATION") <
        LOCALIZATION_RESOLUTION_PRIORITY.indexOf("CIVIC_CONTENT_CURRENT_MACHINE"),
    );
  });

  it("machine translation preserve/restore keeps {siteName} (no Gemini brand teaching)", () => {
    const source = "Does {siteName} verify every article?";
    const protectedText = protectBrandTokensForMachineTranslation(source);
    assert.match(protectedText, new RegExp(BRAND_SITE_NAME_MACHINE_SENTINEL));
    assert.doesNotMatch(protectedText, /\{siteName\}/);

    // Simulated MACHINE output: translates prose, leaves sentinel.
    const machineOut = protectedText.replace(
      "Does",
      "Чи",
    );
    const restored = restoreBrandTokensAfterMachineTranslation(machineOut);
    assert.match(restored, /\{siteName\}/);
    assert.doesNotMatch(restored, /⟦HU_BRAND_SITE_NAME⟧/);
    assert.doesNotMatch(restored, /__HU_BRAND_SITE_NAME__/);

    const prompt = readRepo(
      "apps/api/src/modules/language/media-plp-materializer/thin-gemini-prompt.ts",
    );
    assert.match(prompt, /__HU_BRAND_SITE_NAME__/);
    assert.match(prompt, /Preserve structural Brand transport placeholders/);

    const boundary = readRepo(
      "apps/api/src/modules/language/media-plp-materializer/provider-boundary.ts",
    );
    assert.match(boundary, /protectBrandTokensForMachineTranslation/);
    assert.match(boundary, /restoreBrandTokensAfterMachineTranslation/);
  });

  it("no global Humanity Union string replacement in the Brand FAQ solution", () => {
    const solutionFiles = [
      "packages/types/src/domain/brand-token-composition.ts",
      "apps/web/src/features/civic-media-center/components/BrandTokenizedSemanticText.tsx",
      "apps/web/src/features/language/plp-semantic-gap/media-faq-brand-gap.ts",
      "apps/api/src/modules/language/media-plp-materializer/provider-boundary.ts",
    ];
    for (const file of solutionFiles) {
      const source = readRepo(file);
      assert.doesNotMatch(
        source,
        /replaceAll\(\s*["']Humanity Union["']/,
        `${file} must not globally replace Humanity Union`,
      );
      assert.doesNotMatch(
        source,
        /\.replace\(\s*\/Humanity Union/,
        `${file} must not regex-replace Humanity Union`,
      );
    }
  });

  it("Media semantic-gap detects Brand bypass on FAQ when mis-owned", () => {
    const bypassHtml = `
      <main>
        <section id="faq" class="civic-media-page__faq">
          <div class="civic-media-resource-card">
            <h3 data-hu-semantic-owner="PLP_ENTITY">Does Humanity Union verify every article?</h3>
            <p data-hu-semantic-owner="PLP_ENTITY">No. Humanity Union recommends organizations.</p>
          </div>
        </section>
      </main>`;

    const ukBypass = evaluateMediaFaqBrandSemanticGaps({
      html: bypassHtml,
      locale: "uk",
      brandSiteName: "Союз Людяності",
    });
    assert.equal(ukBypass.ok, false);
    assert.ok(ukBypass.findings.some((f) => f.kind === "MEDIA_FAQ_BRAND_BYPASS"));

    const zhBypass = evaluateMediaFaqBrandSemanticGaps({
      html: bypassHtml,
      locale: "zh-Hant",
      brandSiteName: "人道聯盟",
    });
    assert.equal(zhBypass.ok, false);

    const ownedHtml = `
      <main>
        <section id="faq" class="civic-media-page__faq">
          <div class="civic-media-resource-card">
            <h3>
              <span data-hu-semantic-owner="PLP_ENTITY">Does </span>
              <span data-hu-semantic-owner="BRAND">Союз Людяності</span>
              <span data-hu-semantic-owner="PLP_ENTITY"> verify every article?</span>
            </h3>
          </div>
        </section>
      </main>`;
    const owned = evaluateMediaFaqBrandSemanticGaps({
      html: ownedHtml,
      locale: "uk",
      brandSiteName: "Союз Людяності",
    });
    assertNoMediaFaqBrandSemanticGaps(owned);

    // English Brand equal to canonical — do not flag English FAQ identity.
    const enOk = evaluateMediaFaqBrandSemanticGaps({
      html: bypassHtml,
      locale: "en",
      brandSiteName: "Humanity Union",
    });
    assert.equal(enOk.ok, true);

    // External outlet name matching words must not false-positive outside FAQ cards
    // when FAQ is correctly Brand-owned (English brand only inside stripped BRAND nodes).
    const externalOk = evaluateMediaFaqBrandSemanticGaps({
      html: `
        <main>
          <div class="civic-media-resource-card--verification">
            <h3>Humanity Union Press Agency</h3>
          </div>
          <section id="faq">
            <div class="civic-media-resource-card">
              <span data-hu-semantic-owner="BRAND">人道聯盟</span>
            </div>
          </section>
        </main>`,
      locale: "zh-Hant",
      brandSiteName: "人道聯盟",
    });
    assert.equal(externalOk.ok, true);
  });

  it("FAQ inventory includes BRAND fields; metaTitle uses {siteName} + Brand metadata", () => {
    const report = assertMediaSemanticCoverageComplete();
    assert.ok(report.BRAND_FIELDS >= 2, `expected BRAND_FIELDS>=2, got ${report.BRAND_FIELDS}`);
    assert.ok(
      MEDIA_SEMANTIC_INVENTORY.some(
        (f) => f.id === "faq.brand.siteName" && f.owner === "BRAND",
      ),
    );
    assert.equal(summarizeMediaSemanticCoverage().BRAND_FIELDS, report.BRAND_FIELDS);

    const en = readWeb("features/i18n/messages/en.json");
    assert.match(en, /"metaTitle":\s*"Civic Media \| \{siteName\}"/);
    const mediaPage = readWeb("app/media/page.tsx");
    assert.match(mediaPage, /resolveBrandForMetadata/);
    assert.match(mediaPage, /t\("metaTitle",\s*siteName\)/);
  });

  it("documents editorial fingerprint impact (rebuild later — no materialize in this pack)", () => {
    const sections = readRepo(
      "apps/api/src/modules/civic-media-center/content/sections.ts",
    );
    assert.match(sections, /\{siteName\}/);
    assert.match(sections, /rebuilt/i);
  });
});
