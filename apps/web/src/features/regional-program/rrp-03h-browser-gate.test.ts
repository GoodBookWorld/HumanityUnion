/**
 * HU-RRP-03H — documents browser E2E gate + keeps Production flag OFF in source.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isRrpApplicationEntryEnabled } from "./rrp-application-entry.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("HU-RRP-03H browser E2E gate", () => {
  it("keeps Production/default WEB flag OFF", () => {
    assert.equal(isRrpApplicationEntryEnabled({}), false);
    assert.equal(
      isRrpApplicationEntryEnabled({ NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED: "true" }),
      true,
    );
  });

  it("registers Playwright RRP browser gate with explicit prerequisites (skip ≠ PASS)", () => {
    const playwright = readFileSync(
      path.resolve(here, "rrp-03h-browser.playwright.e2e.ts"),
      "utf8",
    );
    const config = readFileSync(
      path.resolve(here, "../../../playwright.config.ts"),
      "utf8",
    );
    assert.match(playwright, /RRP_E2E_BASE_URL/);
    assert.match(playwright, /test\.skip\(!isolatedStackReady/);
    assert.match(playwright, /Prerequisites/);
    assert.match(playwright, /MongoDB replica set/);
    assert.match(config, /rrp-03h-browser\.playwright\.e2e\.ts/);
  });
});
