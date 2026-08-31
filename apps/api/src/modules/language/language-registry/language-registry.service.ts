/**
 * Production Completion Pack 02B Task 04 — Language Registry Admin read/write services.
 */
import type {
  LanguageRegistryAdmin,
  LanguageRegistryAdminListResponse,
  LanguageRegistryCreateInput,
  LanguageRegistryPublic,
  LanguageRegistryPublicListResponse,
  LanguageRegistryRecord,
  LanguageRegistryUpdateInput,
  LanguageTextDirection,
  LanguageUiTranslationStatus,
} from "@hu/types";
import {
  isLanguageTextDirection,
  isLanguageUiTranslationStatus,
} from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../../administration/administration.errors.js";
import { record as recordAdministrationAudit } from "../../administration/audit.service.js";
import { findAuthUserById } from "../../auth/auth-user.repository.js";
import {
  LanguageRegistryNotFoundError,
  LanguageRegistryValidationError,
} from "./language-registry.errors.js";
import {
  createLanguageRegistryRecord,
  listLanguageRegistry,
  updateLanguageRegistryRecord,
} from "./language-registry.repository.js";

type AdminActor = {
  userId: string;
  participantId: string;
};

let adminAssertOverrideForTests: ((userId: string) => Promise<AdminActor>) | null = null;

export function setLanguageRegistryAdminAssertOverrideForTests(
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

function toPublicLanguage(record: LanguageRegistryRecord): LanguageRegistryPublic {
  return {
    languageId: record.languageId,
    locale: record.locale,
    languageCode: record.languageCode,
    englishName: record.englishName,
    nativeName: record.nativeName,
    textDirection: record.textDirection,
    fallbackLocale: record.fallbackLocale,
    uiTranslationStatus: record.uiTranslationStatus,
    aliases: [...record.aliases],
  };
}

function toAdminLanguage(record: LanguageRegistryRecord): LanguageRegistryAdmin {
  return {
    languageId: record.languageId,
    locale: record.locale,
    languageCode: record.languageCode,
    englishName: record.englishName,
    nativeName: record.nativeName,
    textDirection: record.textDirection,
    fallbackLocale: record.fallbackLocale,
    enabled: record.enabled,
    uiTranslationStatus: record.uiTranslationStatus,
    contentTranslationEnabled: record.contentTranslationEnabled,
    searchEnabled: record.searchEnabled,
    seoIndexingEnabled: record.seoIndexingEnabled,
    aliases: [...record.aliases],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function summarizeLanguage(record: LanguageRegistryRecord): string {
  return [
    `locale=${record.locale}`,
    `enabled=${record.enabled}`,
    `fallback=${record.fallbackLocale}`,
    `dir=${record.textDirection}`,
    `ui=${record.uiTranslationStatus}`,
    `content=${record.contentTranslationEnabled}`,
    `search=${record.searchEnabled}`,
    `seo=${record.seoIndexingEnabled}`,
    `aliases=${record.aliases.length}`,
  ].join(" ");
}

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new AdministrationValidationError(`${field} is required.`);
  }
  return value.trim();
}

function optionalBoolean(
  body: Record<string, unknown>,
  field: string,
): boolean | undefined {
  if (!(field in body)) {
    return undefined;
  }
  if (typeof body[field] !== "boolean") {
    throw new AdministrationValidationError(`${field} must be a boolean.`);
  }
  return body[field] as boolean;
}

function optionalStringArray(
  body: Record<string, unknown>,
  field: string,
): string[] | undefined {
  if (!(field in body)) {
    return undefined;
  }
  const value = body[field];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new AdministrationValidationError(`${field} must be an array of strings.`);
  }
  return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function assertBcp47Locale(locale: string, fieldName: string): string {
  const trimmed = locale.trim();
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(trimmed)) {
    throw new LanguageRegistryValidationError(
      `${fieldName} must be a valid BCP-47 locale tag.`,
    );
  }
  return trimmed;
}

function parseCreateBody(body: unknown): LanguageRegistryCreateInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AdministrationValidationError("Language body is required.");
  }
  const record = body as Record<string, unknown>;

  if ("providerMappings" in record) {
    throw new AdministrationValidationError("providerMappings cannot be set via Admin API.");
  }
  if ("languageId" in record) {
    throw new AdministrationValidationError("languageId is assigned by the server.");
  }

  const locale = assertBcp47Locale(requireString(record, "locale"), "locale");
  const englishName = requireString(record, "englishName");
  const nativeName = requireString(record, "nativeName");
  const textDirectionRaw = requireString(record, "textDirection");
  if (!isLanguageTextDirection(textDirectionRaw)) {
    throw new AdministrationValidationError("textDirection must be ltr or rtl.");
  }
  const textDirection: LanguageTextDirection = textDirectionRaw;

  let uiTranslationStatus: LanguageUiTranslationStatus | undefined;
  if ("uiTranslationStatus" in record) {
    const status = record.uiTranslationStatus;
    if (!isLanguageUiTranslationStatus(status)) {
      throw new AdministrationValidationError("Invalid uiTranslationStatus.");
    }
    uiTranslationStatus = status;
  }

  const fallbackLocale =
    typeof record.fallbackLocale === "string" && record.fallbackLocale.trim()
      ? assertBcp47Locale(record.fallbackLocale, "fallbackLocale")
      : undefined;

  return {
    locale,
    englishName,
    nativeName,
    textDirection,
    fallbackLocale,
    enabled: optionalBoolean(record, "enabled"),
    uiTranslationStatus,
    contentTranslationEnabled: optionalBoolean(record, "contentTranslationEnabled"),
    searchEnabled: optionalBoolean(record, "searchEnabled"),
    seoIndexingEnabled: optionalBoolean(record, "seoIndexingEnabled"),
    aliases: optionalStringArray(record, "aliases")?.map((alias) =>
      assertBcp47Locale(alias, "aliases"),
    ),
  };
}

function parsePatchBody(body: unknown): LanguageRegistryUpdateInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AdministrationValidationError("Language patch body is required.");
  }
  const record = body as Record<string, unknown>;

  if ("providerMappings" in record) {
    throw new AdministrationValidationError("providerMappings cannot be set via Admin API.");
  }
  if ("locale" in record) {
    throw new LanguageRegistryValidationError("Canonical locale cannot be changed after creation.");
  }
  if ("languageId" in record) {
    throw new LanguageRegistryValidationError("languageId cannot be changed.");
  }
  if ("languageCode" in record) {
    throw new AdministrationValidationError("languageCode is derived and cannot be patched.");
  }

  const patch: {
    englishName?: string;
    nativeName?: string;
    textDirection?: LanguageTextDirection;
    fallbackLocale?: string;
    enabled?: boolean;
    uiTranslationStatus?: LanguageUiTranslationStatus;
    contentTranslationEnabled?: boolean;
    searchEnabled?: boolean;
    seoIndexingEnabled?: boolean;
    aliases?: string[];
  } = {};

  if ("englishName" in record) {
    patch.englishName = requireString(record, "englishName");
  }
  if ("nativeName" in record) {
    patch.nativeName = requireString(record, "nativeName");
  }
  if ("textDirection" in record) {
    const textDirectionRaw = requireString(record, "textDirection");
    if (!isLanguageTextDirection(textDirectionRaw)) {
      throw new AdministrationValidationError("textDirection must be ltr or rtl.");
    }
    patch.textDirection = textDirectionRaw;
  }
  if ("fallbackLocale" in record) {
    patch.fallbackLocale = assertBcp47Locale(
      requireString(record, "fallbackLocale"),
      "fallbackLocale",
    );
  }
  if ("enabled" in record) {
    patch.enabled = optionalBoolean(record, "enabled");
  }
  if ("uiTranslationStatus" in record) {
    const status = record.uiTranslationStatus;
    if (!isLanguageUiTranslationStatus(status)) {
      throw new AdministrationValidationError("Invalid uiTranslationStatus.");
    }
    patch.uiTranslationStatus = status;
  }
  if ("contentTranslationEnabled" in record) {
    patch.contentTranslationEnabled = optionalBoolean(record, "contentTranslationEnabled");
  }
  if ("searchEnabled" in record) {
    patch.searchEnabled = optionalBoolean(record, "searchEnabled");
  }
  if ("seoIndexingEnabled" in record) {
    patch.seoIndexingEnabled = optionalBoolean(record, "seoIndexingEnabled");
  }
  if ("aliases" in record) {
    patch.aliases = optionalStringArray(record, "aliases")?.map((alias) =>
      assertBcp47Locale(alias, "aliases"),
    );
  }

  if (Object.keys(patch).length === 0) {
    throw new AdministrationValidationError("No valid language fields were provided.");
  }

  return patch;
}

function resolveUpdateAuditAction(
  before: LanguageRegistryRecord,
  after: LanguageRegistryRecord,
): "language_registry.enable" | "language_registry.disable" | "language_registry.update" {
  if (before.enabled !== after.enabled) {
    return after.enabled ? "language_registry.enable" : "language_registry.disable";
  }
  return "language_registry.update";
}

export async function listPublicLanguages(): Promise<LanguageRegistryPublicListResponse> {
  const records = await listLanguageRegistry();
  return {
    languages: records.filter((row) => row.enabled === true).map(toPublicLanguage),
  };
}

export async function listAdminLanguages(input: {
  actorUserId: string;
}): Promise<LanguageRegistryAdminListResponse> {
  await assertAdminActor(input.actorUserId);
  const records = await listLanguageRegistry();
  return {
    languages: records.map(toAdminLanguage),
  };
}

export async function createAdminLanguage(input: {
  actorUserId: string;
  body: unknown;
}): Promise<LanguageRegistryAdmin> {
  const admin = await assertAdminActor(input.actorUserId);
  const createInput = parseCreateBody(input.body);
  const created = await createLanguageRegistryRecord(createInput);

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "language_registry.create",
    targetType: "language_registry",
    targetId: created.languageId,
    scope: { scopeType: "global" },
    afterSummary: summarizeLanguage(created),
  });

  return toAdminLanguage(created);
}

export async function updateAdminLanguage(input: {
  actorUserId: string;
  languageId: string;
  body: unknown;
}): Promise<LanguageRegistryAdmin> {
  const admin = await assertAdminActor(input.actorUserId);
  const languageId = input.languageId.trim();
  if (!languageId) {
    throw new AdministrationValidationError("languageId is required.");
  }

  const beforeList = await listLanguageRegistry();
  const before = beforeList.find((row) => row.languageId === languageId);
  if (!before) {
    throw new LanguageRegistryNotFoundError(`Language registry record not found: ${languageId}`);
  }

  const patch = parsePatchBody(input.body);
  const updated = await updateLanguageRegistryRecord(languageId, patch);

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: resolveUpdateAuditAction(before, updated),
    targetType: "language_registry",
    targetId: updated.languageId,
    scope: { scopeType: "global" },
    beforeSummary: summarizeLanguage(before),
    afterSummary: summarizeLanguage(updated),
  });

  return toAdminLanguage(updated);
}
