/**
 * Search/SEO Step 02 — Admin pages stay out of external search indexes.
 * Auth gates are unchanged. Staging/development still disallow the whole site.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import robots from "../../app/robots";
import { shouldDisallowSearchIndexing } from "../../lib/platform-indexing";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const PRIVATE_ROBOTS_PATHS = [
  "/workspace/",
  "/admin/",
  "/notifications",
  "/preferences",
  "/login",
  "/account",
  "/password-reset",
  "/confirm-email",
  "/confirm-email-change",
] as const;

const PUBLIC_PATHS_THAT_MUST_STAY_ALLOWED = ["/", "/blog", "/initiatives", "/search", "/media"] as const;

const ENV_KEYS = ["NEXT_PUBLIC_PLATFORM_MODE", "PLATFORM_MODE", "NEXT_PUBLIC_SITE_URL"] as const;

function snapshotEnv(): Record<(typeof ENV_KEYS)[number], string | undefined> {
  return {
    NEXT_PUBLIC_PLATFORM_MODE: process.env.NEXT_PUBLIC_PLATFORM_MODE,
    PLATFORM_MODE: process.env.PLATFORM_MODE,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  };
}

function restoreEnv(saved: ReturnType<typeof snapshotEnv>): void {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function withPlatformMode(mode: string): void {
  process.env.NEXT_PUBLIC_PLATFORM_MODE = mode;
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.org";
}

function productionDisallowPaths(): readonly string[] {
  const rules = robots().rules;
  const rule = Array.isArray(rules) ? rules[0] : rules;
  const disallow = rule?.disallow;
  assert.ok(Array.isArray(disallow), "production robots disallow must be a path list");
  return disallow;
}

describe("Search/SEO Step 02 — Admin indexing protection", () => {
  const saved = snapshotEnv();

  afterEach(() => {
    restoreEnv(saved);
  });

  it("production robots.txt disallows /admin/ and existing private routes", () => {
    withPlatformMode("production");
    assert.equal(shouldDisallowSearchIndexing(), false);

    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    assert.equal(rule?.userAgent, "*");
    assert.equal(rule?.allow, "/");

    const disallow = productionDisallowPaths();
    for (const privatePath of PRIVATE_ROBOTS_PATHS) {
      assert.ok(disallow.includes(privatePath), `missing disallow ${privatePath}`);
    }
    assert.equal(disallow.includes("/"), false);
  });

  it("production robots.txt does not disallow public routes", () => {
    withPlatformMode("production");
    const disallow = productionDisallowPaths();
    for (const publicPath of PUBLIC_PATHS_THAT_MUST_STAY_ALLOWED) {
      assert.equal(disallow.includes(publicPath), false, `public path blocked: ${publicPath}`);
    }
  });

  it("staging and development still disallow the whole site", () => {
    withPlatformMode("staging");
    assert.equal(shouldDisallowSearchIndexing(), true);
    assert.deepEqual(robots().rules, { userAgent: "*", disallow: "/" });

    withPlatformMode("development");
    assert.equal(shouldDisallowSearchIndexing(), true);
    assert.deepEqual(robots().rules, { userAgent: "*", disallow: "/" });
  });

  it("Admin layout metadata is noindex and nofollow", () => {
    const layout = readFileSync(path.join(webRoot, "src/app/admin/layout.tsx"), "utf8");
    assert.match(layout, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
    assert.match(layout, /WorkspaceAuthGate/);
  });
});
