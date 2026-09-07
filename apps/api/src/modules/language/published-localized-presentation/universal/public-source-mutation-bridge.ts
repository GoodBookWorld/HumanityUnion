/**
 * RESET 04 / 05C — bridge public mutations → PLP build enqueue (no provider await).
 *
 * Locales come from HU_PLP_AUTO_BUILD_LOCALES (comma-separated) when set;
 * otherwise enqueue is skipped (safe default — no uncontrolled fanout).
 * This remains the safety allowlist for automatic News PLP builds.
 */

import { enqueuePublicNewsArticlePlpBuild } from "./news-consumer-build-trigger.js";

/**
 * Safety allowlist for automatic PLP builds.
 * Empty ⇒ no fanout (enqueue skipped). Comma-separated Registry locales.
 */
export function resolvePlpAutoBuildLocales(): readonly string[] {
  const raw = process.env.HU_PLP_AUTO_BUILD_LOCALES?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Fire-and-forget PLP enqueue for supported source kinds.
 * Requires canonicalVersion + HU_PLP_AUTO_BUILD_LOCALES to enqueue News.
 */
export function notifyPlpPublicSourceMutation(input: {
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly canonicalVersion?: string;
}): void {
  if (input.sourceKind !== "public_news") {
    return;
  }
  if (!input.canonicalVersion?.trim()) {
    return;
  }
  const locales = resolvePlpAutoBuildLocales();
  if (locales.length === 0) {
    return;
  }
  enqueuePublicNewsArticlePlpBuild({
    articleId: input.sourceRecordId,
    canonicalVersion: input.canonicalVersion,
    locales,
  });
}
