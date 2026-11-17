/**
 * Safe returnTo helper — used by login and HU-RRP-02A entry.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAuthPathWithReturnTo } from "./build-auth-return-path.js";
import { resolveSafeReturnTo } from "./resolve-safe-return-to.js";

describe("resolveSafeReturnTo", () => {
  it("preserves nested Workspace query parameters", () => {
    assert.equal(
      resolveSafeReturnTo("/workspace?rrp=apply", "/workspace"),
      "/workspace?rrp=apply",
    );
    assert.equal(
      buildAuthPathWithReturnTo("/login", "/workspace?rrp=apply"),
      `/login?returnTo=${encodeURIComponent("/workspace?rrp=apply")}`,
    );
  });

  it("rejects external and auth-loop destinations", () => {
    assert.equal(resolveSafeReturnTo("https://evil.example/x", "/workspace"), "/workspace");
    assert.equal(resolveSafeReturnTo("//evil.example", "/workspace"), "/workspace");
    assert.equal(resolveSafeReturnTo("/register", "/workspace"), "/workspace");
    assert.equal(resolveSafeReturnTo("/confirm-email", "/workspace"), "/workspace");
    assert.equal(resolveSafeReturnTo("/login/verify", "/workspace"), "/workspace");
  });

  it("uses the fallback when returnTo is absent", () => {
    assert.equal(resolveSafeReturnTo(null, "/workspace"), "/workspace");
    assert.equal(resolveSafeReturnTo(undefined, "/account"), "/account");
  });
});
