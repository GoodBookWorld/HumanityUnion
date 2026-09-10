/**
 * Localization Authority Closure 05 — PLP auto-build locale targets.
 *
 * Authoritative product policy: Language Registry
 *   enabled === true AND contentTranslationEnabled === true
 * (same rule as CT warm targets). SEO/search flags do not control builds.
 *
 * HU_PLP_AUTO_BUILD_LOCALES is an optional OPS LIMITER only:
 * - unset / empty after trim → no limiter (use full Registry targets)
 * - set → intersect with Registry (can only narrow; cannot invent locales)
 * - NEVER the sole product allowlist
 *
 * Kill switch for the processor remains HU_PLP_AUTO_BUILD_PROCESSOR=0.
 */

import { listAutomaticContentTranslationTargetLocales } from "../../content-translation-warm-targets.js";
import { recordPlpAutoBuildMutationNotification } from "./plp-auto-build-runtime.js";

export type PlpAutoBuildLocaleResolution = {
  /** Final auto-build targets after Registry ∩ optional ops limiter. */
  readonly locales: readonly string[];
  /** Registry enabled ∩ contentTranslationEnabled (excluding en). */
  readonly registryTargets: readonly string[];
  /**
   * Ops limiter from HU_PLP_AUTO_BUILD_LOCALES when set; null when unset
   * (no limiter). Empty array means env was set but parsed to nothing.
   */
  readonly opsLimiter: readonly string[] | null;
  readonly opsLimiterActive: boolean;
};

/**
 * Parse HU_PLP_AUTO_BUILD_LOCALES as an optional ops limiter.
 * Returns null when the env var is unset (no limiter).
 */
export function parsePlpAutoBuildLocaleOpsLimiter(): readonly string[] | null {
  const raw = process.env.HU_PLP_AUTO_BUILD_LOCALES;
  if (raw === undefined) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Authoritative PLP / Media HU-owned auto-build target locales.
 * Registry-driven; future Admin-enabled languages appear without code changes.
 */
export async function resolvePlpAutoBuildLocales(input?: {
  readonly excludeSourceLanguage?: string | null;
}): Promise<readonly string[]> {
  const resolved = await resolvePlpAutoBuildLocaleResolution(input);
  return resolved.locales;
}

export async function resolvePlpAutoBuildLocaleResolution(input?: {
  readonly excludeSourceLanguage?: string | null;
}): Promise<PlpAutoBuildLocaleResolution> {
  const exclude =
    input?.excludeSourceLanguage === undefined
      ? "en"
      : input.excludeSourceLanguage;
  const registryTargets = [
    ...(await listAutomaticContentTranslationTargetLocales({
      excludeSourceLanguage: exclude,
    })),
  ];
  const opsLimiter = parsePlpAutoBuildLocaleOpsLimiter();
  if (opsLimiter === null) {
    return {
      locales: registryTargets,
      registryTargets,
      opsLimiter: null,
      opsLimiterActive: false,
    };
  }
  if (opsLimiter.length === 0) {
    return {
      locales: [],
      registryTargets,
      opsLimiter,
      opsLimiterActive: true,
    };
  }
  const allowed = new Set(opsLimiter.map((locale) => locale.toLowerCase()));
  const locales = registryTargets.filter((locale) =>
    allowed.has(locale.toLowerCase()),
  );
  return {
    locales,
    registryTargets,
    opsLimiter,
    opsLimiterActive: true,
  };
}

/**
 * Assert a queued PLP locale is Registry-eligible for content translation.
 * Prevents provider calls for Admin-disabled / CT-disabled locales.
 */
export async function assertPlpAutoBuildLocaleEligible(
  locale: string,
): Promise<boolean> {
  const targets = await listAutomaticContentTranslationTargetLocales({
    excludeSourceLanguage: "en",
  });
  const needle = locale.trim().toLowerCase();
  return targets.some((row) => row.toLowerCase() === needle);
}

/**
 * Fire-and-forget PLP mutation notification.
 * Reset 01 — public_news is not enqueued per-item here (would unbounded-fan-out).
 * RSS title/summary PLP builds use enqueueConsumerVisibleNewsPlpBuilds after refresh.
 */
export function notifyPlpPublicSourceMutation(input: {
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly canonicalVersion?: string;
}): void {
  recordPlpAutoBuildMutationNotification();
  void input.sourceRecordId;
  void input.canonicalVersion;
  // No automatic per-record enqueue. Media HU-owned entities use publication
  // hooks; public_news uses the bounded carousel collection trigger only.
}
