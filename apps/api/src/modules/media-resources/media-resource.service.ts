import { randomUUID } from "node:crypto";

import { getCountryByCode, normalizeCountryInput } from "@hu/geography";
import type {
  AdminNewsSourceHealthItem,
  AdminNewsSourceHealthListing,
  FactCheckResource,
  MediaResource,
  MediaResourceScopeType,
  MediaResourceType,
  NewsFeedDiscoveryCandidate,
  NewsFeedDiscoveryResult,
  PropagandaAnalysisResource,
  PublicCountryNewsSource,
  TrustedMediaCategoryId,
  TrustedMediaResource,
} from "@hu/types";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { AuditService } from "../administration/audit.service.js";
import {
  MediaResourceConflictError,
  MediaResourceNotFoundError,
  MediaResourceValidationError,
} from "./media-resource.errors.js";
import {
  projectApprovedNewsSources,
  projectFactCheckResources,
  projectPropagandaAnalysisResources,
  projectPublicCountryNewsSources,
  projectTrustedMediaResources,
  resolveNewsSourceLanguage,
} from "./media-resource.projections.js";
import {
  acquireNewsFeedDiscoverySlot,
  checkNewsFeedCandidate,
  discoverNewsSourceFeeds,
  parseHttpsDiscoveryUrl,
  verifyNewsFeedForConfirmation,
} from "../public-news/public-news-feed-discovery.js";
import { resolveNewsSourceHealthStatus } from "../public-news/public-news-source-health.js";
import {
  checkNewsSectionUrl,
  MAX_ARTICLE_DOMAINS,
  normalizeApprovedDomain,
} from "../public-news/public-news-source-trust.js";
import { listPublicNewsSourceHealth } from "../public-news/public-news-source-health.repository.js";
import { resolvePublicNewsConfig } from "../public-news/public-news.config.js";
import { findActivePublicNewsRecords } from "../public-news/public-news.repository.js";
import { seedMediaResourcesFromCanonicalSources } from "./media-resource.seed.js";
import { recordMediaResourceTombstone } from "./persistence/media-resource-tombstone.repository.js";
import {
  deleteMediaResource,
  getMediaResourceByIdentity,
  listMediaResources,
  listMediaResourcesByPublisherId,
  upsertMediaResource,
  type ListMediaResourcesFilter,
} from "./persistence/media-resource.repository.js";

const TRUSTED_CATEGORY_IDS = new Set<TrustedMediaCategoryId>([
  "international-wire-service",
  "public-broadcaster",
  "independent-investigative",
  "regional-public-media",
  "scientific-publisher",
  "academic-resource",
]);

const RESOURCE_TYPES = new Set<MediaResourceType>([
  "TRUSTED_MEDIA",
  "NEWS_SOURCE",
  "FACT_CHECKING",
  "PROPAGANDA_ANALYSIS",
]);

let seedPromise: Promise<void> | null = null;
let adminAssertOverrideForTests:
  | ((userId: string) => Promise<{ userId: string; memberId: string }>)
  | null = null;

export function resetMediaResourceSeedStateForTests(): void {
  seedPromise = null;
}

export function setMediaResourceAdminAssertOverrideForTests(
  override:
    | ((userId: string) => Promise<{ userId: string; memberId: string }>)
    | null,
): void {
  adminAssertOverrideForTests = override;
}

async function refreshNewsSourceCacheBestEffort(): Promise<void> {
  try {
    const { refreshApprovedNewsSourcesFromMediaResources } = await import(
      "../public-news/public-news.config.js"
    );
    await refreshApprovedNewsSourcesFromMediaResources();
  } catch {
    // Cache refresh must not block admin/public flows.
  }
}

export async function ensureMediaResourcesSeededOnce(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      await seedMediaResourcesFromCanonicalSources();
      await refreshNewsSourceCacheBestEffort();
    })();
  }
  await seedPromise;
}

async function assertAdminUser(userId: string): Promise<{
  userId: string;
  memberId: string;
}> {
  if (adminAssertOverrideForTests) {
    return adminAssertOverrideForTests(userId);
  }
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  const user = await findAuthUserById(userId);
  if (!user || user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  return { userId: user.userId, memberId: user.memberId };
}

async function assertMediaMutationActor(
  userId: string,
  content: { scopeType: MediaResourceScopeType; countryCode?: string | null },
): Promise<{ userId: string; memberId: string }> {
  if (adminAssertOverrideForTests) {
    return adminAssertOverrideForTests(userId);
  }
  const { assertAdminOrEditorCanMutate } = await import("../editor-grants/editor-grant.dual-auth.js");
  const { mediaResourceContentGeography, mediaResourceCompatibleWithEditorScope } = await import(
    "../editor-grants/editor-content-geography.js"
  );
  const { findEditorGrantByParticipantId } = await import(
    "../editor-grants/editor-grant.repository.js"
  );
  const { findAuthUserById: findUser } = await import("../auth/auth-user.repository.js");

  const actor = await assertAdminOrEditorCanMutate({
    actorUserId: userId,
    capability: "MEDIA_RESOURCE_EDIT",
    content: mediaResourceContentGeography(content),
  });

  if (actor.authority === "editor") {
    const user = await findUser(userId);
    const grant = user ? await findEditorGrantByParticipantId(user.memberId) : null;
    if (
      !grant ||
      !mediaResourceCompatibleWithEditorScope(grant.geographicScope, content)
    ) {
      throw new AdministrationForbiddenError(
        "You do not have Editor permission for this content.",
      );
    }
  }

  return { userId: actor.userId, memberId: actor.participantId };
}

export function normalizeWebsiteHost(websiteUrl: string): string {
  try {
    return new URL(websiteUrl.trim()).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    throw new MediaResourceValidationError("websiteUrl must be a valid URL.");
  }
}

function normalizeOptionalUrl(value: string | null | undefined, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    // Accept absolute http(s) or site-relative asset paths for logos.
    if (trimmed.startsWith("/")) {
      return trimmed;
    }
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
    return trimmed;
  } catch {
    throw new MediaResourceValidationError(`${field} must be a valid URL or path.`);
  }
}

function normalizeArticleDomainsInput(
  value: unknown,
  resourceType: MediaResourceType,
): string[] | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw new MediaResourceValidationError("articleDomains must be an array of hostnames.");
  }
  if (resourceType !== "NEWS_SOURCE") {
    if (value.length > 0) {
      throw new MediaResourceValidationError(
        "articleDomains is only allowed for NEWS_SOURCE resources.",
      );
    }
    return null;
  }
  if (value.length > MAX_ARTICLE_DOMAINS) {
    throw new MediaResourceValidationError(
      `articleDomains may contain at most ${MAX_ARTICLE_DOMAINS} hostnames.`,
    );
  }
  const domains: string[] = [];
  for (const entry of value) {
    const normalized = typeof entry === "string" ? normalizeApprovedDomain(entry) : null;
    if (!normalized) {
      throw new MediaResourceValidationError(
        "articleDomains must contain public hostnames such as news.example.org.",
      );
    }
    if (!domains.includes(normalized)) {
      domains.push(normalized);
    }
  }
  return domains.length > 0 ? domains : null;
}

/** NEWS_SOURCE only; `null`/empty clears it. Must be on the source's approved domains. */
function normalizeNewsSectionUrlInput(
  value: unknown,
  resourceType: MediaResourceType,
  source: Pick<MediaResource, "websiteUrl" | "providerId" | "articleDomains">,
): string | null {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
    return null;
  }
  if (typeof value !== "string") {
    throw new MediaResourceValidationError("News Section URL must be a valid https:// address.");
  }
  if (resourceType !== "NEWS_SOURCE") {
    throw new MediaResourceValidationError(
      "News Section URL is only allowed for NEWS_SOURCE resources.",
    );
  }
  const checked = checkNewsSectionUrl(value, source);
  if (!checked.ok) {
    throw new MediaResourceValidationError(checked.message);
  }
  return checked.url;
}

function assertScopeInvariant(
  scopeType: MediaResourceScopeType,
  countryCode: string | null,
): string | null {
  if (scopeType === "WORLD") {
    if (countryCode !== null && countryCode !== undefined && String(countryCode).trim()) {
      throw new MediaResourceValidationError("WORLD scope requires countryCode to be null.");
    }
    return null;
  }

  const normalized = normalizeCountryInput(countryCode ?? "");
  if (!normalized) {
    throw new MediaResourceValidationError("COUNTRY scope requires a valid countryCode.");
  }
  const country = getCountryByCode(normalized);
  if (!country) {
    throw new MediaResourceValidationError(`Unknown countryCode: ${normalized}.`);
  }
  return normalized;
}

function assertResourceType(value: string): MediaResourceType {
  if (!RESOURCE_TYPES.has(value as MediaResourceType)) {
    throw new MediaResourceValidationError(`Unsupported resourceType: ${value}.`);
  }
  return value as MediaResourceType;
}

async function assertNoDuplicate(input: {
  id?: string;
  resourceType: MediaResourceType;
  scopeType: MediaResourceScopeType;
  countryCode: string | null;
  websiteUrl: string;
  rssUrl?: string | null;
}): Promise<void> {
  const host = normalizeWebsiteHost(input.websiteUrl);
  const rssNormalized =
    input.resourceType === "NEWS_SOURCE" && input.rssUrl
      ? input.rssUrl.trim().toLowerCase().replace(/\/$/, "")
      : null;

  const candidates = await listMediaResources({
    resourceType: input.resourceType,
    scopeType: input.scopeType,
    countryCode: input.countryCode,
  });

  for (const candidate of candidates) {
    if (input.id && candidate.id === input.id) {
      continue;
    }
    let candidateHost = "";
    try {
      candidateHost = normalizeWebsiteHost(candidate.websiteUrl);
    } catch {
      continue;
    }
    if (candidateHost !== host) {
      continue;
    }
    if (input.resourceType === "NEWS_SOURCE") {
      const candidateRss = candidate.rssUrl?.trim().toLowerCase().replace(/\/$/, "") ?? null;
      if (candidateRss === rssNormalized) {
        throw new MediaResourceConflictError(
          "A media resource with the same website and RSS feed already exists for this scope.",
        );
      }
      continue;
    }
    throw new MediaResourceConflictError(
      "A media resource with the same website already exists for this scope.",
    );
  }
}

/**
 * Production Completion Pack 01 — max COUNTRY TRUSTED_MEDIA resources per country.
 * Public projection and create/update enforcement share this constant.
 * Legacy rows above the limit are retained; public lists cap deterministically.
 */
export const COUNTRY_TRUSTED_MEDIA_MAX = 12;

function summarizeResource(resource: MediaResource): string {
  return `${resource.resourceType}:${resource.scopeType}:${resource.name}:${resource.active ? "active" : "inactive"}`;
}

async function assertCountryTrustedMediaCapacity(input: {
  countryCode: string;
  excludeId?: string;
  /** True when this mutation adds a new COUNTRY TRUSTED_MEDIA occupancy. */
  isNewOccupancy: boolean;
}): Promise<void> {
  if (!input.isNewOccupancy) {
    return;
  }
  const existing = await listMediaResources({
    resourceType: "TRUSTED_MEDIA",
    scopeType: "COUNTRY",
    countryCode: input.countryCode,
  });
  const others = existing.filter((row) => row.id !== input.excludeId);
  if (others.length >= COUNTRY_TRUSTED_MEDIA_MAX) {
    throw new MediaResourceValidationError(
      `A country may have at most ${COUNTRY_TRUSTED_MEDIA_MAX} trusted media resources. Remove an existing entry before adding another. Legacy over-limit entries are retained but new creates are blocked.`,
    );
  }
}

export interface AdminMediaResourceCreateInput {
  actorUserId: string;
  resourceType: MediaResourceType;
  scopeType: MediaResourceScopeType;
  countryCode?: string | null;
  name: string;
  logoLabel: string;
  logoUrl?: string | null;
  websiteUrl: string;
  rssUrl?: string | null;
  categoryId?: string | null;
  description?: string | null;
  secondaryText?: string | null;
  language?: string | null;
  providerId?: string | null;
  articleDomains?: string[] | null;
  newsSectionUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
  id?: string;
}

export interface AdminMediaResourceUpdateInput {
  actorUserId: string;
  id: string;
  resourceType?: MediaResourceType;
  scopeType?: MediaResourceScopeType;
  countryCode?: string | null;
  name?: string;
  logoLabel?: string;
  logoUrl?: string | null;
  websiteUrl?: string;
  rssUrl?: string | null;
  categoryId?: string | null;
  description?: string | null;
  secondaryText?: string | null;
  language?: string | null;
  providerId?: string | null;
  articleDomains?: string[] | null;
  newsSectionUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
}

/** RSS-HEALTH-01 — bounds for the read-only News / RSS health listing. */
export const NEWS_HEALTH_MAX_ITEMS = 200;
export const NEWS_HEALTH_PUBLIC_COUNT_CAP = 50;
const NEWS_HEALTH_COUNT_CONCURRENCY = 8;

/**
 * Public article count per resource (exact current name or its MediaResource id) in
 * the source's own language, capped; the same selection the public news API uses
 * with `language=<source language>`. Keyed by resource id.
 */
async function countPublicArticlesByResource(
  resources: readonly MediaResource[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (let index = 0; index < resources.length; index += NEWS_HEALTH_COUNT_CONCURRENCY) {
    const batch = resources.slice(index, index + NEWS_HEALTH_COUNT_CONCURRENCY);
    const results = await Promise.all(
      batch.map((resource) =>
        findActivePublicNewsRecords({
          limit: NEWS_HEALTH_PUBLIC_COUNT_CAP,
          language: resolveNewsSourceLanguage(resource),
          sources: [resource.name],
          sourceIds: [resource.id],
        }),
      ),
    );
    batch.forEach((resource, position) => counts.set(resource.id, results[position]!.length));
  }
  return counts;
}

export async function listAdminNewsSourceHealth(input: {
  actorUserId: string;
  active?: boolean;
  now?: Date;
}): Promise<AdminNewsSourceHealthListing> {
  await assertAdminUser(input.actorUserId);
  await ensureMediaResourcesSeededOnce();

  const config = resolvePublicNewsConfig();
  const now = input.now ?? new Date();
  const staleAfterMs = config.refreshIntervalHours * 2 * 3_600_000;
  const resources = (
    await listMediaResources({
      resourceType: "NEWS_SOURCE",
      ...(input.active !== undefined ? { active: input.active } : {}),
    })
  ).sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const selected = resources.slice(0, NEWS_HEALTH_MAX_ITEMS);

  const [health, publicCounts] = await Promise.all([
    listPublicNewsSourceHealth(selected.map((resource) => resource.id)),
    countPublicArticlesByResource(selected),
  ]);

  const items = selected.map((resource): AdminNewsSourceHealthItem => {
    const record = health.get(resource.id) ?? null;
    const publicArticleCount = publicCounts.get(resource.id) ?? 0;
    const { status, statusReason } = resolveNewsSourceHealthStatus({
      record,
      publicArticleCount,
      now: now.getTime(),
      staleAfterMs,
      retentionDays: config.retentionDays,
    });
    return {
      mediaResourceId: resource.id,
      name: resource.name,
      active: resource.active,
      scopeType: resource.scopeType,
      countryCode: resource.countryCode,
      providerId: resource.providerId ?? null,
      status,
      statusReason,
      publicArticleCount,
      publicArticleCountCapped: publicArticleCount >= NEWS_HEALTH_PUBLIC_COUNT_CAP,
      lastCheckCompletedAt: record?.lastCheckCompletedAt ?? null,
      lastSuccessAt: record?.lastSuccessAt ?? null,
      lastOutcome: record?.lastOutcome ?? null,
      lastHttpStatus: record?.lastHttpStatus ?? null,
      lastDurationMs: record?.lastDurationMs ?? null,
      lastParsedCount: record?.lastParsedCount ?? null,
      lastAcceptedCount: record?.lastAcceptedCount ?? null,
      lastRejectedCount: record?.lastRejectedCount ?? null,
      lastRejectionReasons: record?.lastRejectionReasons ?? {},
      lastStoredSourceNames: record?.lastStoredSourceNames ?? [],
      lastItemPublishedAt: record?.lastItemPublishedAt ?? null,
      lastError: record?.lastError ?? null,
      consecutiveFailures: record?.consecutiveFailures ?? 0,
    };
  });

  return {
    items,
    generatedAt: now.toISOString(),
    staleAfterHours: config.refreshIntervalHours * 2,
    retentionDays: config.retentionDays,
    publicArticleCountCap: NEWS_HEALTH_PUBLIC_COUNT_CAP,
    truncated: resources.length > selected.length,
  };
}

/**
 * RSS-SOURCE-02C — discovers official RSS/Atom feeds for a NEWS_SOURCE website.
 * Read-only: nothing is saved, and source health telemetry is not touched.
 */
export async function discoverAdminNewsSourceFeeds(input: {
  actorUserId: string;
  websiteUrl?: string;
  /** Omitted: the saved section (existing source); empty: none (discover the website). */
  newsSectionUrl?: string | null;
  mediaResourceId?: string;
}): Promise<NewsFeedDiscoveryResult> {
  const admin = await assertAdminUser(input.actorUserId);
  await ensureMediaResourcesSeededOnce();

  const existing = input.mediaResourceId?.trim()
    ? await loadMediaResourceByIdentity({
        id: input.mediaResourceId.trim(),
        resourceType: "NEWS_SOURCE",
      })
    : null;
  const websiteUrl = input.websiteUrl?.trim() || existing?.websiteUrl || "";
  if (!parseHttpsDiscoveryUrl(websiteUrl)) {
    throw new MediaResourceValidationError(
      "Enter the source's website as an https:// address to discover its RSS feed.",
    );
  }

  const source = {
    websiteUrl,
    providerId: existing?.providerId ?? null,
    articleDomains: existing?.articleDomains ?? null,
  };
  const sectionInput =
    input.newsSectionUrl !== undefined ? input.newsSectionUrl : (existing?.newsSectionUrl ?? null);
  let newsSectionUrl: string | null = null;
  if (sectionInput?.trim()) {
    const checked = checkNewsSectionUrl(sectionInput, source);
    if (!checked.ok) {
      throw new MediaResourceValidationError(checked.message);
    }
    newsSectionUrl = checked.url;
  }

  const release = acquireNewsFeedDiscoverySlot(admin.userId);
  try {
    return await discoverNewsSourceFeeds({
      ...source,
      newsSectionUrl,
      currentRssUrl: existing?.rssUrl ?? null,
    });
  } finally {
    release();
  }
}

/**
 * Saves an Admin-confirmed feed as the NEWS_SOURCE RSS URL through the existing
 * update path (all other settings unchanged). The feed is verified again first; a
 * working saved feed is only replaced with `replaceWorkingFeed`. With a news section,
 * a feed not classified `section_match` needs `acceptSectionMismatch`. No refresh runs.
 */
export async function confirmAdminNewsSourceFeed(input: {
  actorUserId: string;
  id: string;
  feedUrl: string;
  expectedCurrentRssUrl: string | null;
  /** The news section the Admin discovered with; a changed section invalidates the result. */
  expectedNewsSectionUrl?: string | null;
  replaceWorkingFeed?: boolean;
  acceptSectionMismatch?: boolean;
}): Promise<{ resource: MediaResource; candidate: NewsFeedDiscoveryCandidate }> {
  const admin = await assertAdminUser(input.actorUserId);
  await ensureMediaResourcesSeededOnce();

  const existing = await loadMediaResourceByIdentity({ id: input.id, resourceType: "NEWS_SOURCE" });
  const feedUrl = parseHttpsDiscoveryUrl(input.feedUrl ?? "")?.toString();
  if (!feedUrl) {
    throw new MediaResourceValidationError("Only an https:// RSS or Atom feed can be confirmed.");
  }
  const currentRssUrl = existing.rssUrl?.trim() || null;
  if (currentRssUrl !== (input.expectedCurrentRssUrl?.trim() || null)) {
    throw new MediaResourceConflictError(
      "This source's RSS URL changed since discovery. Run Discover RSS again.",
    );
  }
  const newsSectionUrl = existing.newsSectionUrl?.trim() || null;
  if (newsSectionUrl !== (input.expectedNewsSectionUrl?.trim() || null)) {
    throw new MediaResourceConflictError(
      "This source's News Section URL changed since discovery. Run Discover RSS again.",
    );
  }

  const release = acquireNewsFeedDiscoverySlot(admin.userId);
  let candidate: NewsFeedDiscoveryCandidate;
  try {
    const context = {
      websiteUrl: existing.websiteUrl,
      providerId: existing.providerId ?? null,
      articleDomains: existing.articleDomains ?? null,
    };
    candidate = await verifyNewsFeedForConfirmation({ feedUrl, context, newsSectionUrl });
    if (!candidate.valid) {
      throw new MediaResourceValidationError(
        `The selected feed could not be verified. ${candidate.message ?? ""}`.trim(),
      );
    }
    if (
      newsSectionUrl &&
      candidate.sectionMatch !== "section_match" &&
      !input.acceptSectionMismatch
    ) {
      throw new MediaResourceConflictError(
        "This feed is not confirmed as specific to the news section, so unrelated news may appear. Confirm explicitly to use it.",
      );
    }
    if (currentRssUrl === feedUrl) {
      return { resource: existing, candidate };
    }
    if (currentRssUrl && !input.replaceWorkingFeed) {
      const current = await checkNewsFeedCandidate(currentRssUrl, context);
      if (current.valid) {
        throw new MediaResourceConflictError(
          "The current RSS feed is working. Confirm explicitly to replace it.",
        );
      }
    }
  } finally {
    release();
  }

  const resource = await updateAdminMediaResource({
    actorUserId: input.actorUserId,
    id: existing.id,
    resourceType: "NEWS_SOURCE",
    rssUrl: feedUrl,
  });
  return { resource, candidate };
}

export async function listAdminMediaResources(input: {
  actorUserId: string;
  resourceType?: MediaResourceType;
  scopeType?: MediaResourceScopeType;
  countryCode?: string;
  active?: boolean;
}): Promise<MediaResource[]> {
  await assertAdminUser(input.actorUserId);
  await ensureMediaResourcesSeededOnce();

  const filter: ListMediaResourcesFilter = {};
  if (input.resourceType) {
    filter.resourceType = input.resourceType;
  }
  if (input.scopeType) {
    filter.scopeType = input.scopeType;
  }
  if (input.countryCode !== undefined) {
    const normalized = normalizeCountryInput(input.countryCode);
    if (!normalized) {
      throw new MediaResourceValidationError("Invalid countryCode filter.");
    }
    filter.countryCode = normalized;
  }
  if (input.active !== undefined) {
    filter.active = input.active;
  }

  return listMediaResources(filter);
}

async function loadMediaResourceByIdentity(input: {
  id: string;
  resourceType?: MediaResourceType;
}): Promise<MediaResource> {
  if (input.resourceType) {
    const resource = await getMediaResourceByIdentity({
      resourceType: input.resourceType,
      id: input.id,
    });
    if (!resource) {
      throw new MediaResourceNotFoundError();
    }
    return resource;
  }

  const matches = await listMediaResourcesByPublisherId(input.id);
  if (matches.length === 0) {
    throw new MediaResourceNotFoundError();
  }
  if (matches.length > 1) {
    throw new MediaResourceValidationError(
      "resourceType is required when more than one media resource shares this id.",
    );
  }
  return matches[0]!;
}

export async function getAdminMediaResource(input: {
  actorUserId: string;
  id: string;
  resourceType?: MediaResourceType;
}): Promise<MediaResource> {
  await assertAdminUser(input.actorUserId);
  await ensureMediaResourcesSeededOnce();
  return loadMediaResourceByIdentity(input);
}

export async function createAdminMediaResource(
  input: AdminMediaResourceCreateInput,
): Promise<MediaResource> {
  if (input.scopeType !== "WORLD" && input.scopeType !== "COUNTRY") {
    throw new MediaResourceValidationError("scopeType must be WORLD or COUNTRY.");
  }
  const admin = await assertMediaMutationActor(input.actorUserId, {
    scopeType: input.scopeType,
    countryCode: input.countryCode ?? null,
  });
  await ensureMediaResourcesSeededOnce();

  const resourceType = assertResourceType(input.resourceType);
  const countryCode = assertScopeInvariant(input.scopeType, input.countryCode ?? null);
  const name = input.name?.trim();
  const logoLabel = input.logoLabel?.trim();
  const websiteUrl = input.websiteUrl?.trim();

  if (!name) {
    throw new MediaResourceValidationError("name is required.");
  }
  if (!logoLabel) {
    throw new MediaResourceValidationError("logoLabel is required.");
  }
  if (!websiteUrl) {
    throw new MediaResourceValidationError("websiteUrl is required.");
  }
  normalizeWebsiteHost(websiteUrl);

  const active = input.active !== false;
  const rssUrl = normalizeOptionalUrl(input.rssUrl, "rssUrl");
  if (resourceType === "NEWS_SOURCE" && active && !rssUrl) {
    throw new MediaResourceValidationError("rssUrl is required for active NEWS_SOURCE resources.");
  }
  if (resourceType !== "NEWS_SOURCE" && rssUrl) {
    throw new MediaResourceValidationError("rssUrl is only allowed for NEWS_SOURCE resources.");
  }
  const articleDomains = normalizeArticleDomainsInput(input.articleDomains, resourceType);
  const newsSectionUrl = normalizeNewsSectionUrlInput(input.newsSectionUrl, resourceType, {
    websiteUrl,
    providerId: input.providerId?.trim() || null,
    articleDomains,
  });

  let categoryId: string | null = input.categoryId?.trim() || null;
  if (resourceType === "TRUSTED_MEDIA") {
    if (!categoryId || !TRUSTED_CATEGORY_IDS.has(categoryId as TrustedMediaCategoryId)) {
      throw new MediaResourceValidationError("categoryId is required for TRUSTED_MEDIA.");
    }
  } else {
    categoryId = null;
  }

  await assertNoDuplicate({
    resourceType,
    scopeType: input.scopeType,
    countryCode,
    websiteUrl,
    rssUrl,
  });

  if (resourceType === "TRUSTED_MEDIA" && input.scopeType === "COUNTRY" && countryCode) {
    await assertCountryTrustedMediaCapacity({
      countryCode,
      isNewOccupancy: true,
    });
  }

  const now = new Date().toISOString();
  const id = input.id?.trim() || `media-resource-${randomUUID()}`;
  if (
    await getMediaResourceByIdentity({
      resourceType,
      id,
    })
  ) {
    throw new MediaResourceConflictError(
      `Media resource id already exists for ${resourceType}: ${id}.`,
    );
  }

  const resource: MediaResource = {
    id,
    resourceType,
    scopeType: input.scopeType,
    countryCode,
    name,
    logoLabel,
    logoUrl: normalizeOptionalUrl(input.logoUrl, "logoUrl"),
    websiteUrl,
    rssUrl: resourceType === "NEWS_SOURCE" ? rssUrl : null,
    categoryId,
    description: input.description?.trim() || null,
    secondaryText: input.secondaryText?.trim() || null,
    language: resourceType === "NEWS_SOURCE" ? input.language?.trim() || null : null,
    providerId: resourceType === "NEWS_SOURCE" ? input.providerId?.trim() || null : null,
    ...(articleDomains ? { articleDomains } : {}),
    ...(newsSectionUrl ? { newsSectionUrl } : {}),
    active,
    sortOrder:
      typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
        ? Math.trunc(input.sortOrder)
        : 1000,
    createdAt: now,
    updatedAt: now,
  };

  await upsertMediaResource(resource);
  await notifyTrustedCanonicalChange({
    entityId: resource.id,
    resourceType: resource.resourceType,
    hadTrustedRow: false,
    beforeDescription: null,
    afterDescription: resource.description,
  });
  await scheduleCivicMediaRecoveryIfTranslationInputChanged({
    before: null,
    after: resource,
  });
  await AuditService.record({
    actorParticipantId: admin.memberId,
    action: "media_resource.create",
    targetType: "media_resource",
    targetId: resource.id,
    afterSummary: summarizeResource(resource),
  });
  await refreshNewsSourceCacheBestEffort();
  return resource;
}

export async function updateAdminMediaResource(
  input: AdminMediaResourceUpdateInput,
): Promise<MediaResource> {
  await ensureMediaResourcesSeededOnce();

  const existing = await loadMediaResourceByIdentity({
    id: input.id,
    resourceType: input.resourceType,
  });

  const scopeType = input.scopeType ?? existing.scopeType;
  if (scopeType !== "WORLD" && scopeType !== "COUNTRY") {
    throw new MediaResourceValidationError("scopeType must be WORLD or COUNTRY.");
  }

  const countryCode = assertScopeInvariant(
    scopeType,
    input.countryCode !== undefined ? input.countryCode : existing.countryCode,
  );

  // Must authorize both existing and target geography.
  const admin = await assertMediaMutationActor(input.actorUserId, existing);
  await assertMediaMutationActor(input.actorUserId, { scopeType, countryCode });

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  const logoLabel =
    input.logoLabel !== undefined ? input.logoLabel.trim() : existing.logoLabel;
  const websiteUrl =
    input.websiteUrl !== undefined ? input.websiteUrl.trim() : existing.websiteUrl;

  if (!name) {
    throw new MediaResourceValidationError("name is required.");
  }
  if (!logoLabel) {
    throw new MediaResourceValidationError("logoLabel is required.");
  }
  if (!websiteUrl) {
    throw new MediaResourceValidationError("websiteUrl is required.");
  }
  normalizeWebsiteHost(websiteUrl);

  const active = input.active !== undefined ? input.active : existing.active;
  const rssUrl =
    input.rssUrl !== undefined
      ? normalizeOptionalUrl(input.rssUrl, "rssUrl")
      : existing.rssUrl ?? null;

  if (existing.resourceType === "NEWS_SOURCE" && active && !rssUrl) {
    throw new MediaResourceValidationError("rssUrl is required for active NEWS_SOURCE resources.");
  }
  if (existing.resourceType !== "NEWS_SOURCE" && rssUrl) {
    throw new MediaResourceValidationError("rssUrl is only allowed for NEWS_SOURCE resources.");
  }
  const articleDomains =
    input.articleDomains !== undefined
      ? normalizeArticleDomainsInput(input.articleDomains, existing.resourceType)
      : existing.resourceType === "NEWS_SOURCE"
        ? (existing.articleDomains ?? null)
        : null;

  let categoryId =
    input.categoryId !== undefined
      ? input.categoryId?.trim() || null
      : existing.categoryId ?? null;
  if (existing.resourceType === "TRUSTED_MEDIA") {
    if (!categoryId || !TRUSTED_CATEGORY_IDS.has(categoryId as TrustedMediaCategoryId)) {
      throw new MediaResourceValidationError("categoryId is required for TRUSTED_MEDIA.");
    }
  } else {
    categoryId = null;
  }

  await assertNoDuplicate({
    id: existing.id,
    resourceType: existing.resourceType,
    scopeType,
    countryCode,
    websiteUrl,
    rssUrl,
  });

  if (existing.resourceType === "TRUSTED_MEDIA" && scopeType === "COUNTRY" && countryCode) {
    const alreadyOccupying =
      existing.resourceType === "TRUSTED_MEDIA" &&
      existing.scopeType === "COUNTRY" &&
      existing.countryCode === countryCode;
    await assertCountryTrustedMediaCapacity({
      countryCode,
      excludeId: existing.id,
      isNewOccupancy: !alreadyOccupying,
    });
  }

  const resource: MediaResource = {
    ...existing,
    scopeType,
    countryCode,
    name,
    logoLabel,
    logoUrl:
      input.logoUrl !== undefined
        ? normalizeOptionalUrl(input.logoUrl, "logoUrl")
        : existing.logoUrl ?? null,
    websiteUrl,
    rssUrl: existing.resourceType === "NEWS_SOURCE" ? rssUrl : null,
    categoryId,
    description:
      input.description !== undefined
        ? input.description?.trim() || null
        : existing.description ?? null,
    secondaryText:
      input.secondaryText !== undefined
        ? input.secondaryText?.trim() || null
        : existing.secondaryText ?? null,
    language:
      existing.resourceType === "NEWS_SOURCE"
        ? input.language !== undefined
          ? input.language?.trim() || null
          : existing.language ?? null
        : null,
    providerId:
      existing.resourceType === "NEWS_SOURCE"
        ? input.providerId !== undefined
          ? input.providerId?.trim() || null
          : existing.providerId ?? null
        : null,
    active,
    sortOrder:
      typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
        ? Math.trunc(input.sortOrder)
        : existing.sortOrder,
    updatedAt: new Date().toISOString(),
  };
  if (articleDomains?.length) {
    resource.articleDomains = articleDomains;
  } else {
    delete resource.articleDomains;
  }
  // A kept section URL is re-checked too: a website change may leave it off-domain.
  const newsSectionUrl = normalizeNewsSectionUrlInput(
    input.newsSectionUrl !== undefined ? input.newsSectionUrl : (existing.newsSectionUrl ?? null),
    existing.resourceType,
    resource,
  );
  if (newsSectionUrl) {
    resource.newsSectionUrl = newsSectionUrl;
  } else {
    delete resource.newsSectionUrl;
  }

  await upsertMediaResource(resource);
  await notifyTrustedCanonicalChange({
    entityId: resource.id,
    resourceType: resource.resourceType,
    hadTrustedRow: existing.resourceType === "TRUSTED_MEDIA",
    beforeDescription: existing.description,
    afterDescription: resource.description,
  });
  await scheduleCivicMediaRecoveryIfTranslationInputChanged({
    before: existing,
    after: resource,
  });
  await AuditService.record({
    actorParticipantId: admin.memberId,
    action: "media_resource.update",
    targetType: "media_resource",
    targetId: resource.id,
    beforeSummary: summarizeResource(existing),
    afterSummary: summarizeResource(resource),
  });
  await refreshNewsSourceCacheBestEffort();
  return resource;
}

export async function activateAdminMediaResource(input: {
  actorUserId: string;
  id: string;
  resourceType?: MediaResourceType;
}): Promise<MediaResource> {
  await ensureMediaResourcesSeededOnce();
  const existing = await loadMediaResourceByIdentity(input);
  const admin = await assertMediaMutationActor(input.actorUserId, existing);
  if (
    existing.resourceType === "NEWS_SOURCE" &&
    !existing.rssUrl?.trim()
  ) {
    throw new MediaResourceValidationError("rssUrl is required to activate a NEWS_SOURCE.");
  }
  if (existing.active) {
    return existing;
  }
  const resource: MediaResource = {
    ...existing,
    active: true,
    updatedAt: new Date().toISOString(),
  };
  await upsertMediaResource(resource);
  await scheduleCivicMediaRecoveryIfTranslationInputChanged({
    before: existing,
    after: resource,
  });
  await AuditService.record({
    actorParticipantId: admin.memberId,
    action: "media_resource.activate",
    targetType: "media_resource",
    targetId: resource.id,
    beforeSummary: summarizeResource(existing),
    afterSummary: summarizeResource(resource),
  });
  await refreshNewsSourceCacheBestEffort();
  return resource;
}

export async function deactivateAdminMediaResource(input: {
  actorUserId: string;
  id: string;
  resourceType?: MediaResourceType;
}): Promise<MediaResource> {
  await ensureMediaResourcesSeededOnce();
  const existing = await loadMediaResourceByIdentity(input);
  const admin = await assertMediaMutationActor(input.actorUserId, existing);
  if (!existing.active) {
    return existing;
  }
  const resource: MediaResource = {
    ...existing,
    active: false,
    updatedAt: new Date().toISOString(),
  };
  await upsertMediaResource(resource);
  await scheduleCivicMediaRecoveryIfTranslationInputChanged({
    before: existing,
    after: resource,
  });
  await AuditService.record({
    actorParticipantId: admin.memberId,
    action: "media_resource.deactivate",
    targetType: "media_resource",
    targetId: resource.id,
    beforeSummary: summarizeResource(existing),
    afterSummary: summarizeResource(resource),
  });
  await refreshNewsSourceCacheBestEffort();
  return resource;
}

export async function deleteAdminMediaResource(input: {
  actorUserId: string;
  id: string;
  resourceType?: MediaResourceType;
  hard?: boolean;
}): Promise<{ resource: MediaResource | null; softDeactivated: boolean }> {
  const admin = await assertAdminUser(input.actorUserId);
  await ensureMediaResourcesSeededOnce();
  const existing = await loadMediaResourceByIdentity(input);

  if (!input.hard) {
    if (!existing.active) {
      return { resource: existing, softDeactivated: true };
    }
    const resource: MediaResource = {
      ...existing,
      active: false,
      updatedAt: new Date().toISOString(),
    };
    await upsertMediaResource(resource);
    await scheduleCivicMediaRecoveryIfTranslationInputChanged({
      before: existing,
      after: resource,
    });
    await AuditService.record({
      actorParticipantId: admin.memberId,
      action: "media_resource.deactivate",
      targetType: "media_resource",
      targetId: resource.id,
      beforeSummary: summarizeResource(existing),
      afterSummary: summarizeResource(resource),
    });
    await refreshNewsSourceCacheBestEffort();
    return { resource, softDeactivated: true };
  }

  await recordMediaResourceTombstone({
    resourceType: existing.resourceType,
    id: existing.id,
    deletedAt: new Date().toISOString(),
    deletedByParticipantId: admin.memberId,
  });
  await deleteMediaResource({
    resourceType: existing.resourceType,
    id: existing.id,
  });
  if (existing.resourceType === "TRUSTED_MEDIA") {
    const { continueTrustedPlpAfterTrustedRowRemoved } = await import(
      "../language/published-localized-presentation/universal/trusted-canonical-plp-continuation.js"
    );
    await continueTrustedPlpAfterTrustedRowRemoved({
      entityId: existing.id,
      removedDescription: existing.description,
    });
  }
  await scheduleCivicMediaRecoveryIfTranslationInputChanged({
    before: existing,
    after: null,
  });
  await AuditService.record({
    actorParticipantId: admin.memberId,
    action: "media_resource.delete",
    targetType: "media_resource",
    targetId: existing.id,
    beforeSummary: summarizeResource(existing),
  });
  await refreshNewsSourceCacheBestEffort();
  return { resource: null, softDeactivated: false };
}

export async function listPublicWorldTrustedMedia(): Promise<TrustedMediaResource[]> {
  await ensureMediaResourcesSeededOnce();
  const resources = await listMediaResources({
    resourceType: "TRUSTED_MEDIA",
    scopeType: "WORLD",
    active: true,
  });
  return projectTrustedMediaResources(resources);
}

/**
 * Pack 08K.3.3 — all active TRUSTED_MEDIA (WORLD + COUNTRY) for translation fingerprint.
 * /media display stays world-scoped; country Recommended Media shares explanation identity.
 */
export async function listAllPublicTrustedMediaForTranslation(): Promise<
  TrustedMediaResource[]
> {
  await ensureMediaResourcesSeededOnce();
  const resources = await listMediaResources({
    resourceType: "TRUSTED_MEDIA",
    active: true,
  });
  return projectTrustedMediaResources(resources);
}

export async function listPublicWorldFactChecking(): Promise<FactCheckResource[]> {
  await ensureMediaResourcesSeededOnce();
  const resources = await listMediaResources({
    resourceType: "FACT_CHECKING",
    scopeType: "WORLD",
    active: true,
  });
  return projectFactCheckResources(resources);
}

export async function listPublicWorldPropagandaAnalysis(): Promise<
  PropagandaAnalysisResource[]
> {
  await ensureMediaResourcesSeededOnce();
  const resources = await listMediaResources({
    resourceType: "PROPAGANDA_ANALYSIS",
    scopeType: "WORLD",
    active: true,
  });
  return projectPropagandaAnalysisResources(resources);
}

export async function listPublicCountryTrustedMedia(
  countryCodeInput: string,
  limit?: number,
): Promise<TrustedMediaResource[]> {
  await ensureMediaResourcesSeededOnce();
  const countryCode = normalizeCountryInput(countryCodeInput);
  if (!countryCode || !getCountryByCode(countryCode)) {
    return [];
  }

  const resources = await listMediaResources({
    resourceType: "TRUSTED_MEDIA",
    scopeType: "COUNTRY",
    countryCode,
    active: true,
  });
  const projected = projectTrustedMediaResources(resources);
  return typeof limit === "number" ? projected.slice(0, limit) : projected;
}

/** COUNTRY-MEDIA-NEWS-01 — active country-scoped NEWS_SOURCE resources with a usable RSS feed. */
export async function listPublicCountryNewsSources(
  countryCodeInput: string,
): Promise<PublicCountryNewsSource[]> {
  await ensureMediaResourcesSeededOnce();
  const countryCode = normalizeCountryInput(countryCodeInput);
  if (!countryCode || !getCountryByCode(countryCode)) {
    return [];
  }

  const resources = await listMediaResources({
    resourceType: "NEWS_SOURCE",
    scopeType: "COUNTRY",
    countryCode,
    active: true,
  });
  return projectPublicCountryNewsSources(resources);
}

export async function listActiveNewsSourceMediaResources(): Promise<MediaResource[]> {
  await ensureMediaResourcesSeededOnce();
  return listMediaResources({
    resourceType: "NEWS_SOURCE",
    active: true,
  });
}

export async function listProjectedActiveApprovedNewsSources() {
  const resources = await listActiveNewsSourceMediaResources();
  return projectApprovedNewsSources(resources);
}

async function scheduleCivicMediaRecoveryIfTranslationInputChanged(input: {
  readonly before: MediaResource | null;
  readonly after: MediaResource | null;
}): Promise<void> {
  const {
    scheduleCivicMediaTranslationRecovery,
    trustedMediaTranslationInputChanged,
  } = await import("../language/civic-media-translation-recovery.js");
  if (!trustedMediaTranslationInputChanged(input.before, input.after)) {
    return;
  }
  scheduleCivicMediaTranslationRecovery();
}

async function notifyTrustedCanonicalChange(input: {
  readonly entityId: string;
  readonly resourceType: MediaResourceType;
  readonly hadTrustedRow: boolean;
  readonly beforeDescription: string | null | undefined;
  readonly afterDescription: string | null | undefined;
}): Promise<void> {
  if (input.resourceType !== "TRUSTED_MEDIA") {
    return;
  }
  const {
    continueTrustedMediaPlpIfCanonicalChanged,
    trustedCanonicalVersionBeforeWrite,
  } = await import(
    "../language/published-localized-presentation/universal/trusted-canonical-plp-continuation.js"
  );
  const { trustedExplanationCanonicalVersion } = await import(
    "../language/published-localized-presentation/media/trusted-editorial-source.js"
  );
  await continueTrustedMediaPlpIfCanonicalChanged({
    entityId: input.entityId,
    beforeVersion: trustedCanonicalVersionBeforeWrite({
      hadTrustedRow: input.hadTrustedRow,
      entityId: input.entityId,
      description: input.beforeDescription,
    }),
    afterVersion: trustedExplanationCanonicalVersion(input.afterDescription),
  });
}
