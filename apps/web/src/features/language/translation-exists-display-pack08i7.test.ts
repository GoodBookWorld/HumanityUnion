/**
 * Pack 08I.7 — distinguish TRANSLATION_EXISTS_BUT_NOT_DISPLAYED vs expected fallback.
 * Source/wiring diagnostics only (no private content logged).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const apiSrc = path.resolve(here, "../../../../api/src");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readApi(relative: string): string {
  return readFileSync(path.join(apiSrc, relative), "utf8");
}

describe("Pack 08I.7 — translation exists vs expected fallback wiring", () => {
  it("guest resolve path uses preferred so warm translations can display", () => {
    const probe = readWeb("features/language/public-content-reading-probe.ts");
    const apiGuest = readApi("modules/language/participant-language-context.ts");
    assert.match(probe, /translationPreference:\s*"preferred"/);
    assert.match(probe, /interfaceLocale/);
    assert.match(apiGuest, /translationDisplayPreference:\s*"preferred"/);
    assert.match(apiGuest, /unauthenticated public callers|Pack 08I\.7/);
  });

  it("initiative / blog / media resolvers call resolveTranslatedContent with reading language", () => {
    const initiative = readWeb(
      "features/public-initiative-mini-card/resolve-initiative-card-presentation.ts",
    );
    const blog = readWeb("features/blog/resolve-blog-post-presentation.ts");
    const media = readWeb("features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx");
    assert.match(initiative, /resolveTranslatedContent/);
    assert.match(initiative, /sourceKind:\s*"initiative"/);
    assert.match(blog, /resolveTranslatedContent/);
    assert.match(blog, /sourceKind:\s*"blog_post"/);
    assert.match(media, /resolveTranslatedContent/);
    assert.match(media, /sourceKind:\s*"civic_media"/);
    assert.match(media, /generateContentTranslation/);
  });

  it("none preference still short-circuits to canonical (expected fallback)", () => {
    const initiative = readWeb(
      "features/public-initiative-mini-card/resolve-initiative-card-presentation.ts",
    );
    const blog = readWeb("features/blog/resolve-blog-post-presentation.ts");
    assert.match(initiative, /translationPreference === "none"/);
    assert.match(blog, /translationPreference === "none"/);
  });
});
