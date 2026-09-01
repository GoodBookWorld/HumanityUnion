/**
 * Production Completion Pack 02F Task 03 — Terminology Glossary Admin API services.
 */

import type {
  TerminologyConcept,
  TerminologyConceptStatus,
  TerminologyConceptUpdateInput,
  TerminologyGlossaryAdminListResponse,
  TerminologyLocaleTranslation,
} from "@hu/types";
import { isTerminologyConceptStatus } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../../administration/administration.errors.js";
import { record as recordAdministrationAudit } from "../../administration/audit.service.js";
import { findAuthUserById } from "../../auth/auth-user.repository.js";
import { TerminologyGlossaryNotFoundError } from "./terminology-glossary.errors.js";
import {
  canonicalizeGlossaryLocaleKeys,
  canonicalizeGlossaryTranslationLocales,
} from "./terminology-glossary.locale.js";
import {
  ensureTerminologyGlossarySeeded,
  getTerminologyConceptById,
  listTerminologyConcepts,
  updateTerminologyConcept,
} from "./terminology-glossary.repository.js";

type AdminActor = {
  userId: string;
  participantId: string;
};

let adminAssertOverrideForTests: ((userId: string) => Promise<AdminActor>) | null = null;

export function setTerminologyGlossaryAdminAssertOverrideForTests(
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

function summarizeConcept(concept: TerminologyConcept): string {
  const locales = Object.keys(concept.translations).sort().join(",") || "none";
  return [
    `conceptId=${concept.conceptId}`,
    `status=${concept.status}`,
    `category=${concept.category}`,
    `locales=${locales}`,
  ].join(" ");
}

const IMMUTABLE_PATCH_FIELDS = [
  "conceptId",
  "canonicalEnglishTerm",
  "category",
  "linkedRefs",
  "createdAt",
  "updatedAt",
  "updatedByParticipantId",
] as const;

function parseLocaleTranslation(value: unknown, locale: string): TerminologyLocaleTranslation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AdministrationValidationError(
      `translations.${locale} must be an object with preferredTerm and aliases.`,
    );
  }
  const record = value as Record<string, unknown>;
  if (typeof record.preferredTerm !== "string") {
    throw new AdministrationValidationError(
      `translations.${locale}.preferredTerm must be a string.`,
    );
  }
  if (!Array.isArray(record.aliases) || record.aliases.some((entry) => typeof entry !== "string")) {
    throw new AdministrationValidationError(
      `translations.${locale}.aliases must be an array of strings.`,
    );
  }
  if ("guidance" in record && record.guidance !== undefined && typeof record.guidance !== "string") {
    throw new AdministrationValidationError(
      `translations.${locale}.guidance must be a string when provided.`,
    );
  }

  return {
    preferredTerm: record.preferredTerm,
    aliases: record.aliases as string[],
    ...(typeof record.guidance === "string" ? { guidance: record.guidance } : {}),
  };
}

function parsePatchBody(body: unknown): TerminologyConceptUpdateInput & {
  readonly rawTranslationLocales: readonly string[];
  readonly rawRemoveLocales: readonly string[];
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AdministrationValidationError("Glossary patch body is required.");
  }
  const record = body as Record<string, unknown>;

  for (const field of IMMUTABLE_PATCH_FIELDS) {
    if (field in record) {
      throw new AdministrationValidationError(`${field} cannot be changed via Admin API.`);
    }
  }

  const patch: {
    translations?: Record<string, TerminologyLocaleTranslation>;
    removeTranslationLocales?: string[];
    status?: TerminologyConceptStatus;
  } = {};
  const rawTranslationLocales: string[] = [];
  const rawRemoveLocales: string[] = [];

  if ("status" in record) {
    if (!isTerminologyConceptStatus(record.status)) {
      throw new AdministrationValidationError("status must be draft, published, or retired.");
    }
    patch.status = record.status;
  }

  if ("translations" in record) {
    const translationsRaw = record.translations;
    if (
      !translationsRaw ||
      typeof translationsRaw !== "object" ||
      Array.isArray(translationsRaw)
    ) {
      throw new AdministrationValidationError("translations must be an object keyed by locale.");
    }
    const translations: Record<string, TerminologyLocaleTranslation> = {};
    for (const [locale, value] of Object.entries(
      translationsRaw as Record<string, unknown>,
    )) {
      const trimmedLocale = locale.trim();
      if (!trimmedLocale) {
        throw new AdministrationValidationError("Translation locale is required.");
      }
      translations[trimmedLocale] = parseLocaleTranslation(value, trimmedLocale);
      rawTranslationLocales.push(trimmedLocale);
    }
    patch.translations = translations;
  }

  if ("removeTranslationLocales" in record) {
    const removeRaw = record.removeTranslationLocales;
    if (!Array.isArray(removeRaw) || removeRaw.some((entry) => typeof entry !== "string")) {
      throw new AdministrationValidationError(
        "removeTranslationLocales must be an array of locale strings.",
      );
    }
    if (removeRaw.length === 0) {
      throw new AdministrationValidationError(
        "removeTranslationLocales must include at least one locale.",
      );
    }
    for (const locale of removeRaw) {
      const trimmed = locale.trim();
      if (!trimmed) {
        throw new AdministrationValidationError("removeTranslationLocales entries must be non-empty.");
      }
      rawRemoveLocales.push(trimmed);
    }
    patch.removeTranslationLocales = [...rawRemoveLocales];
  }

  if (
    patch.translations === undefined &&
    patch.status === undefined &&
    patch.removeTranslationLocales === undefined
  ) {
    throw new AdministrationValidationError(
      "No valid glossary fields were provided (translations, removeTranslationLocales, and/or status).",
    );
  }

  return { ...patch, rawTranslationLocales, rawRemoveLocales };
}

export async function listAdminTerminologyConcepts(input: {
  actorUserId: string;
}): Promise<TerminologyGlossaryAdminListResponse> {
  await assertAdminActor(input.actorUserId);
  await ensureTerminologyGlossarySeeded();
  const concepts = await listTerminologyConcepts();
  return { concepts };
}

export async function getAdminTerminologyConcept(input: {
  actorUserId: string;
  conceptId: string;
}): Promise<TerminologyConcept> {
  await assertAdminActor(input.actorUserId);
  const conceptId = input.conceptId.trim();
  if (!conceptId) {
    throw new AdministrationValidationError("conceptId is required.");
  }

  const concept = await getTerminologyConceptById(conceptId);
  if (!concept) {
    throw new TerminologyGlossaryNotFoundError(`Terminology concept not found: ${conceptId}`);
  }
  return concept;
}

export async function updateAdminTerminologyConcept(input: {
  actorUserId: string;
  conceptId: string;
  body: unknown;
}): Promise<TerminologyConcept> {
  const admin = await assertAdminActor(input.actorUserId);
  const conceptId = input.conceptId.trim();
  if (!conceptId) {
    throw new AdministrationValidationError("conceptId is required.");
  }

  const before = await getTerminologyConceptById(conceptId);
  if (!before) {
    throw new TerminologyGlossaryNotFoundError(`Terminology concept not found: ${conceptId}`);
  }

  const parsed = parsePatchBody(input.body);
  const { rawTranslationLocales, rawRemoveLocales, ...patch } = parsed;

  let canonicalPatchedLocales: string[] = [];
  if (patch.translations) {
    const canonical = await canonicalizeGlossaryTranslationLocales(patch.translations);
    canonicalPatchedLocales = Object.keys(canonical).sort();
    patch.translations = canonical;
  }

  let canonicalRemovedLocales: string[] = [];
  if (patch.removeTranslationLocales) {
    canonicalRemovedLocales = [
      ...(await canonicalizeGlossaryLocaleKeys(patch.removeTranslationLocales)),
    ];
    patch.removeTranslationLocales = canonicalRemovedLocales;
  }

  const updated = await updateTerminologyConcept(conceptId, {
    ...patch,
    updatedByParticipantId: admin.participantId,
  });

  const statusChanged = before.status !== updated.status;
  const afterParts = [
    `conceptId=${updated.conceptId}`,
    statusChanged
      ? `status=${before.status}->${updated.status}`
      : `status=${updated.status}`,
  ];
  if (canonicalPatchedLocales.length > 0) {
    afterParts.push(`locales=${canonicalPatchedLocales.join(",")}`);
  } else if (rawTranslationLocales.length > 0) {
    afterParts.push(`locales=${[...rawTranslationLocales].sort().join(",")}`);
  }
  if (canonicalRemovedLocales.length > 0) {
    afterParts.push(`removedLocales=${canonicalRemovedLocales.join(",")}`);
  } else if (rawRemoveLocales.length > 0) {
    afterParts.push(`removedLocales=${[...rawRemoveLocales].sort().join(",")}`);
  }

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "terminology_glossary.update",
    targetType: "terminology_glossary",
    targetId: updated.conceptId,
    scope: { scopeType: "global" },
    beforeSummary: summarizeConcept(before),
    afterSummary: afterParts.join(" "),
  });

  return updated;
}
