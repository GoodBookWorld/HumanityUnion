/**
 * Step 07A — singleton Support and Volunteer seo_page_overrides validation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSeoPageOverrideId, SEO_PAGE_OVERRIDE_FAMILIES } from "@hu/types";

import { SeoPageOverrideValidationError } from "../../../src/modules/seo-page-overrides/seo-page-overrides.errors.js";
import {
  expectedCanonicalPathForSeoPage,
  validateSeoPageCanonicalPath,
  validateSeoPageEntityKey,
} from "../../../src/modules/seo-page-overrides/seo-page-overrides.validators.js";

describe("Step 07A — Support and Volunteer override identity", () => {
  it("accepts stable singleton identities and rejects other keys", () => {
    assert.ok(SEO_PAGE_OVERRIDE_FAMILIES.includes("support"));
    assert.ok(SEO_PAGE_OVERRIDE_FAMILIES.includes("volunteer"));
    assert.ok(SEO_PAGE_OVERRIDE_FAMILIES.includes("country"));
    assert.ok(SEO_PAGE_OVERRIDE_FAMILIES.includes("initiative"));
    assert.ok(SEO_PAGE_OVERRIDE_FAMILIES.includes("knowledge"));
    assert.ok(SEO_PAGE_OVERRIDE_FAMILIES.includes("civic-archive"));

    assert.equal(validateSeoPageEntityKey("support", "support"), "support");
    assert.equal(validateSeoPageEntityKey("volunteer", "volunteer"), "volunteer");
    assert.equal(expectedCanonicalPathForSeoPage("support", "support"), "/support");
    assert.equal(expectedCanonicalPathForSeoPage("volunteer", "volunteer"), "/volunteer");
    assert.equal(
      validateSeoPageCanonicalPath("support", "support", "/support"),
      "/support",
    );
    assert.equal(
      validateSeoPageCanonicalPath("volunteer", "volunteer", "/volunteer"),
      "/volunteer",
    );
    assert.equal(buildSeoPageOverrideId("support", "support"), "support:support");
    assert.equal(buildSeoPageOverrideId("volunteer", "volunteer"), "volunteer:volunteer");

    assert.throws(
      () => validateSeoPageEntityKey("support", "other"),
      SeoPageOverrideValidationError,
    );
    assert.throws(
      () => validateSeoPageCanonicalPath("volunteer", "volunteer", "/ar/volunteer"),
      SeoPageOverrideValidationError,
    );
  });

  it("preserves existing family canonical paths", () => {
    assert.equal(expectedCanonicalPathForSeoPage("country", "CA"), "/countries/CA");
    assert.equal(
      expectedCanonicalPathForSeoPage("initiative", "init-1"),
      "/initiatives/public/init-1",
    );
    assert.equal(expectedCanonicalPathForSeoPage("knowledge", "article"), "/knowledge/article");
    assert.equal(
      expectedCanonicalPathForSeoPage("civic-archive", "init-1"),
      "/civic-archive/init-1",
    );
    assert.equal(validateSeoPageEntityKey("country", "ca"), "CA");
  });
});
