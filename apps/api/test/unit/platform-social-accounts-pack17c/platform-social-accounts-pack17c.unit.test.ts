/**
 * Pack 17C — Canonical platform social account URL validation + public projection.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  listPublicPlatformSocialAccounts,
  resetPlatformSocialAccountsStoreForTests,
  setPlatformSocialAccountsForceMemoryForTests,
  validatePlatformSocialUrl,
  PlatformSocialAccountValidationError,
  PLATFORM_SOCIAL_SEED_URLS,
} from "../../../src/modules/platform-social-accounts/index.js";
import {
  getPlatformSocialAccountMemory,
  upsertPlatformSocialAccountMemory,
} from "../../../src/modules/platform-social-accounts/persistence/platform-social-accounts.memory.store.js";

describe("Pack 17C — platform social accounts (unit)", () => {
  beforeEach(() => {
    setPlatformSocialAccountsForceMemoryForTests(true);
    resetPlatformSocialAccountsStoreForTests();
  });

  it("validates HTTPS social hosts and rejects credentials / http / wrong network", () => {
    assert.equal(
      validatePlatformSocialUrl("facebook", "https://www.facebook.com/HumanityUnionWS/"),
      "https://www.facebook.com/HumanityUnionWS/",
    );
    assert.equal(
      validatePlatformSocialUrl("x", "https://twitter.com/HumanityUnionWS"),
      "https://twitter.com/HumanityUnionWS",
    );
    assert.throws(
      () => validatePlatformSocialUrl("instagram", "http://instagram.com/humanity_union/"),
      PlatformSocialAccountValidationError,
    );
    assert.throws(
      () =>
        validatePlatformSocialUrl(
          "youtube",
          "https://user:secret@youtube.com/@HumanityUnionWS",
        ),
      PlatformSocialAccountValidationError,
    );
    assert.throws(
      () => validatePlatformSocialUrl("facebook", "https://evil.example/facebook"),
      PlatformSocialAccountValidationError,
    );
  });

  it("public list omits cleared networks and never exposes credential fields", async () => {
    const publicBefore = await listPublicPlatformSocialAccounts();
    assert.equal(publicBefore.accounts.length, 4);
    assert.ok(publicBefore.accounts.every((row) => row.url.startsWith("https://")));
    assert.deepEqual(
      publicBefore.accounts.map((row) => row.networkId).sort(),
      ["facebook", "instagram", "x", "youtube"],
    );

    const facebook = getPlatformSocialAccountMemory("facebook");
    assert.ok(facebook);
    upsertPlatformSocialAccountMemory({
      ...facebook,
      url: null,
      enabled: false,
      updatedAt: new Date().toISOString(),
    });

    const publicAfter = await listPublicPlatformSocialAccounts();
    assert.equal(publicAfter.accounts.length, 3);
    assert.ok(!publicAfter.accounts.some((row) => row.networkId === "facebook"));
    assert.equal(PLATFORM_SOCIAL_SEED_URLS.youtube.startsWith("https://"), true);
    for (const row of publicAfter.accounts) {
      assert.equal("password" in row, false);
      assert.equal("token" in row, false);
      assert.equal("oauth" in row, false);
    }
  });
});
