/**
 * Pack 08I.2 — Admin Brand Localization services.
 * Manual Admin-approved identity only — never Gemini / TranslationProvider.
 */

import {
  isBrandLocalizationStatus,
  type BrandLocalizationAdminListResponse,
  type BrandLocalizationRecord,
  type BrandLocalizationStatus,
  type BrandLocalizationUpdateInput,
  type BrandLocalizationUpsertInput,
} from "@hu/types";
import { randomUUID } from "node:crypto";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { record as recordAdministrationAudit } from "../administration/audit.service.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { resolveLanguageRegistryLocale } from "../language/language-registry/language-registry.repository.js";
import {
  BrandLocalizationNotFoundError,
  BrandLocalizationValidationError,
} from "./brand-localization.errors.js";
import { ENGLISH_BRAND_LOCALIZATION_LOCALE } from "./brand-localization.seed.js";
import {
  ensureBrandLocalizationSeeded,
  getBrandLocalizationByLocale,
  listBrandLocalizations,
  updateBrandLocalizationRecord,
  upsertBrandLocalization,
} from "./brand-localization.repository.js";

type AdminActor = {
  userId: string;
  participantId: string;
};

let adminAssertOverrideForTests: ((userId: string) => Promise<AdminActor>) | null = null;

export function setBrandLocalizationAdminAssertOverrideForTests(
  override: ((userId: string) => Promise<AdminActor>) | null,
): void {
  adminAssertOverrideForTests = override;
}

async function assertAdminActor(userId: string): Promise<AdminActor> {
  if (adminAssertOverrideForTests) {
    return adminAssertOverrideForTests(userId);
  }
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError();
  }
  const user = await findAuthUserById(userId);
  if (!user) {
    throw new AdministrationUnauthorizedError();
  }
  if (user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  return { userId: user.userId, participantId: user.memberId };
}

function summarizeBrand(record: BrandLocalizationRecord): string {
  return [
    `brandId=${record.brandId}`,
    `locale=${record.locale}`,
    `status=${record.status}`,
    `siteName=${record.siteName}`,
  ].join(" ");
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BrandLocalizationValidationError(`${field} is required.`);
  }
  return value.trim();
}

/** Preserve intentional newlines; trim ends only. Generous max matches audit text policy. */
const HERO_UNITY_QUOTE_MAX_LENGTH = 2000;

function requireHeroUnityQuote(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BrandLocalizationValidationError("heroUnityQuote is required.");
  }
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (normalized.length > HERO_UNITY_QUOTE_MAX_LENGTH) {
    throw new BrandLocalizationValidationError(
      `heroUnityQuote must be at most ${HERO_UNITY_QUOTE_MAX_LENGTH} characters.`,
    );
  }
  return normalized;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new BrandLocalizationValidationError(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function canonicalizeRegistryLocale(rawLocale: string): Promise<string> {
  const trimmed = rawLocale.trim();
  if (!trimmed) {
    throw new BrandLocalizationValidationError("locale is required.");
  }
  const registry = await resolveLanguageRegistryLocale(trimmed);
  if (!registry) {
    throw new BrandLocalizationValidationError(
      `locale "${trimmed}" is not in the Language Registry.`,
    );
  }
  // Reject alias tags as separate records — always store canonical locale.
  return registry.locale;
}

function assertPublishableFields(record: {
  siteName: string;
  slogan: string;
  heroUnityQuote: string;
  seoSiteName: string;
  defaultMetaDescription: string;
}): void {
  if (!record.siteName.trim()) {
    throw new BrandLocalizationValidationError("siteName is required to publish.");
  }
  if (!record.slogan.trim()) {
    throw new BrandLocalizationValidationError("slogan is required to publish.");
  }
  if (!record.heroUnityQuote.trim()) {
    throw new BrandLocalizationValidationError("heroUnityQuote is required to publish.");
  }
  if (!record.seoSiteName.trim()) {
    throw new BrandLocalizationValidationError("seoSiteName is required to publish.");
  }
  if (!record.defaultMetaDescription.trim()) {
    throw new BrandLocalizationValidationError(
      "defaultMetaDescription is required to publish.",
    );
  }
}

function parseStatus(value: unknown): BrandLocalizationStatus {
  if (!isBrandLocalizationStatus(value)) {
    throw new BrandLocalizationValidationError(
      `status must be one of: draft, approved, published.`,
    );
  }
  return value;
}

function parseUpsertBody(body: unknown): BrandLocalizationUpsertInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AdministrationValidationError("Brand localization body is required.");
  }
  const record = body as Record<string, unknown>;
  if ("locale" in record === false) {
    throw new BrandLocalizationValidationError("locale is required.");
  }
  return {
    locale: requireNonEmptyString(record.locale, "locale"),
    siteName: requireNonEmptyString(record.siteName, "siteName"),
    shortName: optionalString(record.shortName, "shortName"),
    slogan: requireNonEmptyString(record.slogan, "slogan"),
    heroUnityQuote: requireHeroUnityQuote(record.heroUnityQuote),
    seoSiteName: requireNonEmptyString(record.seoSiteName, "seoSiteName"),
    seoTitleSuffix: optionalString(record.seoTitleSuffix, "seoTitleSuffix"),
    defaultMetaDescription: requireNonEmptyString(
      record.defaultMetaDescription,
      "defaultMetaDescription",
    ),
    openGraphBrandName: optionalString(record.openGraphBrandName, "openGraphBrandName"),
    ...(record.status !== undefined ? { status: parseStatus(record.status) } : {}),
  };
}

function parseUpdateBody(body: unknown): BrandLocalizationUpdateInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AdministrationValidationError("Brand localization body is required.");
  }
  const record = body as Record<string, unknown>;

  const immutable = ["brandId", "locale", "createdAt", "updatedAt", "updatedByParticipantId"];
  for (const field of immutable) {
    if (field in record) {
      throw new BrandLocalizationValidationError(`${field} is immutable.`);
    }
  }

  const draft: {
    siteName?: string;
    shortName?: string | null;
    slogan?: string;
    heroUnityQuote?: string;
    seoSiteName?: string;
    seoTitleSuffix?: string | null;
    defaultMetaDescription?: string;
    openGraphBrandName?: string | null;
    status?: BrandLocalizationUpdateInput["status"];
  } = {};

  if ("siteName" in record) {
    draft.siteName = requireNonEmptyString(record.siteName, "siteName");
  }
  if ("slogan" in record) {
    draft.slogan = requireNonEmptyString(record.slogan, "slogan");
  }
  if ("heroUnityQuote" in record) {
    draft.heroUnityQuote = requireHeroUnityQuote(record.heroUnityQuote);
  }
  if ("seoSiteName" in record) {
    draft.seoSiteName = requireNonEmptyString(record.seoSiteName, "seoSiteName");
  }
  if ("defaultMetaDescription" in record) {
    draft.defaultMetaDescription = requireNonEmptyString(
      record.defaultMetaDescription,
      "defaultMetaDescription",
    );
  }
  if ("shortName" in record) {
    if (record.shortName === null) {
      draft.shortName = null;
    } else {
      draft.shortName = optionalString(record.shortName, "shortName") ?? null;
    }
  }
  if ("seoTitleSuffix" in record) {
    if (record.seoTitleSuffix === null) {
      draft.seoTitleSuffix = null;
    } else {
      draft.seoTitleSuffix = optionalString(record.seoTitleSuffix, "seoTitleSuffix") ?? null;
    }
  }
  if ("openGraphBrandName" in record) {
    if (record.openGraphBrandName === null) {
      draft.openGraphBrandName = null;
    } else {
      draft.openGraphBrandName =
        optionalString(record.openGraphBrandName, "openGraphBrandName") ?? null;
    }
  }
  if ("status" in record) {
    draft.status = parseStatus(record.status);
  }

  if (Object.keys(draft).length === 0) {
    throw new BrandLocalizationValidationError("No mutable fields provided.");
  }

  return draft;
}

export async function listAdminBrandLocalizations(input: {
  actorUserId: string;
}): Promise<BrandLocalizationAdminListResponse> {
  await assertAdminActor(input.actorUserId);
  await ensureBrandLocalizationSeeded();
  const brands = await listBrandLocalizations();
  return { brands };
}

export async function getAdminBrandLocalization(input: {
  actorUserId: string;
  locale: string;
}): Promise<BrandLocalizationRecord> {
  await assertAdminActor(input.actorUserId);
  const canonical = await canonicalizeRegistryLocale(input.locale);
  const record = await getBrandLocalizationByLocale(canonical);
  if (!record) {
    throw new BrandLocalizationNotFoundError(`Brand localization not found: ${canonical}`);
  }
  return record;
}

export async function upsertAdminBrandLocalization(input: {
  actorUserId: string;
  body: unknown;
}): Promise<BrandLocalizationRecord> {
  const admin = await assertAdminActor(input.actorUserId);
  const parsed = parseUpsertBody(input.body);
  // One record per canonical locale — alias tags (e.g. zh-TW) store as zh-Hant.
  const canonicalLocale = await canonicalizeRegistryLocale(parsed.locale);
  const existing = await getBrandLocalizationByLocale(canonicalLocale);
  const nowIso = new Date().toISOString();
  const nextStatus = parsed.status ?? existing?.status ?? "draft";

  if (nextStatus === "published") {
    assertPublishableFields(parsed);
  }

  const shortName =
    parsed.shortName !== undefined ? parsed.shortName : existing?.shortName;
  const seoTitleSuffix =
    parsed.seoTitleSuffix !== undefined
      ? parsed.seoTitleSuffix
      : existing?.seoTitleSuffix;
  const openGraphBrandName =
    parsed.openGraphBrandName !== undefined
      ? parsed.openGraphBrandName
      : existing?.openGraphBrandName;

  const next: BrandLocalizationRecord = {
    brandId:
      existing?.brandId ??
      (canonicalLocale === ENGLISH_BRAND_LOCALIZATION_LOCALE
        ? "brand-en"
        : `brand-${canonicalLocale}-${randomUUID().slice(0, 8)}`),
    locale: canonicalLocale,
    siteName: parsed.siteName,
    ...(shortName ? { shortName } : {}),
    slogan: parsed.slogan,
    heroUnityQuote: parsed.heroUnityQuote,
    seoSiteName: parsed.seoSiteName,
    ...(seoTitleSuffix ? { seoTitleSuffix } : {}),
    defaultMetaDescription: parsed.defaultMetaDescription,
    ...(openGraphBrandName ? { openGraphBrandName } : {}),
    status: nextStatus,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    updatedByParticipantId: admin.participantId,
  };

  const saved = await upsertBrandLocalization(next);

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: existing ? "brand_localization.update" : "brand_localization.create",
    targetType: "brand_localization",
    targetId: saved.brandId,
    scope: { scopeType: "global" },
    beforeSummary: existing ? summarizeBrand(existing) : "none",
    afterSummary: summarizeBrand(saved),
  });

  return saved;
}

export async function updateAdminBrandLocalization(input: {
  actorUserId: string;
  locale: string;
  body: unknown;
}): Promise<BrandLocalizationRecord> {
  const admin = await assertAdminActor(input.actorUserId);
  const canonical = await canonicalizeRegistryLocale(input.locale);
  const existing = await getBrandLocalizationByLocale(canonical);
  if (!existing) {
    throw new BrandLocalizationNotFoundError(`Brand localization not found: ${canonical}`);
  }

  const patch = parseUpdateBody(input.body);
  const nextStatus = patch.status ?? existing.status;
  const merged = {
    siteName: patch.siteName ?? existing.siteName,
    slogan: patch.slogan ?? existing.slogan,
    heroUnityQuote: patch.heroUnityQuote ?? existing.heroUnityQuote,
    seoSiteName: patch.seoSiteName ?? existing.seoSiteName,
    defaultMetaDescription:
      patch.defaultMetaDescription ?? existing.defaultMetaDescription,
  };
  if (nextStatus === "published") {
    assertPublishableFields(merged);
  }

  const nowIso = new Date().toISOString();
  const shortName =
    patch.shortName !== undefined ? patch.shortName : existing.shortName;
  const seoTitleSuffix =
    patch.seoTitleSuffix !== undefined
      ? patch.seoTitleSuffix
      : existing.seoTitleSuffix;
  const openGraphBrandName =
    patch.openGraphBrandName !== undefined
      ? patch.openGraphBrandName
      : existing.openGraphBrandName;

  const next: BrandLocalizationRecord = {
    brandId: existing.brandId,
    locale: existing.locale,
    siteName: merged.siteName,
    ...(shortName ? { shortName } : {}),
    slogan: merged.slogan,
    heroUnityQuote: merged.heroUnityQuote,
    seoSiteName: merged.seoSiteName,
    ...(seoTitleSuffix ? { seoTitleSuffix } : {}),
    defaultMetaDescription: merged.defaultMetaDescription,
    ...(openGraphBrandName ? { openGraphBrandName } : {}),
    status: nextStatus,
    createdAt: existing.createdAt,
    updatedAt: nowIso,
    updatedByParticipantId: admin.participantId,
  };

  const saved = await updateBrandLocalizationRecord(canonical, next);

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "brand_localization.update",
    targetType: "brand_localization",
    targetId: saved.brandId,
    scope: { scopeType: "global" },
    beforeSummary: summarizeBrand(existing),
    afterSummary: summarizeBrand(saved),
  });

  return saved;
}

export async function publishAdminBrandLocalization(input: {
  actorUserId: string;
  locale: string;
}): Promise<BrandLocalizationRecord> {
  const admin = await assertAdminActor(input.actorUserId);
  const canonical = await canonicalizeRegistryLocale(input.locale);
  const existing = await getBrandLocalizationByLocale(canonical);
  if (!existing) {
    throw new BrandLocalizationNotFoundError(`Brand localization not found: ${canonical}`);
  }

  assertPublishableFields(existing);

  if (existing.status === "published") {
    return existing;
  }

  const nowIso = new Date().toISOString();
  const next: BrandLocalizationRecord = {
    ...existing,
    status: "published",
    updatedAt: nowIso,
    updatedByParticipantId: admin.participantId,
  };

  const saved = await updateBrandLocalizationRecord(canonical, next);

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "brand_localization.publish",
    targetType: "brand_localization",
    targetId: saved.brandId,
    scope: { scopeType: "global" },
    beforeSummary: summarizeBrand(existing),
    afterSummary: summarizeBrand(saved),
  });

  return saved;
}

/** Exported for tests — alias locale must resolve to the same canonical record key. */
export async function resolveCanonicalBrandLocaleForTests(
  localeOrAlias: string,
): Promise<string> {
  return canonicalizeRegistryLocale(localeOrAlias);
}
