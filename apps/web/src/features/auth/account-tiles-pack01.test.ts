/**
 * Production Completion Pack 01 — Workspace Account information tiles.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Production Completion Pack 01 — Account tiles", () => {
  it("uses five standard information tiles for stable account fields", () => {
    const panel = read("features/auth/components/AccountPanel.tsx");
    assert.match(panel, /AdminMetricDetailsGrid/);
    assert.match(panel, /label: t\("displayName"\)/);
    assert.match(panel, /label: tAuth\("email"\)/);
    assert.match(panel, /label: t\("emailVerification"\)/);
    assert.match(panel, /label: t\("role"\)/);
    assert.match(panel, /label: t\("status"\)/);
    assert.match(panel, /pendingEmailChange/);
    assert.match(panel, /pendingEmail/);
    assert.match(panel, /value: user\.role/);
    assert.match(panel, /value: user\.status/);
    assert.doesNotMatch(panel, /ProfileField label="Display Name"/);

    const tileBlock = panel.slice(
      panel.indexOf("const accountTiles"),
      panel.indexOf("];", panel.indexOf("const accountTiles")) + 2,
    );
    assert.equal([...tileBlock.matchAll(/label:/g)].length, 5);
  });
});
