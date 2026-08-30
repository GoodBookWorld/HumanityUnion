/**
 * Production Completion Pack 01 — Support operational links (unit).
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  listPublicPlatformSupportLinks,
  resetPlatformSupportLinksStoreForTests,
  setPlatformSupportLinksForceMemoryForTests,
  validatePlatformSupportUrl,
  PlatformSupportLinkValidationError,
  PLATFORM_SUPPORT_LINK_SEED_URLS,
} from "../../../src/modules/platform-support-links/index.js";
import {
  getPlatformSupportLinkMemory,
  upsertPlatformSupportLinkMemory,
} from "../../../src/modules/platform-support-links/persistence/platform-support-links.memory.store.js";

describe("Production Completion Pack 01 — platform support links (unit)", () => {
  beforeEach(() => {
    setPlatformSupportLinksForceMemoryForTests(true);
    resetPlatformSupportLinksStoreForTests();
  });

  it("validates HTTPS URLs and safe relative paths; rejects credentials / http / protocol-relative", () => {
    assert.equal(
      validatePlatformSupportUrl("https://buy.stripe.com/6oE03n4bc9Vm9A45kl"),
      "https://buy.stripe.com/6oE03n4bc9Vm9A45kl",
    );
    assert.equal(validatePlatformSupportUrl("/regional-program"), "/regional-program");
    assert.throws(
      () => validatePlatformSupportUrl("http://example.com/donate"),
      PlatformSupportLinkValidationError,
    );
    assert.throws(
      () => validatePlatformSupportUrl("https://user:secret@example.com/donate"),
      PlatformSupportLinkValidationError,
    );
    assert.throws(
      () => validatePlatformSupportUrl("//evil.example/path"),
      PlatformSupportLinkValidationError,
    );
  });

  it("public list omits cleared volunteer by default and never exposes secrets", async () => {
    const publicBefore = await listPublicPlatformSupportLinks();
    assert.equal(publicBefore.links.length, 2);
    assert.deepEqual(
      publicBefore.links.map((row) => row.linkId).sort(),
      ["donation", "regional_program"],
    );
    assert.equal(PLATFORM_SUPPORT_LINK_SEED_URLS.volunteer, null);

    const donation = getPlatformSupportLinkMemory("donation");
    assert.ok(donation);
    upsertPlatformSupportLinkMemory({
      ...donation,
      url: null,
      enabled: false,
      updatedAt: new Date().toISOString(),
    });

    const publicAfter = await listPublicPlatformSupportLinks();
    assert.equal(publicAfter.links.length, 1);
    assert.equal(publicAfter.links[0]?.linkId, "regional_program");
    for (const row of publicAfter.links) {
      assert.equal("password" in row, false);
      assert.equal("token" in row, false);
      assert.equal("secret" in row, false);
    }
  });
});
