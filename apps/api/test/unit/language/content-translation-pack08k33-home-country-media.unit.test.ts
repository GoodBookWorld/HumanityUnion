/**
 * Pack 08K.3.3 — API-side geography + country media translation wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiSrc = join(dirname(fileURLToPath(import.meta.url)), "../../../src");

function readApi(relativePath: string): string {
  return readFileSync(join(apiSrc, relativePath), "utf8");
}

describe("Pack 08K.3.3 API home/country media wiring", () => {
  it("civic_media loader fingerprints WORLD + COUNTRY trusted explanations", () => {
    const loaders = readApi("modules/language/content-translation-civic-loaders.ts");
    const service = readApi("modules/media-resources/media-resource.service.ts");
    assert.match(loaders, /listAllPublicTrustedMediaForTranslation/);
    assert.match(loaders, /trustedMediaExplanations/);
    assert.match(service, /listAllPublicTrustedMediaForTranslation/);
    assert.match(service, /WORLD \+ COUNTRY/);
  });

  it("thin media diagnostic still emits country_media_rail sharing trusted identity", () => {
    const discover = readApi(
      "modules/language/thin-media-localization-diagnostic/discover-media-presentations.ts",
    );
    assert.match(discover, /country_media_rail/);
    assert.match(discover, /civic_media_trusted/);
    assert.match(discover, /country-rail::/);
    assert.match(discover, /::trusted::/);
  });

  it("08K.3.2 thin media diagnostic remains isolated (no Gemini/reconcile/web)", () => {
    const runner = readApi(
      "modules/language/thin-media-localization-diagnostic/run-media-diagnostic.ts",
    );
    const script = readApi("scripts/diagnose-media-localization.ts");
    assert.doesNotMatch(runner, /gemini|reconcile-public-localization/i);
    assert.match(script, /THIN_READ_ONLY|thin-media-localization-diagnostic/);
  });
});
