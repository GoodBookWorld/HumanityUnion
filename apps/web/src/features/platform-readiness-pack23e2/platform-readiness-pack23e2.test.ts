/**
 * Pack 23E.2 — Admin Platform production readiness surface.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { AdminPlatformReadinessPublic } from "@hu/types";

import {
  buildAdminPlatformReadinessView,
  formatAdminPlatformServiceState,
  formatRegistrationAccessLabel,
} from "../administration/admin-platform-readiness-model.js";
import { shouldDisallowSearchIndexing } from "../../lib/platform-indexing.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

function baseApi(
  overrides: Partial<AdminPlatformReadinessPublic> = {},
): AdminPlatformReadinessPublic {
  const services = {
    web: "configured" as const,
    api: "configured" as const,
    mongodb: "configured" as const,
    email: "configured" as const,
    media: "configured" as const,
    ai: "disabled" as const,
    ...overrides.services,
  };
  return {
    platformMode: "production",
    platformVersion: "0.1.0",
    registrationRequiresInvite: false,
    showBetaBanner: false,
    betaBannerMessage: "This platform is currently in limited testing.",
    publicSiteOriginConfigured: true,
    apiPublicOriginConfigured: true,
    corsOriginConfigured: true,
    cookieSecurityStatus: "external",
    emailPublicUrlConfigured: true,
    mediaPublicOriginConfigured: true,
    ...overrides,
    services,
  };
}

describe("Pack 23E.2 — Admin Platform production readiness", () => {
  it("1 — Platform route remains Admin-only", () => {
    const page = read("app/admin/platform/page.tsx");
    assert.match(page, /AdminAccessGate/);
    assert.match(page, /AdminPlatformSection/);
    const api = read("features/administration/admin-platform-readiness-api.ts");
    assert.match(api, /\/api\/v1\/admin\/platform\/readiness/);
  });

  it("2 — mode shown read-only; no settings/edit controls", () => {
    const section = read("features/administration/components/AdminPlatformSection.tsx");
    assert.match(section, /Platform mode/);
    assert.match(section, /not editable/i);
    assert.doesNotMatch(section, /<input|<select|type="checkbox"|setPlatformMode/i);
  });

  it("3 — public site origin configured/missing state", () => {
    const missing = buildAdminPlatformReadinessView(
      baseApi({ publicSiteOriginConfigured: false, platformMode: "production" }),
      { NEXT_PUBLIC_SITE_URL: "", NEXT_PUBLIC_PLATFORM_MODE: "production" },
    );
    assert.equal(missing.siteOriginConfigured, false);
    assert.ok(missing.warnings.some((w) => w.code === "production_site_origin_missing"));

    const ok = buildAdminPlatformReadinessView(baseApi(), {
      NEXT_PUBLIC_SITE_URL: "https://example.org",
      NEXT_PUBLIC_PLATFORM_MODE: "production",
    });
    assert.equal(ok.siteOriginConfigured, true);
  });

  it("4–5 — indexing actual state; beta is not automatic noindex", () => {
    assert.equal(
      shouldDisallowSearchIndexing({ NEXT_PUBLIC_PLATFORM_MODE: "beta" }),
      false,
    );
    const beta = buildAdminPlatformReadinessView(
      baseApi({ platformMode: "beta", showBetaBanner: true, registrationRequiresInvite: true }),
      { NEXT_PUBLIC_PLATFORM_MODE: "beta", NEXT_PUBLIC_SITE_URL: "https://example.org" },
    );
    assert.equal(beta.indexingMode, "beta");
    assert.equal(beta.indexingAllowed, true);
    assert.ok(beta.warnings.some((w) => w.code === "indexing_policy_attention"));
  });

  it("6 — invite-gate state shown", () => {
    assert.equal(
      formatRegistrationAccessLabel({
        platformMode: "beta",
        registrationRequiresInvite: true,
      }),
      "Invite-gated",
    );
    const section = read("features/administration/components/AdminPlatformSection.tsx");
    assert.match(section, /Invite gate/);
    assert.match(section, /registrationRequiresInvite/);
  });

  it("7–9 — email / R2 / AI service labels are safe enums", () => {
    assert.equal(formatAdminPlatformServiceState("configured"), "Configured");
    assert.equal(formatAdminPlatformServiceState("not_configured"), "Not configured");
    assert.equal(formatAdminPlatformServiceState("incomplete"), "Incomplete");
    assert.equal(formatAdminPlatformServiceState("enabled"), "Enabled");
    assert.equal(formatAdminPlatformServiceState("disabled"), "Disabled");
  });

  it("10 — no secret values exposed in API projection types or UI", () => {
    const types = readFileSync(
      path.resolve(webSrc, "../../../packages/types/src/domain/platform.ts"),
      "utf8",
    );
    const readinessBlock = types.slice(
      types.indexOf("AdminPlatformReadinessPublic"),
      types.indexOf("PlatformSocialNetworkId"),
    );
    assert.match(types, /AdminPlatformReadinessPublic/);
    assert.doesNotMatch(readinessBlock, /apiKey|SMTP_PASSWORD|R2_SECRET|mongodb\+srv|JWT_/i);
    assert.doesNotMatch(readinessBlock, /:\s*string;\s*\/\/.*(password|secret|key)/i);

    const service = readFileSync(
      path.resolve(
        webSrc,
        "../../../apps/api/src/modules/closed-beta/admin-platform-readiness.service.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(service, /apiKey:\s*config\.apiKey/);
    assert.doesNotMatch(service, /return \{[^}]*apiKey/s);
    assert.match(service, /config\.apiKey \? "enabled"/);
  });

  it("11 — production missing-origin warning", () => {
    const view = buildAdminPlatformReadinessView(
      baseApi({ publicSiteOriginConfigured: false }),
      { NEXT_PUBLIC_SITE_URL: "", NEXT_PUBLIC_PLATFORM_MODE: "production" },
    );
    assert.equal(view.overall, "missing_configuration");
    assert.ok(view.warnings.some((w) => w.code === "production_site_origin_missing"));
  });

  it("12 — indexing inconsistency warning", () => {
    const view = buildAdminPlatformReadinessView(baseApi({ platformMode: "production" }), {
      NEXT_PUBLIC_PLATFORM_MODE: "staging",
      NEXT_PUBLIC_SITE_URL: "https://example.org",
    });
    assert.equal(view.indexingAllowed, false);
    assert.ok(
      view.warnings.some(
        (w) =>
          w.code === "production_indexing_disabled" || w.code === "indexing_policy_attention",
      ),
    );
  });

  it("13–15 — deep-links to SEO, Diagnostics, Beta Access", () => {
    const section = read("features/administration/components/AdminPlatformSection.tsx");
    assert.match(section, /href="\/admin\/seo"/);
    assert.match(section, /href="\/admin\/diagnostics"/);
    assert.match(section, /href="\/admin\/beta-access"/);

    const withEmail = buildAdminPlatformReadinessView(
      baseApi({
        platformMode: "beta",
        registrationRequiresInvite: true,
        services: {
          web: "configured",
          api: "configured",
          mongodb: "configured",
          email: "not_configured",
          media: "configured",
          ai: "disabled",
        },
      }),
      { NEXT_PUBLIC_PLATFORM_MODE: "beta", NEXT_PUBLIC_SITE_URL: "https://example.org" },
    );
    assert.equal(withEmail.registrationRequiresInvite, true);
    assert.ok(withEmail.warnings.some((w) => w.href === "/admin/diagnostics"));
    assert.ok(withEmail.warnings.some((w) => w.href === "/admin/seo"));
  });

  it("16 — no live-health duplication", () => {
    const section = read("features/administration/components/AdminPlatformSection.tsx");
    assert.match(section, /not live health/i);
    assert.doesNotMatch(section, /outbox|latency|uptime|fetchApiHealth|\/api\/v1\/health/i);
    const service = readFileSync(
      path.resolve(
        webSrc,
        "../../../apps/api/src/modules/closed-beta/admin-platform-readiness.service.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(service, /checkMongoConnection|getEmailProviderHealth|outbox/);
  });

  it("17 — no settings/edit controls", () => {
    const section = read("features/administration/components/AdminPlatformSection.tsx");
    assert.doesNotMatch(section, /Save|Update configuration|Edit mode|toggle/i);
  });

  it("18 — responsive Admin layout", () => {
    const css = read("features/administration/components/admin-platform.css");
    assert.match(css, /@media \(max-width: 640px\)/);
    assert.match(css, /grid-template-columns:\s*1fr/);
  });

  it("19 — existing Platform page still AdminAccessGate", () => {
    assert.match(read("app/admin/platform/page.tsx"), /AdminAccessGate/);
  });
});
