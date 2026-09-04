/**
 * Pack 08I.7 — Civic Media generate-on-miss, principles, pipeline stages, trusted categories.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  PRINCIPLE_WHY_IT_MATTERS_IDS,
  TRUSTED_MEDIA_CATEGORY_IDS,
} from "./civic-media-card-utils.js";
import { CIVIC_PIPELINE_STAGES } from "./civic-pipeline-workflow.stages.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readNested(messages: Record<string, unknown>, dottedPath: string): string {
  const parts = dottedPath.split(".");
  let cursor: unknown = messages;
  for (const part of parts) {
    assert.ok(cursor && typeof cursor === "object" && !Array.isArray(cursor), dottedPath);
    cursor = (cursor as Record<string, unknown>)[part];
  }
  assert.equal(typeof cursor, "string", dottedPath);
  return cursor as string;
}

describe("Pack 08I.7 — Civic Media residual localization", () => {
  it("useCivicMediaResolvedEditorial generates when preferred + original miss + not stale", () => {
    const editorial = readWeb(
      "features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
    );
    assert.match(editorial, /generateContentTranslation/);
    assert.match(editorial, /resolvePublicContentDisplayLanguage/);
    assert.match(editorial, /language:\s*displayLanguage/);
    assert.match(editorial, /targetLanguage:\s*displayLanguage/);
    assert.match(editorial, /shouldAttemptOnDemandContentTranslation/);
    assert.match(editorial, /resolved\.activeLanguage !== displayLanguage/);
    assert.match(editorial, /sourceKind:\s*"civic_media"/);
    assert.doesNotMatch(editorial, /JSON\.stringify/);
  });

  it("EXISTING current civic_media translation → structured editorial/faq/workflow presentation", () => {
    const page = readWeb(
      "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
    );
    const editorial = readWeb(
      "features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
    );
    const pipeline = readWeb(
      "features/civic-media-center/components/CivicPipelineWorkflow.tsx",
    );
    const hux = readWeb("features/horizontal-experience/HuxSection.tsx");
    const shell = readWeb(
      "features/civic-media-center/media-rail/CivicMediaSectionShell.tsx",
    );

    assert.match(page, /civic-media-page__editorial/);
    assert.match(page, /civic-media-page__faq/);
    assert.match(page, /useCivicMediaResolvedEditorial/);
    assert.match(page, /CivicPipelineWorkflow/);
    assert.match(page, /editorial\.initiativeFlow\.stages/);
    assert.match(page, /stageTitles=\{/);
    assert.match(page, /layout="three-two-one"/);
    assert.match(page, /editorial\.trustedExplanationsById\[resource\.id\]/);
    assert.match(editorial, /overlayCivicMediaEditorialFromFields/);
    assert.match(editorial, /resolveTranslatedContent/);
    assert.match(editorial, /if \(resolved\.presentationMode === "original"\)/);
    assert.match(editorial, /setEditorial\(/);
    assert.match(pipeline, /HuxWorkflowSection/);
    assert.match(hux, /horizontal-section-shell__content/);
    assert.match(shell, /horizontal-section-shell__content/);
    assert.doesNotMatch(page, /JSON\.stringify/);
    assert.doesNotMatch(editorial, /JSON\.stringify/);
  });

  it("PrincipleCard / pipeline / trusted categories use civicMediaPublic catalogs", () => {
    const page = readWeb(
      "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
    );
    const pipeline = readWeb(
      "features/civic-media-center/components/CivicPipelineWorkflow.tsx",
    );
    const rail = readWeb(
      "features/civic-media-center/components/TrustedMediaRailCard.tsx",
    );
    const tabs = readWeb(
      "features/civic-media-center/components/TrustedMediaCategoryTabs.tsx",
    );

    assert.match(page, /PRINCIPLE_WHY_IT_MATTERS_IDS/);
    assert.match(page, /principles\.\$\{principle\.id\}\.whyItMatters/);
    assert.doesNotMatch(page, /PRINCIPLE_WHY_IT_MATTERS\[/);

    assert.match(pipeline, /stages\.\$\{stage\.id\}\.description/);
    assert.match(pipeline, /stages\.\$\{stage\.id\}\.title/);
    assert.match(pipeline, /stageTitles/);

    assert.match(rail, /trustedCategories/);
    assert.match(rail, /useTranslations\("civicMediaPublic"\)/);
    assert.match(rail, /explanation \?\? resource\.explanation/);
    assert.doesNotMatch(rail, /TRUSTED_MEDIA_CATEGORY_LABELS/);
    // Identity: resource.name is never replaced by a translation overlay prop.
    assert.match(rail, /\{resource\.name\}/);
    assert.doesNotMatch(rail, /name=\{\s*translated/);

    assert.match(tabs, /trustedCategoryTabs/);
    assert.match(tabs, /trustedCategories/);
    assert.doesNotMatch(tabs, /TRUSTED_MEDIA_TAB_LABELS/);
  });

  it("catalog parity for principles, pipeline stages, trusted categories", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    const keys: string[] = [];
    for (const id of PRINCIPLE_WHY_IT_MATTERS_IDS) {
      keys.push(`civicMediaPublic.principles.${id}.whyItMatters`);
    }
    for (const id of TRUSTED_MEDIA_CATEGORY_IDS) {
      keys.push(`civicMediaPublic.trustedCategories.${id}`);
      keys.push(`civicMediaPublic.trustedCategoryTabs.${id}`);
    }
    for (const stage of CIVIC_PIPELINE_STAGES) {
      keys.push(`civicMediaPublic.pipeline.stages.${stage.id}.title`);
      keys.push(`civicMediaPublic.pipeline.stages.${stage.id}.description`);
    }

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of keys) {
        assert.equal(typeof readNested(loaded.messages, key), "string", `${locale}:${key}`);
      }
    }

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });
});
