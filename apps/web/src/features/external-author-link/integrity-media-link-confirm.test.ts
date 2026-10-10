import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveSafeReturnTo } from "../auth/lib/resolve-safe-return-to.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("Integrity Media confirmation page", () => {
  it("sends unauthenticated visitors through Humanity Union login and never supplies a member id", () => {
    const page = readFileSync(path.join(here, "IntegrityMediaLinkConfirm.tsx"), "utf8");
    const confirmationPath = "/connect/integrity-media?state=opaque-attempt-state";

    assert.match(page, /Connect your Humanity Union account to Integrity Media\?/);
    assert.match(page, /\/login\?returnTo=/);
    assert.match(page, /\/connect\/integrity-media\?state=/);
    assert.match(page, /JSON\.stringify\(\{ state: attemptState \}\)/);
    assert.match(page, /This confirmation will not be kept/);
    assert.match(page, /through registration/);
    assert.match(page, /href="\/register"/);
    assert.match(page, />\s*Confirm\s*</);
    assert.match(page, />\s*Cancel\s*</);
    assert.equal(page.includes("memberId"), false);
    assert.equal(page.includes("returnUrl"), false);
    assert.equal(resolveSafeReturnTo(confirmationPath, "/workspace"), confirmationPath);
    assert.equal(
      resolveSafeReturnTo("https://integrity.example/return", "/workspace"),
      "/workspace",
    );
    assert.equal(resolveSafeReturnTo("//integrity.example", "/workspace"), "/workspace");
  });
});
