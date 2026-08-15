import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");
const repoRoot = path.resolve(webRoot, "../..");

function readWeb(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

function readPublic(relativeFromPublic: string): string {
  return readFileSync(path.join(webRoot, "public", relativeFromPublic), "utf8");
}

/**
 * Browser & Device QA Pack 01 — bounded regression guards for defects that
 * can be verified in CI without claiming physical-device coverage.
 */
describe("Browser & Device QA Pack 01 — regression guards", () => {
  it("QA review document exists", () => {
    assert.ok(
      existsSync(path.join(repoRoot, "project/architecture/reviews/BROWSER_DEVICE_QA_v1.0.md")),
    );
  });

  it("manifest start_url remains /workspace with standalone display", () => {
    const manifest = readWeb("app/manifest.ts");
    assert.match(manifest, /start_url:\s*"\/workspace"/);
    assert.match(manifest, /display:\s*"standalone"/);
  });

  it("service worker never caches private API prefixes", () => {
    const sw = readPublic("sw.js");
    assert.match(sw, /isPrivateApiRequest/);
    assert.match(sw, /hu_access_token/);
    assert.match(sw, /\/api\/v1\/direct-messages/);
    assert.match(sw, /\/api\/v1\/assistant/);
    assert.doesNotMatch(sw, /\.skipWaiting\s*\(/);
  });

  it("offline fallback remains truthful", () => {
    const offline = readPublic("offline.html");
    assert.match(offline, /You're offline/);
    assert.match(offline, /Try Again/);
    assert.doesNotMatch(offline, /queued|will send when online/i);
  });

  it("Workspace guest gate preserves returnTo=/workspace", () => {
    const gate = readWeb("features/auth/components/WorkspaceAuthGate.tsx");
    assert.match(gate, /\/login\?returnTo=/);
  });

  it("browser mode keeps website header; standalone shell is opt-in", () => {
    const shell = readWeb("features/pwa/components/PwaShell.tsx");
    const layout = readWeb("design-system/components/HumanityLayout.tsx");
    assert.match(layout, /HumanityHeader/);
    assert.match(shell, /standalone/);
    assert.match(shell, /PwaBottomNav/);
  });

  it("no Push / App Store packaging introduced by QA pack", () => {
    const sw = readPublic("sw.js");
    assert.doesNotMatch(sw, /pushmanager|PushSubscription|showNotification/i);
    assert.ok(!existsSync(path.join(repoRoot, "android")));
    assert.ok(!existsSync(path.join(repoRoot, "ios")));
  });
});
