import { randomUUID } from "node:crypto";

import { getCountryByCode, normalizeCountryInput } from "@hu/geography";
import type {
  FactCheckResource,
  MediaResource,
  MediaResourceScopeType,
  MediaResourceType,
  PropagandaAnalysisResource,
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
  MediaResourceForbiddenDeleteError,
  MediaResourceNotFoundError,
  MediaResourceValidationError,
} from "./media-resource.errors.js";
import {
  projectApprovedNewsSources,
  projectFactCheckResources,
  projectPropagandaAnalysisResources,
  projectTrustedMediaResources,
} from "./media-resource.projections.js";
import { seedMediaResourcesFromCanonicalSources } from "./media-resource.seed.js";
import {
  deleteMediaResource,
  getMediaResourceById,
  listMediaResources,
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

function summarizeResource(resource: MediaResource): string {
  return `${resource.resourceType}:${resource.scopeType}:${resource.name}:${resource.active ? "active" : "inactive"}`;
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
  active?: boolean;
  sortOrder?: number;
  id?: string;
}

export interface AdminMediaResourceUpdateInput {
  actorUserId: string;
  id: string;
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
  active?: boolean;
  sortOrder?: number;
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

export async function getAdminMediaResource(input: {
  actorUserId: string;
  id: string;
}): Promise<MediaResource> {
  await assertAdminUser(input.actorUserId);
  await ensureMediaResourcesSeededOnce();
  const resource = await getMediaResourceById(input.id);
  if (!resource) {
    throw new MediaResourceNotFoundError();
  }
  return resource;
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

  const now = new Date().toISOString();
  const id = input.id?.trim() || `media-resource-${randomUUID()}`;
  if (await getMediaResourceById(id)) {
    throw new MediaResourceConflictError(`Media resource id already exists: ${id}.`);
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
    active,
    sortOrder:
      typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
        ? Math.trunc(input.sortOrder)
        : 1000,
    createdAt: now,
    updatedAt: now,
  };

  await upsertMediaResource(resource);
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

  const existing = await getMediaResourceById(input.id);
  if (!existing) {
    throw new MediaResourceNotFoundError();
  }

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

  await upsertMediaResource(resource);
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
}): Promise<MediaResource> {
  await ensureMediaResourcesSeededOnce();
  const existing = await getMediaResourceById(input.id);
  if (!existing) {
    throw new MediaResourceNotFoundError();
  }
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
}): Promise<MediaResource> {
  await ensureMediaResourcesSeededOnce();
  const existing = await getMediaResourceById(input.id);
  if (!existing) {
    throw new MediaResourceNotFoundError();
  }
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
  hard?: boolean;
}): Promise<{ resource: MediaResource | null; softDeactivated: boolean }> {
  const admin = await assertAdminUser(input.actorUserId);
  await ensureMediaResourcesSeededOnce();
  const existing = await getMediaResourceById(input.id);
  if (!existing) {
    throw new MediaResourceNotFoundError();
  }

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

  if (existing.resourceType === "NEWS_SOURCE" || existing.providerId) {
    throw new MediaResourceForbiddenDeleteError(
      "Hard delete is not allowed for NEWS_SOURCE resources; deactivate instead.",
    );
  }
  if (existing.active) {
    throw new MediaResourceForbiddenDeleteError(
      "Hard delete requires the resource to be inactive first.",
    );
  }

  await deleteMediaResource(existing.id);
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
