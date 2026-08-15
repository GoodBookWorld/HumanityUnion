import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  getMediaRegistryProviderById,
  getMediaRegistryProviderByName,
  TRUSTED_GLOBAL_MEDIA_REGISTRY,
} from "@hu/media-registry";

import { PUBLIC_NEWS_RAIL_LIMIT, resolveProviderPresentation } from "./public-news-discovery.utils";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const mediaDir = path.join(webRoot, "public/images/media");

describe("Civic Media RSS Integration Pack 01 — logos & rail", () => {
  it("resolves Pack source logos through the canonical registry helper only", () => {
    const guardian = resolveProviderPresentation("The Guardian");
    assert.equal(guardian.logoUrl, "/images/media/guardian.webp");
    assert.equal(getMediaRegistryProviderByName("The Guardian")?.logoUrl, guardian.logoUrl);

    const economist = resolveProviderPresentation("The Economist");
    assert.equal(economist.logoUrl, "/images/media/the-economist.webp");
    assert.equal(economist.logoLabel, "TE");

    const politico = resolveProviderPresentation("POLITICO");
    assert.equal(politico.logoUrl, undefined);
    assert.equal(politico.logoLabel, "POL");
  });

  it("active registry logos do not use the shared trust.webp placeholder", () => {
    for (const provider of TRUSTED_GLOBAL_MEDIA_REGISTRY) {
      if (!provider.logoUrl) {
        continue;
      }
      assert.notEqual(provider.logoUrl, "/images/media/trust.webp");
      const relative = provider.logoUrl.replace(/^\/images\/media\//, "");
      assert.ok(existsSync(path.join(mediaDir, relative)), provider.logoUrl);
    }
  });

  it("France24 / Euronews assets are distinct from trust.webp", () => {
    const trust = readFileSync(path.join(mediaDir, "trust.webp"));
    const france = readFileSync(path.join(mediaDir, "france24.webp"));
    const euro = readFileSync(path.join(mediaDir, "euronews.webp"));
    assert.notEqual(Buffer.compare(france, trust), 0);
    assert.notEqual(Buffer.compare(euro, trust), 0);
  });

  it("PublicNewsCard keeps external publisher links and source name text", () => {
    const card = readFileSync(
      path.join(webRoot, "src/features/public-news/components/PublicNewsCard.tsx"),
      "utf8",
    );
    assert.match(card, /target="_blank"/);
    assert.match(card, /rel="noopener noreferrer"/);
    assert.match(card, /article\.sourceName/);
    assert.match(card, /resolveProviderPresentation/);
    assert.doesNotMatch(card, /if \(.*Guardian.*logo/);
  });

  it("rail limit is bounded", () => {
    assert.equal(PUBLIC_NEWS_RAIL_LIMIT, 24);
  });

  it("six RSS pack sources are registered", () => {
    for (const id of [
      "the-guardian",
      "the-economist",
      "washington-post",
      "cbc",
      "politico",
      "new-york-times",
    ]) {
      assert.ok(getMediaRegistryProviderById(id));
    }
  });
});
