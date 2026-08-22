import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  getMediaRegistryProviderById,
  getMediaRegistryProviderByName,
} from "@hu/media-registry";

import { resolveProviderPresentation } from "../public-news/public-news-discovery.utils";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const mediaDir = path.join(webRoot, "public/images/media");
const repoRoot = path.resolve(webRoot, "../..");
const pageSource = readFileSync(
  path.join(webRoot, "src/features/civic-media-center/components/CivicMediaCenterPageContent.tsx"),
  "utf8",
);
const cardsCss = readFileSync(
  path.join(webRoot, "src/features/civic-media-center/components/civic-media-resource-cards.css"),
  "utf8",
);
const trustedMediaSource = readFileSync(
  path.join(repoRoot, "apps/api/src/modules/civic-media-center/content/trusted-media.ts"),
  "utf8",
);
const factCheckingSource = readFileSync(
  path.join(repoRoot, "apps/api/src/modules/civic-media-center/content/fact-checking.ts"),
  "utf8",
);
const propagandaSource = readFileSync(
  path.join(repoRoot, "apps/api/src/modules/civic-media-center/content/propaganda-analysis.ts"),
  "utf8",
);

function assertAsset(relativePath: string): void {
  assert.ok(existsSync(path.join(mediaDir, relativePath)), relativePath);
}

describe("Civic Media Visual Mapping Pack 02", () => {
  it("maps horizontal-rail pack logos through the canonical registry", () => {
    const expected = [
      ["France24", "france24", "/images/media/france24.webp", "france24.webp"],
      ["Euronews", "euronews", "/images/media/euronews.webp", "euronews.webp"],
      ["The New York Times", "new-york-times", "/images/media/nytimes.webp", "nytimes.webp"],
      ["The Guardian", "the-guardian", "/images/media/guardian.webp", "guardian.webp"],
      ["The Washington Post", "washington-post", "/images/media/wpost.webp", "wpost.webp"],
      ["The Economist", "the-economist", "/images/media/the-economist.webp", "the-economist.webp"],
    ] as const;

    for (const [name, id, logoUrl, asset] of expected) {
      const presentation = resolveProviderPresentation(name);
      assert.equal(presentation.logoUrl, logoUrl, name);
      assert.equal(getMediaRegistryProviderById(id)?.logoUrl, logoUrl);
      assert.equal(getMediaRegistryProviderByName(name)?.logoUrl, logoUrl);
      assertAsset(asset);
    }
  });

  it("resolves RSS source aliases to canonical logos", () => {
    assert.equal(resolveProviderPresentation("Guardian").logoUrl, "/images/media/guardian.webp");
    assert.equal(resolveProviderPresentation("NYT").logoUrl, "/images/media/nytimes.webp");
    assert.equal(
      resolveProviderPresentation("Washington Post").logoUrl,
      "/images/media/wpost.webp",
    );
    assert.equal(resolveProviderPresentation("Economist").logoUrl, "/images/media/the-economist.webp");
  });

  it("adds The Atlantic to Independent Investigative with the correct logo", () => {
    assert.match(trustedMediaSource, /id:\s*"the-atlantic"/);
    assert.match(trustedMediaSource, /categoryId:\s*"independent-investigative"/);
    assert.match(trustedMediaSource, /logoUrl:\s*"\/images\/media\/the-atlantic\.webp"/);
    assert.match(trustedMediaSource, /websiteUrl:\s*"https:\/\/www\.theatlantic\.com\/"/);
    assertAsset("the-atlantic.webp");
  });

  it("wires OCCRP, ABC Australia, Science, JSTOR, and Britannica logos", () => {
    const expected = [
      ["occrp", "occrp.webp"],
      ["abc-australia", "abc-australia.webp"],
      ["science-magazine", "science.webp"],
      ["jstor", "jstor.webp"],
      ["britannica", "britannica.webp"],
    ] as const;

    for (const [id, asset] of expected) {
      assert.match(trustedMediaSource, new RegExp(`id:\\s*"${id}"[\\s\\S]*?logoUrl:\\s*"/images/media/${asset}"`));
      assertAsset(asset);
    }
  });

  it("maps all seven Fact-Checking logos", () => {
    const expected = [
      ["snopes", "fact/snopes.webp"],
      ["politifact", "fact/politifact.webp"],
      ["factcheck-org", "fact/factcheck.webp"],
      ["euvsdisinfo", "fact/euvsdisinfo.webp"],
      ["bellingcat", "fact/bellingcat.webp"],
      ["afp-fact-check", "fact/afp.webp"],
      ["full-fact", "fact/fullfact.webp"],
    ] as const;

    for (const [id, asset] of expected) {
      assert.match(
        factCheckingSource,
        new RegExp(`id:\\s*"${id}"[\\s\\S]*?logoUrl:\\s*"/images/media/${asset}"`),
      );
      assertAsset(asset);
    }
  });

  it("maps all six Propaganda Analysis logos", () => {
    const expected = [
      ["euvsdisinfo-analysis", "fact/euvsdisinfo.webp"],
      ["dfrlab", "fact/dfrlab.webp"],
      ["stanford-internet-observatory", "fact/stanford.webp"],
      ["first-draft", "fact/firstdraft.webp"],
      ["rand-information-warfare", "fact/rand.webp"],
      ["mediawell", "fact/mediawell.webp"],
    ] as const;

    for (const [id, asset] of expected) {
      assert.match(
        propagandaSource,
        new RegExp(`id:\\s*"${id}"[\\s\\S]*?logoUrl:\\s*"/images/media/${asset}"`),
      );
      assertAsset(asset);
    }
  });

  it("opens Fact-Checking and Propaganda external links safely in a new tab", () => {
    assert.match(pageSource, /target="_blank"/);
    assert.match(pageSource, /rel="noopener noreferrer"/);
    assert.match(pageSource, /Official website/);
    assert.match(pageSource, /Learn more/);
    assert.match(pageSource, /ExternalResourceLink/);
  });

  it("preserves logo aspect ratio with object-fit contain", () => {
    assert.match(cardsCss, /object-fit:\s*contain/);
    assert.match(cardsCss, /header--logo-end/);
  });

  it("uses canonical registry presentation for POLITICO logo", () => {
    const presentation = resolveProviderPresentation("POLITICO");
    assert.equal(presentation.logoUrl, "/images/media/politico.webp");
    assert.equal(presentation.logoLabel, "POL");
    assert.equal(getMediaRegistryProviderById("politico")?.logoUrl, "/images/media/politico.webp");
  });

  it("does not introduce a duplicate special-case logo resolver", () => {
    assert.equal(typeof resolveProviderPresentation, "function");
    assert.doesNotMatch(pageSource, /sourceName\s*===\s*["']The Guardian["']/);
    assert.doesNotMatch(pageSource, /if\s*\(.*Guardian.*\)\s*\{[^}]*guardian\.webp/s);
  });
});
