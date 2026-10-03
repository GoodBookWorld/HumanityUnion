/**
 * F.3.39 — generateMetadata and the Initiative page share one document load.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isPwaPersistedOrdinaryReadingEligible } from "@hu/types";

import { initiativeMetadataFieldsFromPresentationSeed } from "./load-initiative-document-server-data";
import { selectInitiativeDocumentPresentationSeed } from "./load-initiative-detail-presentation-seed";
import { resolveLocalizedPublicMetadataCopy } from "../../lib/seo/resolve-localized-public-metadata-copy";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const page = readWeb("app/initiatives/public/[initiativeId]/page.tsx");
const loader = readWeb(
  "features/public-initiative-experience/load-initiative-document-server-data.ts",
);
const seedLoader = readWeb(
  "features/public-initiative-experience/load-initiative-detail-presentation-seed.ts",
);
const deferred = readWeb(
  "features/community-intelligence/components/DeferredRelatedInitiatives.tsx",
);
const experience = readFileSync(
  path.resolve(
    here,
    "../../../../../apps/api/src/modules/initiatives/public-initiative-experience.service.ts",
  ),
  "utf8",
);
const hero = readWeb(
  "features/public-initiative-experience/use-initiative-public-presentation.ts",
);

describe("F.3.39 initiative document SSR dedupe", () => {
  it("A/B/C. metadata and page share one cached initiative and translation load", () => {
    assert.equal(
      (page.match(/loadInitiativeDocumentServerData\(initiativeId\)/g) ?? []).length,
      2,
    );
    assert.equal(page.includes("getPublicInitiative("), false);
    assert.equal(page.includes("resolveTranslatedContent("), false);
    assert.equal(page.includes("loadInitiativeMetadataTranslationFields("), false);
    assert.equal(page.includes("loadInitiativeDetailPresentationSeed("), false);
    assert.match(loader, /cache\(loadInitiativeDocumentServerDataUncached\)/);
    assert.equal((loader.match(/getPublicInitiative\(/g) ?? []).length, 1);
    assert.equal((loader.match(/loadInitiativeDetailPresentationSeed\(/g) ?? []).length, 1);
    assert.equal(loader.includes("resolveTranslatedContent("), false);
    assert.equal((seedLoader.match(/resolveTranslatedContent\(/g) ?? []).length, 1);
    assert.doesNotMatch(loader, /new Map\(|setInterval|router\.refresh|generateContentTranslation/);
  });

  it("D/E/F/H. metadata and seed keep CURRENT copy and canonical fallback", () => {
    const canonical = { title: "Canonical title", description: "Canonical description" };
    const current = selectInitiativeDocumentPresentationSeed({
      canonical,
      presentationMode: "translated",
      content: { title: "Localized title", description: "Localized description" },
    });
    assert.deepEqual(current, {
      title: "Localized title",
      description: "Localized description",
    });
    const fields = initiativeMetadataFieldsFromPresentationSeed({
      canonicalTitle: canonical.title,
      canonicalDescription: canonical.description,
      seed: current,
    });
    const metadata = resolveLocalizedPublicMetadataCopy({
      title: canonical.title,
      description: canonical.description,
      locale: "he",
      ...fields,
    });
    assert.equal(metadata.title, "Localized title");
    assert.equal(metadata.description, "Localized description");

    const partial = selectInitiativeDocumentPresentationSeed({
      canonical,
      presentationMode: "translated",
      content: { title: "Localized title" },
    });
    assert.equal(partial.description, canonical.description);
    const partialMetadata = resolveLocalizedPublicMetadataCopy({
      title: canonical.title,
      description: canonical.description,
      ...initiativeMetadataFieldsFromPresentationSeed({
        canonicalTitle: canonical.title,
        canonicalDescription: canonical.description,
        seed: partial,
      }),
    });
    assert.equal(partialMetadata.title, "Localized title");
    assert.equal(partialMetadata.description, canonical.description);

    const english = selectInitiativeDocumentPresentationSeed({
      canonical,
      presentationMode: "original",
      content: { title: "Ignored", description: "Ignored" },
    });
    assert.deepEqual(english, canonical);
    const englishMetadata = resolveLocalizedPublicMetadataCopy({
      title: canonical.title,
      description: canonical.description,
      locale: "en",
      ...initiativeMetadataFieldsFromPresentationSeed({
        canonicalTitle: canonical.title,
        canonicalDescription: canonical.description,
        seed: english,
      }),
    });
    assert.equal(englishMetadata.title, canonical.title);
    assert.equal(englishMetadata.description, canonical.description);
    assert.equal(englishMetadata.usedTranslation, false);
  });

  it("G/I/K. persisted reading stays independent of the legacy flag and locale branches", () => {
    assert.equal(
      isPwaPersistedOrdinaryReadingEligible({
        enabled: true,
        contentTranslationEnabled: true,
        pwaPersistedReadingEnabled: false,
        pwaPersistedReadingReady: false,
      }),
      true,
    );
    assert.equal(loader.includes("pwaPersistedReadingEnabled"), false);
    assert.equal(loader.includes("pwaPersistedReadingReady"), false);
    assert.equal(loader.includes("presentationMode"), false);
    assert.equal(loader.includes("generateContentTranslation"), false);
    assert.equal(page.includes("generateContentTranslation"), false);
    assert.doesNotMatch(loader, /locale\s*===|=== ["'](?:he|uk|ar|zh-Hant)["']/);
    assert.doesNotMatch(page, /locale\s*===|=== ["'](?:he|uk|ar|zh-Hant)["']/);
  });

  it("J. deferred related initiatives stay off the document loader", () => {
    assert.match(deferred, /fetchRelatedInitiatives\(initiativeId\)/);
    assert.equal(loader.includes("fetchRelatedInitiatives"), false);
    assert.equal(page.includes("fetchRelatedInitiatives"), false);
    assert.equal(experience.includes("findRelatedInitiativesForInitiative"), false);
    assert.match(experience, /relatedInitiatives:\s*\[\]/);
    assert.match(hero, /resolveInitiativeDetailPresentation\(/);
  });
});
