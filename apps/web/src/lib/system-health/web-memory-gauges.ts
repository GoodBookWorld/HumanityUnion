/**
 * Process-wide counters for the Web memory sampler.
 * Stored on globalThis so a duplicated server module still shares one set of integers.
 * Values are counts only. No paths, locales, or identifiers.
 */

const ACTIVE_SITEMAP_BUILDS_KEY = "__huActiveSitemapBuilds";
const SEO_OPERATION_GAUGES_KEY = "__huSeoOperationGauges";

interface SeoOperationGauges {
  metadata: number;
  eligibility: number;
}

export interface WebWorkloadGauges {
  readonly activeSitemapBuilds: number;
  readonly activeSeoMetadataOperations: number;
  readonly activeSeoEligibilityOperations: number;
}

function seoGauges(): SeoOperationGauges {
  const host = globalThis as unknown as Record<string, SeoOperationGauges | undefined>;
  const existing = host[SEO_OPERATION_GAUGES_KEY];
  if (existing) {
    return existing;
  }
  const created: SeoOperationGauges = { metadata: 0, eligibility: 0 };
  host[SEO_OPERATION_GAUGES_KEY] = created;
  return created;
}

function nonNegativeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

export function publishActiveSitemapBuilds(count: number): void {
  (globalThis as unknown as Record<string, number>)[ACTIVE_SITEMAP_BUILDS_KEY] = nonNegativeCount(count);
}

export function readActiveSitemapBuilds(): number {
  const value = (globalThis as unknown as Record<string, unknown>)[ACTIVE_SITEMAP_BUILDS_KEY];
  return typeof value === "number" ? nonNegativeCount(value) : 0;
}

function adjust(field: keyof SeoOperationGauges, delta: number): void {
  const gauges = seoGauges();
  gauges[field] = nonNegativeCount(gauges[field] + delta);
}

export function enterSeoMetadataOperation(): void {
  adjust("metadata", 1);
}

export function leaveSeoMetadataOperation(): void {
  adjust("metadata", -1);
}

export function enterSeoEligibilityOperation(): void {
  adjust("eligibility", 1);
}

export function leaveSeoEligibilityOperation(): void {
  adjust("eligibility", -1);
}

export function readWebWorkloadGauges(): WebWorkloadGauges {
  const gauges = seoGauges();
  return {
    activeSitemapBuilds: readActiveSitemapBuilds(),
    activeSeoMetadataOperations: nonNegativeCount(gauges.metadata),
    activeSeoEligibilityOperations: nonNegativeCount(gauges.eligibility),
  };
}

export function resetSeoOperationGaugesForTests(): void {
  const gauges = seoGauges();
  gauges.metadata = 0;
  gauges.eligibility = 0;
  publishActiveSitemapBuilds(0);
}
