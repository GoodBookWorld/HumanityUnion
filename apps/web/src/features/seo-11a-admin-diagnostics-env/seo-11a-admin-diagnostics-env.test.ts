/**
 * SEO-11A — Admin SEO / Platform diagnostics read build-time environment values
 * through direct `process.env.X` references (inlined into browser bundles), not
 * the empty browser `process.env` object.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { AdminPlatformReadinessPublic } from "@hu/types";

import { readPublicBuildEnv } from "../../lib/seo/public-build-env.js";
import { buildAdminPlatformReadinessView } from "../administration/admin-platform-readiness-model.js";
import { buildSeoDiagnosticsSnapshot } from "../administration/admin-seo-diagnostics-model.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) => readFileSync(path.join(webSrc, rel), "utf8");

const KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_PLATFORM_MODE",
  "PLATFORM_MODE",
  "NODE_ENV",
] as const;
const runtimeEnv = process.env as Record<string, string | undefined>;
const original = Object.fromEntries(KEYS.map((key) => [key, runtimeEnv[key]]));

function applyEnv(values: Partial<Record<(typeof KEYS)[number], string | undefined>>) {
  for (const key of KEYS) {
    const value = values[key];
    if (value === undefined) delete runtimeEnv[key];
    else runtimeEnv[key] = value;
  }
}

afterEach(() => {
  applyEnv(original);
});

function api(overrides: Partial<AdminPlatformReadinessPublic> = {}): AdminPlatformReadinessPublic {
  return {
    platformMode: "production",
    platformVersion: "0.1.0",
    registrationRequiresInvite: false,
    showBetaBanner: false,
    betaBannerMessage: "",
    publicSiteOriginConfigured: false,
    apiPublicOriginConfigured: true,
    corsOriginConfigured: true,
    cookieSecurityStatus: "external",
    emailPublicUrlConfigured: true,
    mediaPublicOriginConfigured: true,
    services: {
      web: "configured",
      api: "configured",
      mongodb: "configured",
      email: "configured",
      media: "configured",
      ai: "disabled",
    },
    ...overrides,
  };
}

const indexing = (snapshot: ReturnType<typeof buildSeoDiagnosticsSnapshot>) =>
  Object.fromEntries(snapshot.indexing.map((check) => [check.id, check]));

describe("SEO-11A — public build env helper", () => {
  it("reads only direct static process.env references", () => {
    const source = read("lib/seo/public-build-env.ts");
    for (const key of KEYS) {
      assert.match(source, new RegExp(`${key}: process\\.env\\.${key},`));
    }
    assert.doesNotMatch(source, /process\.env\[/);
    assert.doesNotMatch(source, /\.\.\.process\.env|=\s*process\.env\s*[,;)]/);
  });

  it("returns undefined for unset values (no invented fallbacks)", () => {
    applyEnv({});
    assert.deepEqual(readPublicBuildEnv(), {
      NEXT_PUBLIC_SITE_URL: undefined,
      NEXT_PUBLIC_PLATFORM_MODE: undefined,
      PLATFORM_MODE: undefined,
      NODE_ENV: undefined,
    });
  });

  it("both models default to the helper, never to the process.env object", () => {
    for (const rel of [
      "features/administration/admin-seo-diagnostics-model.ts",
      "features/administration/admin-platform-readiness-model.ts",
    ]) {
      const source = read(rel);
      assert.doesNotMatch(source, /=\s*process\.env\s*[,)]/, rel);
      assert.match(source, /= readPublicBuildEnv\(\)/, rel);
    }
  });
});

describe("SEO-11A — Admin SEO diagnostics by environment (defaults)", () => {
  it("A — Production: production mode, origin configured, indexing allowed, no warnings", () => {
    applyEnv({
      NEXT_PUBLIC_SITE_URL: "https://huws.org",
      NEXT_PUBLIC_PLATFORM_MODE: "production",
      NODE_ENV: "production",
    });
    const snapshot = buildSeoDiagnosticsSnapshot();
    const checks = indexing(snapshot);
    assert.equal(snapshot.platformMode, "production");
    assert.equal(snapshot.siteOriginConfigured, true);
    assert.equal(snapshot.indexingAllowed, true);
    assert.equal(checks["public-site-origin"]!.status, "healthy");
    assert.equal(checks["sitemap-availability"]!.status, "healthy");
    assert.equal(checks["sitemap-availability"]!.summary, "Available at /sitemap.xml");
    assert.equal(checks["indexing-allowed"]!.summary, "Allowed");
    // SEO-11B.1: Region surface (structured data missing) and the covered Regions sitemap provider.
    assert.deepEqual(snapshot.summary, {
      healthy: 46,
      warning: 0,
      missing: 2,
      deferred: 0,
      notApplicable: 3,
    });
  });

  it("B — Staging: staging mode stays noindex with its own origin", () => {
    applyEnv({
      NEXT_PUBLIC_SITE_URL: "https://staging.huws.org",
      NEXT_PUBLIC_PLATFORM_MODE: "staging",
      NODE_ENV: "production",
    });
    const snapshot = buildSeoDiagnosticsSnapshot();
    const checks = indexing(snapshot);
    assert.equal(snapshot.platformMode, "staging");
    assert.equal(snapshot.indexingAllowed, false);
    assert.equal(snapshot.siteOriginConfigured, true);
    assert.equal(checks["public-site-origin"]!.status, "healthy");
    assert.equal(checks["indexing-allowed"]!.summary, "Disallowed (noindex)");
    assert.equal(
      checks["sitemap-availability"]!.summary,
      "Available; returns empty while indexing is disallowed",
    );
  });

  it("C — missing origin stays a visible warning", () => {
    applyEnv({ NEXT_PUBLIC_PLATFORM_MODE: "production", NODE_ENV: "production" });
    const snapshot = buildSeoDiagnosticsSnapshot();
    const checks = indexing(snapshot);
    assert.equal(snapshot.siteOriginConfigured, false);
    assert.equal(checks["public-site-origin"]!.status, "warning");
    assert.equal(checks["public-site-origin"]!.summary, "NEXT_PUBLIC_SITE_URL missing");
    assert.equal(checks["sitemap-availability"]!.status, "warning");
    assert.equal(snapshot.summary.warning, 2);
  });

  it("explicit environment injection still wins over defaults", () => {
    applyEnv({ NEXT_PUBLIC_SITE_URL: "https://huws.org", NEXT_PUBLIC_PLATFORM_MODE: "production" });
    const injected = buildSeoDiagnosticsSnapshot({ NEXT_PUBLIC_PLATFORM_MODE: "staging" });
    assert.equal(injected.platformMode, "staging");
    assert.equal(injected.siteOriginConfigured, false);
  });
});

describe("SEO-11A — Admin Platform readiness by environment (defaults)", () => {
  it("A — Production build env is recognized even before the API flag", () => {
    applyEnv({
      NEXT_PUBLIC_SITE_URL: "https://huws.org",
      NEXT_PUBLIC_PLATFORM_MODE: "production",
      NODE_ENV: "production",
    });
    const view = buildAdminPlatformReadinessView(api({ publicSiteOriginConfigured: false }));
    assert.equal(view.indexingMode, "production");
    assert.equal(view.indexingAllowed, true);
    assert.equal(view.siteOriginConfigured, true);
    assert.ok(!view.warnings.some((w) => w.code === "production_site_origin_missing"));
  });

  it("B — Staging build env stays noindex", () => {
    applyEnv({
      NEXT_PUBLIC_SITE_URL: "https://staging.huws.org",
      NEXT_PUBLIC_PLATFORM_MODE: "staging",
      NODE_ENV: "production",
    });
    // Web indexing comes from the web build env, not the API platform mode.
    const view = buildAdminPlatformReadinessView(api());
    assert.equal(view.indexingMode, "staging");
    assert.equal(view.indexingAllowed, false);
  });

  it("C — real missing origin (build env and API) stays a warning", () => {
    applyEnv({ NEXT_PUBLIC_PLATFORM_MODE: "production", NODE_ENV: "production" });
    const view = buildAdminPlatformReadinessView(api({ publicSiteOriginConfigured: false }));
    assert.equal(view.siteOriginConfigured, false);
    assert.ok(view.warnings.some((w) => w.code === "production_site_origin_missing"));
  });
});
