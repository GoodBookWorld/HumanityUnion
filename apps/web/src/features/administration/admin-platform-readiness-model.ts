/**
 * Pack 23E.2 — Web-side Admin Platform readiness view (indexing + warnings).
 * Reuses canonical SEO/indexing helpers. Never invents secret values.
 */
import type {
  AdminPlatformReadinessLevel,
  AdminPlatformReadinessPublic,
  AdminPlatformServiceConfigState,
  AdminPlatformWarningCode,
  PlatformMode,
} from "@hu/types";

import {
  resolvePlatformIndexingMode,
  shouldDisallowSearchIndexing,
  type PlatformIndexingMode,
} from "../../lib/platform-indexing";
import { resolvePublicSiteOrigin } from "../../lib/seo/public-site-url";

export interface AdminPlatformWarning {
  readonly code: AdminPlatformWarningCode;
  readonly level: Exclude<AdminPlatformReadinessLevel, "ready">;
  readonly title: string;
  readonly detail: string;
  readonly href?: string;
  readonly hrefLabel?: string;
}

export interface AdminPlatformReadinessView {
  readonly platformMode: PlatformMode;
  readonly platformVersion: string;
  readonly registrationRequiresInvite: boolean;
  readonly showBetaBanner: boolean;
  readonly betaBannerMessage: string;
  readonly siteOriginConfigured: boolean;
  readonly indexingMode: PlatformIndexingMode;
  readonly indexingAllowed: boolean;
  readonly cookieSecurityStatus: "external";
  readonly services: AdminPlatformReadinessPublic["services"];
  readonly overall: AdminPlatformReadinessLevel;
  readonly warnings: readonly AdminPlatformWarning[];
}

type ViewEnv = {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_PLATFORM_MODE?: string;
  PLATFORM_MODE?: string;
  NODE_ENV?: string;
};

export function formatAdminPlatformServiceState(
  state: AdminPlatformServiceConfigState,
  options?: { service?: "ai" | "default" },
): string {
  if (options?.service === "ai" && state === "disabled") {
    return "Disabled (optional)";
  }
  switch (state) {
    case "configured":
      return "Configured";
    case "not_configured":
      return "Not configured";
    case "incomplete":
      return "Incomplete";
    case "enabled":
      return "Enabled";
    case "disabled":
      return "Disabled";
    case "external":
      return "External deployment configuration";
    default:
      return state;
  }
}

export function formatAdminPlatformReadinessLevel(
  level: AdminPlatformReadinessLevel,
): string {
  switch (level) {
    case "ready":
      return "Ready";
    case "attention":
      return "Attention";
    case "missing_configuration":
      return "Missing configuration";
    default:
      return level;
  }
}

export function formatRegistrationAccessLabel(input: {
  platformMode: PlatformMode;
  registrationRequiresInvite: boolean;
}): string {
  if (input.registrationRequiresInvite) {
    return "Invite-gated";
  }
  if (input.platformMode === "production") {
    return "Public registration";
  }
  if (input.platformMode === "beta") {
    return "Restricted";
  }
  return "Open (development)";
}

/**
 * Compose API readiness with canonical Web indexing / site-origin helpers.
 */
export function buildAdminPlatformReadinessView(
  api: AdminPlatformReadinessPublic,
  env: ViewEnv = process.env,
): AdminPlatformReadinessView {
  const siteOrigin = resolvePublicSiteOrigin(env);
  const siteOriginConfigured = Boolean(siteOrigin) || api.publicSiteOriginConfigured;
  const indexingMode = resolvePlatformIndexingMode(env);
  const indexingAllowed = !shouldDisallowSearchIndexing(env);

  const warnings: AdminPlatformWarning[] = [];

  if (api.platformMode === "production" && !siteOriginConfigured) {
    warnings.push({
      code: "production_site_origin_missing",
      level: "missing_configuration",
      title: "Public site origin missing",
      detail:
        "Production mode requires NEXT_PUBLIC_SITE_URL (and related public origins) for canonical links, sitemap, email deep links, and PWA install.",
      href: "/admin/seo",
      hrefLabel: "Open SEO",
    });
  }

  if (api.platformMode === "production" && !indexingAllowed) {
    warnings.push({
      code: "production_indexing_disabled",
      level: "attention",
      title: "Indexing unexpectedly disabled",
      detail:
        "Platform mode is production but search indexing is currently disallowed. Confirm NEXT_PUBLIC_PLATFORM_MODE matches the intended launch policy.",
      href: "/admin/seo",
      hrefLabel: "Open SEO",
    });
  }

  // beta remains indexable by policy — surface as attention, not auto-noindex.
  if (indexingMode === "beta" && indexingAllowed && api.platformMode === "beta") {
    warnings.push({
      code: "indexing_policy_attention",
      level: "attention",
      title: "Beta mode is currently indexable",
      detail:
        "Indexing policy does not treat beta as noindex. Confirm this matches the intended public visibility before domain cutover.",
      href: "/admin/seo",
      hrefLabel: "Open SEO",
    });
  }

  if (
    api.platformMode === "production" &&
    indexingMode !== "production" &&
    indexingMode !== "beta"
  ) {
    warnings.push({
      code: "indexing_policy_attention",
      level: "attention",
      title: "Indexing mode inconsistent with production",
      detail: `API platform mode is production while Web indexing mode is “${indexingMode}”. Align PLATFORM_MODE and NEXT_PUBLIC_PLATFORM_MODE for cutover.`,
      href: "/admin/seo",
      hrefLabel: "Open SEO",
    });
  }

  if (api.platformMode !== "development" && api.services.email === "not_configured") {
    warnings.push({
      code: "email_not_configured",
      level: "missing_configuration",
      title: "Email provider not configured",
      detail:
        "Deployed platforms need a real email provider for registration and security codes. Configure SMTP/Resend via deployment environment.",
      href: "/admin/diagnostics",
      hrefLabel: "Open Diagnostics",
    });
  }

  if (api.platformMode !== "development" && api.services.media === "incomplete") {
    warnings.push({
      code: "media_incomplete",
      level: "attention",
      title: "Media / R2 configuration incomplete",
      detail:
        "Public media storage is incomplete for this deployment. Prefer R2 with a public origin before production media uploads.",
      href: "/admin/diagnostics",
      hrefLabel: "Open Diagnostics",
    });
  }

  if (api.platformMode === "production" && !api.apiPublicOriginConfigured) {
    warnings.push({
      code: "api_public_origin_missing",
      level: "attention",
      title: "API public origin not set",
      detail:
        "API_PUBLIC_URL is missing. Set it in deployment configuration for absolute API callbacks and operational links.",
      href: "/admin/diagnostics",
      hrefLabel: "Open Diagnostics",
    });
  }

  if (api.platformMode === "production" && !api.corsOriginConfigured) {
    warnings.push({
      code: "cors_origin_missing",
      level: "attention",
      title: "CORS / Web origin not set",
      detail:
        "CORS_ORIGIN or WEB_ORIGIN is missing. Browser credentialed auth requires an explicit allowlist (never *).",
      href: "/admin/diagnostics",
      hrefLabel: "Open Diagnostics",
    });
  }

  let overall: AdminPlatformReadinessLevel = "ready";
  if (warnings.some((item) => item.level === "missing_configuration")) {
    overall = "missing_configuration";
  } else if (warnings.length > 0) {
    overall = "attention";
  }

  const services = {
    ...api.services,
    // Prefer Web-canonical site origin for the Web chip when available.
    web: siteOriginConfigured
      ? ("configured" as const)
      : api.services.web === "configured"
        ? ("configured" as const)
        : ("incomplete" as const),
  };

  return {
    platformMode: api.platformMode,
    platformVersion: api.platformVersion,
    registrationRequiresInvite: api.registrationRequiresInvite,
    showBetaBanner: api.showBetaBanner,
    betaBannerMessage: api.betaBannerMessage,
    siteOriginConfigured,
    indexingMode,
    indexingAllowed,
    cookieSecurityStatus: api.cookieSecurityStatus,
    services,
    overall,
    warnings,
  };
}
