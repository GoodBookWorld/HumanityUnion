import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");

function readWeb(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Launch Blocker Recovery Pack 01 — Web auth + App background", () => {
  it("6 — Web auth state resolves from session, not localStorage", () => {
    const status = readWeb("features/auth/use-client-auth-status.ts");
    const resolver = readWeb("features/auth/client-auth-status-resolver.ts");
    const store = readWeb("features/auth/auth-token-store.ts");
    assert.match(status, /resolveClientAuthStatus/);
    assert.match(resolver, /fetchAuthSession/);
    assert.doesNotMatch(store, /localStorage\.setItem/);
  });

  it("7 — returnTo=/workspace remains on Workspace gate", () => {
    const gate = readWeb("features/auth/components/WorkspaceAuthGate.tsx");
    assert.match(gate, /\/login\?returnTo=/);
  });

  it("13 — no active auth localStorage usage reappears", () => {
    const store = readWeb("features/auth/auth-token-store.ts");
    assert.match(store, /removeItem/);
    assert.doesNotMatch(store, /localStorage\.setItem/);
  });

  it("14–17 — App background uses back-app.webp at 0.5 without fading content", () => {
    assert.ok(existsSync(path.join(webRoot, "public/illustrations/back-app.webp")));
    const css = readWeb("features/pwa/pwa.css");
    assert.match(css, /\/illustrations\/back-app\.webp/);
    assert.match(css, /\.hu-pwa-install-column::before/);
    assert.match(css, /opacity:\s*0\.5/);
    assert.doesNotMatch(
      css,
      /\.hu-pwa-install-column\s*\{[^}]*opacity:\s*0\.5/s,
    );
    assert.match(css, /\.hu-pwa-install-column > \*[\s\S]*z-index:\s*1/);
  });

  it("18 — 50/50 ecosystem geometry remains", () => {
    const section = readWeb(
      "features/public-home-v2/components/PublicHomeEcosystemStatementSection.tsx",
    );
    assert.match(section, /public-home-v2__ecosystem-split/);
    assert.match(section, /PwaInstallPromotion/);
  });

  it("origin-forbidden login error is not shown as invalid credentials", () => {
    const client = readWeb("lib/api-client.ts");
    assert.match(client, /AUTH_ORIGIN_FORBIDDEN/);
    assert.match(client, /We couldn't start your session/);
  });
});
