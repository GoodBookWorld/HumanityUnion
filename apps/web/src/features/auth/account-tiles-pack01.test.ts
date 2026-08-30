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
    assert.match(panel, /Display Name/);
    assert.match(panel, /Email Verification/);
    assert.match(panel, /Pending Email Change/);
    assert.match(panel, /pendingEmail/);
    assert.match(panel, /label: "Role"/);
    assert.match(panel, /label: "Status"/);
    assert.doesNotMatch(panel, /ProfileField label="Display Name"/);
  });
});
