/**
 * RESET 04 — bridge public mutations → PLP build enqueue (no provider).
 *
 * Locales come from HU_PLP_AUTO_BUILD_LOCALES (comma-separated) when set;
 * otherwise enqueue is skipped (safe default — no uncontrolled fanout).
 */

import { enqueuePublicNewsArticlePlpBuild } from "./news-consumer-build-trigger.js";

function resolveAutoBuildLocales(): readonly string[] {
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
  const locales = resolveAutoBuildLocales();
  if (locales.length === 0) {
    return;
  }
  enqueuePublicNewsArticlePlpBuild({
    articleId: input.sourceRecordId,
    canonicalVersion: input.canonicalVersion,
    locales,
  });
}
