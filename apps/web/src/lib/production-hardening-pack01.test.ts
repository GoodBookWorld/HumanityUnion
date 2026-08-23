import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertApiBaseUrlShape,
  normalizeApiBaseUrl,
} from "./api-base-url";
import {
  resolvePlatformIndexingMode,
  shouldDisallowSearchIndexing,
} from "./platform-indexing";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("Production Hardening Pack 01 — staging noindex / robots", () => {
  it("staging and development disallow indexing", () => {
    assert.equal(shouldDisallowSearchIndexing({ NEXT_PUBLIC_PLATFORM_MODE: "staging" }), true);
    assert.equal(shouldDisallowSearchIndexing({ NEXT_PUBLIC_PLATFORM_MODE: "development" }), true);
    assert.equal(resolvePlatformIndexingMode({ NEXT_PUBLIC_PLATFORM_MODE: "staging" }), "staging");
  });

  it("production is not staging-blocked", () => {
    assert.equal(shouldDisallowSearchIndexing({ NEXT_PUBLIC_PLATFORM_MODE: "production" }), false);
    assert.equal(resolvePlatformIndexingMode({ NEXT_PUBLIC_PLATFORM_MODE: "production" }), "production");
  });

  it("robots.ts disallows all agents in staging projection", () => {
    const robotsSource = readFileSync(path.join(webRoot, "src/app/robots.ts"), "utf8");
    assert.match(robotsSource, /shouldDisallowSearchIndexing/);
    assert.match(robotsSource, /disallow:\s*"\/"/);
  });
});

describe("Production Hardening Pack 01 — API base URL contract", () => {
  it("normalizes trailing slashes and rejects /api path suffix", () => {
    assert.equal(normalizeApiBaseUrl("https://api.huws.org/"), "https://api.huws.org");
    assert.throws(() => assertApiBaseUrlShape("https://api.huws.org/api"), /without a path/);
    assert.doesNotThrow(() => assertApiBaseUrlShape("https://api-staging.huws.org"));
  });
});

describe("Production Hardening Pack 01 — Docker standalone packaging", () => {
  it("Web Dockerfile copies workspace packages and static/public assets", () => {
    const dockerfile = readFileSync(path.join(webRoot, "Dockerfile"), "utf8");
    assert.match(dockerfile, /packages\/media-registry/);
    assert.match(dockerfile, /packages\/geography/);
    assert.match(dockerfile, /\.next\/standalone/);
    assert.match(dockerfile, /\.next\/static/);
    assert.match(dockerfile, /apps\/web\/public/);
    // Pack 10F — public must be copied AFTER standalone so geography JSON is not clobbered.
    const standaloneIdx = dockerfile.indexOf(".next/standalone");
    const publicIdx = dockerfile.lastIndexOf("apps/web/public");
    assert.ok(standaloneIdx >= 0 && publicIdx > standaloneIdx);
  });
});

describe("Production Hardening Pack 01 — auth/PWA regression anchors", () => {
  it("auth recovery sources do not write auth tokens to localStorage", () => {
    for (const relative of [
      "src/features/auth/auth-token-refresh.ts",
      "src/features/auth/auth-api.ts",
      "src/features/auth/client-auth-status-resolver.ts",
    ]) {
      const source = readFileSync(path.join(webRoot, relative), "utf8");
      assert.doesNotMatch(source, /localStorage\.setItem/);
    }
  });

  it("service worker continues to denylist private API surfaces", () => {
    const sw = readFileSync(path.join(webRoot, "public/sw.js"), "utf8");
    assert.match(sw, /isPrivateApiRequest/);
    assert.match(sw, /\/api\/v1\/notifications/);
    assert.match(sw, /\/api\/v1\/workspace/);
    assert.match(sw, /\/api\/v1\/shared-documents/);
  });
});
