/**
 * Pack 08I.5 — Admin Legal Localization services.
 * Counsel-approved HTML only — never Gemini / TranslationProvider / machine translation.
 */

import {
  CANONICAL_LEGAL_SOURCE_VERSIONS,
  isLegalDocumentType,
  isLegalLocalizationStatus,
  type LegalDocumentType,
  type LegalLocalizationAdminListItem,
  type LegalLocalizationAdminListResponse,
  type LegalLocalizationRecord,
  type LegalLocalizationStatus,
  type LegalLocalizationUpdateInput,
  type LegalLocalizationUpsertInput,
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
  LegalLocalizationNotFoundError,
  LegalLocalizationValidationError,
} from "./legal-localization.errors.js";
import {
  ensureLegalLocalizationReady,
  getLegalLocalization,
  listLegalLocalizations,
  updateLegalLocalizationRecord,
  upsertLegalLocalization,
} from "./legal-localization.repository.js";

type AdminActor = {
  userId: string;
  participantId: string;
};

let adminAssertOverrideForTests: ((userId: string) => Promise<AdminActor>) | null = null;

export function setLegalLocalizationAdminAssertOverrideForTests(
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

function summarizeLegal(record: LegalLocalizationRecord): string {
  return [
    `legalId=${record.legalId}`,
    `documentType=${record.documentType}`,
    `locale=${record.locale}`,
    `status=${record.status}`,
    `canonicalSourceVersion=${record.canonicalSourceVersion}`,
  ].join(" ");
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new LegalLocalizationValidationError(`${field} is required.`);
  }
  return value.trim();
}

/** Preserve intentional HTML whitespace; trim ends only. */
const LOCALIZED_BODY_MAX_LENGTH = 500_000;

function requireLocalizedBody(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new LegalLocalizationValidationError("localizedBody is required.");
  }
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (normalized.length > LOCALIZED_BODY_MAX_LENGTH) {
    throw new LegalLocalizationValidationError(
      `localizedBody must be at most ${LOCALIZED_BODY_MAX_LENGTH} characters.`,
    );
  }
  return normalized;
}

function optionalLocalizedBody(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireLocalizedBody(value);
}

function parseDocumentType(value: unknown): LegalDocumentType {
  if (!isLegalDocumentType(value)) {
    throw new LegalLocalizationValidationError(
      `documentType must be one of: ${["privacy", "terms"].join(", ")}.`,
    );
  }
  return value;
}

function parseStatus(value: unknown): LegalLocalizationStatus {
  if (!isLegalLocalizationStatus(value)) {
    throw new LegalLocalizationValidationError(
      `status must be one of: draft, approved, published.`,
    );
  }
  return value;
}

function isStaleRelativeToCanonical(record: LegalLocalizationRecord): boolean {
  return (
    record.canonicalSourceVersion !== CANONICAL_LEGAL_SOURCE_VERSIONS[record.documentType]
  );
}

function toAdminListItem(record: LegalLocalizationRecord): LegalLocalizationAdminListItem {
  return {
    ...record,
    isStaleRelativeToCanonical: isStaleRelativeToCanonical(record),
  };
}

async function canonicalizeRegistryLocale(rawLocale: string): Promise<string> {
  const trimmed = rawLocale.trim();
  if (!trimmed) {
    throw new LegalLocalizationValidationError("locale is required.");
  }
  const registry = await resolveLanguageRegistryLocale(trimmed);
  if (!registry) {
    throw new LegalLocalizationValidationError(
      `locale "${trimmed}" is not in the Language Registry.`,
    );
  }
  return registry.locale;
}

function assertPublishableBody(localizedBody: string): void {
  if (!localizedBody.trim()) {
    throw new LegalLocalizationValidationError(
      "localizedBody is required to publish.",
    );
  }
}

function parseUpsertBody(body: unknown): LegalLocalizationUpsertInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AdministrationValidationError("Legal localization body is required.");
  }
  const record = body as Record<string, unknown>;
  return {
    documentType: parseDocumentType(record.documentType),
    locale: requireNonEmptyString(record.locale, "locale"),
    localizedBody: requireLocalizedBody(record.localizedBody),
    ...(record.status !== undefined ? { status: parseStatus(record.status) } : {}),
    ...(record.canonicalSourceVersion !== undefined
      ? {
          canonicalSourceVersion: requireNonEmptyString(
            record.canonicalSourceVersion,
            "canonicalSourceVersion",
          ),
        }
      : {}),
  };
}

function parseUpdateBody(body: unknown): LegalLocalizationUpdateInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AdministrationValidationError("Legal localization body is required.");
  }
  const record = body as Record<string, unknown>;

  const immutable = [
    "legalId",
    "documentType",
    "locale",
    "createdAt",
    "updatedAt",
    "updatedByParticipantId",
    "approvedAt",
  ];
  for (const field of immutable) {
    if (field in record) {
      throw new LegalLocalizationValidationError(`${field} is immutable.`);
    }
  }

  const draft: {
    localizedBody?: string;
    status?: LegalLocalizationStatus;
    canonicalSourceVersion?: string;
  } = {};

  if ("localizedBody" in record) {
    draft.localizedBody = optionalLocalizedBody(record.localizedBody);
  }
  if ("status" in record) {
    draft.status = parseStatus(record.status);
  }
  if ("canonicalSourceVersion" in record) {
    draft.canonicalSourceVersion = requireNonEmptyString(
      record.canonicalSourceVersion,
      "canonicalSourceVersion",
    );
  }

  if (Object.keys(draft).length === 0) {
    throw new LegalLocalizationValidationError("No mutable fields provided.");
  }

  return draft as LegalLocalizationUpdateInput;
}

export async function listAdminLegalLocalizations(input: {
  actorUserId: string;
}): Promise<LegalLocalizationAdminListResponse> {
  await assertAdminActor(input.actorUserId);
  await ensureLegalLocalizationReady();
  const records = await listLegalLocalizations();
  return { localizations: records.map(toAdminListItem) };
}

export async function getAdminLegalLocalization(input: {
  actorUserId: string;
  documentType: string;
  locale: string;
}): Promise<LegalLocalizationAdminListItem> {
  await assertAdminActor(input.actorUserId);
  const documentType = parseDocumentType(input.documentType);
  const canonical = await canonicalizeRegistryLocale(input.locale);
  const record = await getLegalLocalization(documentType, canonical);
  if (!record) {
    throw new LegalLocalizationNotFoundError(
      `Legal localization not found: ${documentType}/${canonical}`,
    );
  }
  return toAdminListItem(record);
}

export async function upsertAdminLegalLocalization(input: {
  actorUserId: string;
  body: unknown;
}): Promise<LegalLocalizationAdminListItem> {
  const admin = await assertAdminActor(input.actorUserId);
  const parsed = parseUpsertBody(input.body);
  const canonicalLocale = await canonicalizeRegistryLocale(parsed.locale);
  const existing = await getLegalLocalization(parsed.documentType, canonicalLocale);
  const nowIso = new Date().toISOString();
  const nextStatus = parsed.status ?? existing?.status ?? "draft";
  const canonicalSourceVersion =
    parsed.canonicalSourceVersion ??
    existing?.canonicalSourceVersion ??
    CANONICAL_LEGAL_SOURCE_VERSIONS[parsed.documentType];

  if (nextStatus === "published") {
    assertPublishableBody(parsed.localizedBody);
  }

  const next: LegalLocalizationRecord = {
    legalId:
      existing?.legalId ??
      `legal-${parsed.documentType}-${canonicalLocale}-${randomUUID().slice(0, 8)}`,
    documentType: parsed.documentType,
    locale: canonicalLocale,
    canonicalSourceVersion,
    localizedBody: parsed.localizedBody,
    status: nextStatus,
    approvedAt:
      nextStatus === "published"
        ? (existing?.approvedAt ?? nowIso)
        : (existing?.approvedAt ?? null),
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    updatedByParticipantId: admin.participantId,
  };

  const saved = await upsertLegalLocalization(next);

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: existing ? "legal_localization.update" : "legal_localization.create",
    targetType: "legal_localization",
    targetId: saved.legalId,
    scope: { scopeType: "global" },
    beforeSummary: existing ? summarizeLegal(existing) : "none",
    afterSummary: summarizeLegal(saved),
  });

  return toAdminListItem(saved);
}

export async function updateAdminLegalLocalization(input: {
  actorUserId: string;
  documentType: string;
  locale: string;
  body: unknown;
}): Promise<LegalLocalizationAdminListItem> {
  const admin = await assertAdminActor(input.actorUserId);
  const documentType = parseDocumentType(input.documentType);
  const canonical = await canonicalizeRegistryLocale(input.locale);
  const existing = await getLegalLocalization(documentType, canonical);
  if (!existing) {
    throw new LegalLocalizationNotFoundError(
      `Legal localization not found: ${documentType}/${canonical}`,
    );
  }

  const patch = parseUpdateBody(input.body);
  const nextStatus = patch.status ?? existing.status;
  const localizedBody = patch.localizedBody ?? existing.localizedBody;
  const canonicalSourceVersion =
    patch.canonicalSourceVersion ?? existing.canonicalSourceVersion;

  if (nextStatus === "published") {
    assertPublishableBody(localizedBody);
  }

  const nowIso = new Date().toISOString();
  const next: LegalLocalizationRecord = {
    legalId: existing.legalId,
    documentType: existing.documentType,
    locale: existing.locale,
    canonicalSourceVersion,
    localizedBody,
    status: nextStatus,
    approvedAt:
      nextStatus === "published"
        ? (existing.approvedAt ?? nowIso)
        : existing.approvedAt,
    createdAt: existing.createdAt,
    updatedAt: nowIso,
    updatedByParticipantId: admin.participantId,
  };

  const saved = await updateLegalLocalizationRecord(documentType, canonical, next);

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "legal_localization.update",
    targetType: "legal_localization",
    targetId: saved.legalId,
    scope: { scopeType: "global" },
    beforeSummary: summarizeLegal(existing),
    afterSummary: summarizeLegal(saved),
  });

  return toAdminListItem(saved);
}

export async function publishAdminLegalLocalization(input: {
  actorUserId: string;
  documentType: string;
  locale: string;
}): Promise<LegalLocalizationAdminListItem> {
  const admin = await assertAdminActor(input.actorUserId);
  const documentType = parseDocumentType(input.documentType);
  const canonical = await canonicalizeRegistryLocale(input.locale);
  const existing = await getLegalLocalization(documentType, canonical);
  if (!existing) {
    throw new LegalLocalizationNotFoundError(
      `Legal localization not found: ${documentType}/${canonical}`,
    );
  }

  assertPublishableBody(existing.localizedBody);

  const nowIso = new Date().toISOString();
  const canonicalSourceVersion =
    existing.canonicalSourceVersion?.trim() ||
    CANONICAL_LEGAL_SOURCE_VERSIONS[documentType];

  if (
    existing.status === "published" &&
    existing.approvedAt &&
    existing.canonicalSourceVersion === canonicalSourceVersion
  ) {
    return toAdminListItem(existing);
  }

  const next: LegalLocalizationRecord = {
    ...existing,
    status: "published",
    approvedAt: nowIso,
    canonicalSourceVersion,
    updatedAt: nowIso,
    updatedByParticipantId: admin.participantId,
  };

  const saved = await updateLegalLocalizationRecord(documentType, canonical, next);

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "legal_localization.publish",
    targetType: "legal_localization",
    targetId: saved.legalId,
    scope: { scopeType: "global" },
    beforeSummary: summarizeLegal(existing),
    afterSummary: summarizeLegal(saved),
  });

  return toAdminListItem(saved);
}

/** Exported for tests — alias locale must resolve to the same canonical record key. */
export async function resolveCanonicalLegalLocaleForTests(
  localeOrAlias: string,
): Promise<string> {
  return canonicalizeRegistryLocale(localeOrAlias);
}
