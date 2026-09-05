/**
 * Reset 03 — web Media PLP flag + shared identity smoke.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpTrustedEntityId,
} from "@hu/types";

import {
  isMediaPlpWebEnabled,
  setMediaPlpWebEnabledForTests,
} from "./feature-flag.js";

const webSrc = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Reset 03 web Media PLP boundary", () => {
  it("feature flag defaults OFF", () => {
    setMediaPlpWebEnabledForTests(null);
    assert.equal(isMediaPlpWebEnabled(), false);
    setMediaPlpWebEnabledForTests(true);
    assert.equal(isMediaPlpWebEnabled(), true);
    setMediaPlpWebEnabledForTests(null);
  });

  it("shared trusted entity id for /media and country", () => {
    assert.equal(mediaPlpTrustedEntityId("the-atlantic"), "the-atlantic");
    assert.equal(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED, "civic_media_trusted");
  });

  it("PLP page path does not import generateContentTranslation", () => {
    const plpPage = readFileSync(
      join(webSrc, "features/language/media-plp/CivicMediaCenterPlpContent.tsx"),
      "utf8",
    );
    assert.doesNotMatch(plpPage, /generateContentTranslation|useTrustedMediaExplanationsOverlay/);
    assert.doesNotMatch(plpPage, /CivicMediaTranslatedEditorial/);
    const mediaRoute = readFileSync(join(webSrc, "app/media/page.tsx"), "utf8");
    assert.match(mediaRoute, /isMediaPlpWebEnabled/);
    assert.match(mediaRoute, /CivicMediaCenterPlpContent/);
  });
});
