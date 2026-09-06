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
    const mediaRoute = readFileSync(join(webSrc, "app/media/page.tsx"), "utf8");
    assert.match(mediaRoute, /composeMediaPageLocalization/);
    assert.match(mediaRoute, /CivicMediaCenterPageContent/);
    assert.doesNotMatch(mediaRoute, /CivicMediaCenterPlpContent/);
    const compose = readFileSync(
      join(webSrc, "features/language/media-plp/compose-media-page-localization.ts"),
      "utf8",
    );
    assert.match(compose, /isMediaPlpWebEnabled/);
    const pageContent = readFileSync(
      join(webSrc, "features/civic-media-center/components/CivicMediaCenterPageContent.tsx"),
      "utf8",
    );
    assert.match(pageContent, /skipClientTranslation/);
    assert.doesNotMatch(pageContent, /generateContentTranslation\(/);
  });
});
