/**
 * Admin WEB_UI message pack services — data import only (no TranslationProvider).
 */

import type {
  WebUiMessagePackAddMissingPreview,
  WebUiMessagePackAddMissingResult,
  WebUiMessagePackAdminListResponse,
  WebUiMessagePackExpectedRevision,
  WebUiMessagePackPreparation,
  WebUiMessagePackPreparationScope,
  WebUiMessagePackRecord,
  WebUiMessageTree,
} from "@hu/types";
import { isWebUiMessagePackStatus, normalizeLanguageRegistryLocaleKey } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { resolveLanguageRegistryLocale } from "../language/language-registry/language-registry.repository.js";
import { assessWebUiCatalogReadinessForLocale } from "../language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import {
  countWebUiStringLeaves,
  mergeMissingPackagedWebUiMessages,
} from "./merge-missing-packaged-web-ui-messages.js";
import { loadPackagedWebUiCatalog } from "./packaged-web-ui-catalog.js";
import {
  WebUiMessagePackNotFoundError,
  WebUiMessagePackRevisionConflictError,
  WebUiMessagePackValidationError,
} from "./web-ui-message-pack.errors.js";
import {
  compareAndSetWebUiMessagePack,
  getPublishedWebUiMessagePackByLocale,
  getWebUiMessagePackByLocale,
  listWebUiMessagePacks,
  requireWebUiMessagePackByLocale,
} from "./web-ui-message-pack.repository.js";
import {
  collectStringPaths,
  existingWebUiLeavesChanged,
  listBlockingWebUiFoundationFailures,
  loadBundledEnglishWebUiMessagePack,
  selectEnglishWebUiMessages,
  validateWebUiMessageTreeAgainstEnglish,
  webUiFoundationFailuresBlockPersist,
} from "./web-ui-message-pack.validate.js";

type AdminActor = {
  userId: string;
  participantId: string;
};

let adminAssertOverrideForTests: ((userId: string) => Promise<AdminActor>) | null = null;

export function setWebUiMessagePackAdminAssertOverrideForTests(
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

function assertTargetLocaleIsNotEnglish(locale: string): void {
  if (normalizeLanguageRegistryLocaleKey(locale) === "en") {
    throw new WebUiMessagePackValidationError(
      "The canonical English catalog cannot be replaced by a locale pack.",
    );
  }
}

async function resolvePackLocale(locale: string): Promise<string> {
  const trimmed = locale.trim();
  if (!trimmed) {
    throw new AdministrationValidationError("locale is required.");
  }
  const registry = await resolveLanguageRegistryLocale(trimmed);
  if (!registry) {
    throw new WebUiMessagePackValidationError(
      `Locale is not in Language Registry: ${trimmed}`,
    );
  }
  assertTargetLocaleIsNotEnglish(registry.locale);
  return registry.locale;
}

export async function listAdminWebUiMessagePacks(input: {
  readonly actorUserId: string;
}): Promise<WebUiMessagePackAdminListResponse> {
  await assertAdminActor(input.actorUserId);
  return { packs: await listWebUiMessagePacks() };
}

export async function getAdminWebUiMessagePack(input: {
  readonly actorUserId: string;
  readonly locale: string;
}): Promise<{
  readonly pack: WebUiMessagePackRecord;
  readonly readiness: Awaited<ReturnType<typeof assessWebUiCatalogReadinessForLocale>>;
}> {
  await assertAdminActor(input.actorUserId);
  const pack = await requireWebUiMessagePackByLocale(input.locale);
  const readiness = await assessWebUiCatalogReadinessForLocale({
    locale: pack.locale,
  });
  return { pack, readiness };
}

export async function upsertAdminWebUiMessagePack(input: {
  readonly actorUserId: string;
  readonly body: unknown;
}): Promise<{
  readonly pack: WebUiMessagePackRecord;
  readonly validation: ReturnType<typeof validateWebUiMessageTreeAgainstEnglish>;
  readonly readiness: Awaited<ReturnType<typeof assessWebUiCatalogReadinessForLocale>>;
}> {
  const admin = await assertAdminActor(input.actorUserId);
  const body = (input.body ?? {}) as Record<string, unknown>;
  const locale = typeof body.locale === "string" ? body.locale.trim() : "";
  const canonicalLocale = await resolvePackLocale(locale);

  if (body.messages == null || typeof body.messages !== "object" || Array.isArray(body.messages)) {
    throw new AdministrationValidationError("messages object is required.");
  }

  if (!Object.prototype.hasOwnProperty.call(body, "expectedRevision")) {
    throw new AdministrationValidationError(
      "expectedRevision is required (number for update, null for create).",
    );
  }

  const expectedRevisionRaw = body.expectedRevision;
  let expectedRevision: number | null;
  if (expectedRevisionRaw === null) {
    expectedRevision = null;
  } else if (
    typeof expectedRevisionRaw === "number" &&
    Number.isInteger(expectedRevisionRaw) &&
    expectedRevisionRaw >= 1
  ) {
    expectedRevision = expectedRevisionRaw;
  } else {
    throw new AdministrationValidationError(
      "expectedRevision must be a positive integer or null.",
    );
  }

  const statusRaw = body.status;
  const status =
    statusRaw === undefined
      ? "published"
      : isWebUiMessagePackStatus(statusRaw)
        ? statusRaw
        : null;
  if (status == null) {
    throw new AdministrationValidationError("status must be draft or published.");
  }

  const messages = body.messages as WebUiMessageTree;
  const validation = validateWebUiMessageTreeAgainstEnglish(messages);
  const pack = await compareAndSetWebUiMessagePack({
    locale: canonicalLocale,
    messages,
    status,
    sourceNote: typeof body.sourceNote === "string" ? body.sourceNote : null,
    updatedByParticipantId: admin.participantId,
    expectedRevision,
  });
  const readiness = await assessWebUiCatalogReadinessForLocale({
    locale: pack.locale,
  });
  return { pack, validation, readiness };
}

export async function getAdminWebUiMessagePackOrNull(input: {
  readonly actorUserId: string;
  readonly locale: string;
}): Promise<WebUiMessagePackRecord | null> {
  await assertAdminActor(input.actorUserId);
  return getWebUiMessagePackByLocale(input.locale);
}

function parseExpectedRevision(raw: unknown): WebUiMessagePackExpectedRevision {
  if (raw === null) {
    return null;
  }
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 1) {
    return raw;
  }
  throw new AdministrationValidationError(
    "expectedRevision must be a positive integer or null.",
  );
}

function requirePackagedCatalog(locale: string): WebUiMessageTree {
  const packaged = loadPackagedWebUiCatalog(locale);
  if (!packaged) {
    throw new WebUiMessagePackValidationError(
      `No packaged WEB_UI catalog is available for locale ${locale} in this build.`,
    );
  }
  return packaged;
}

/**
 * Admin read-only preview: compare published pack vs packaged locale catalog.
 * No writes. No provider calls.
 */
export async function previewAdminAddMissingWebUiFromPackaged(input: {
  readonly actorUserId: string;
  readonly locale: string;
}): Promise<WebUiMessagePackAddMissingPreview> {
  await assertAdminActor(input.actorUserId);
  const locale = await resolvePackLocale(input.locale);
  const packaged = loadPackagedWebUiCatalog(locale);
  const packagedCatalogExists = packaged != null;
  const published = await getPublishedWebUiMessagePackByLocale(locale);

  if (!packagedCatalogExists) {
    const existingKeyCount = countWebUiStringLeaves(published?.messages ?? null);
    return {
      locale,
      currentRevision: published?.revision ?? null,
      existingKeyCount,
      missingKeyCount: 0,
      expectedFinalCount: existingKeyCount,
      packagedCatalogExists: false,
      packStatus: published?.status ?? null,
    };
  }

  const merge = mergeMissingPackagedWebUiMessages({
    existing: published?.messages ?? null,
    packaged,
  });

  return {
    locale,
    currentRevision: published?.revision ?? null,
    existingKeyCount: merge.existingKeyCount,
    missingKeyCount: merge.missingKeyCount,
    expectedFinalCount: merge.expectedFinalCount,
    packagedCatalogExists: true,
    packStatus: published?.status ?? null,
  };
}

/**
 * Admin apply: additive merge of missing packaged leaves into the published pack.
 * Preserves every existing leaf. Uses revision CAS. No-op skips the write.
 */
export async function applyAdminAddMissingWebUiFromPackaged(input: {
  readonly actorUserId: string;
  readonly locale: string;
  readonly body: unknown;
}): Promise<WebUiMessagePackAddMissingResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const locale = await resolvePackLocale(input.locale);
  const body = (input.body ?? {}) as Record<string, unknown>;

  if (!Object.prototype.hasOwnProperty.call(body, "expectedRevision")) {
    throw new AdministrationValidationError(
      "expectedRevision is required (number for update, null for create).",
    );
  }
  const expectedRevision = parseExpectedRevision(body.expectedRevision);
  const packaged = requirePackagedCatalog(locale);

  // Re-read current published pack at apply time (not a GET-then-PUT concurrency mechanism;
  // the write below is still atomic CAS / insertOne).
  const published = await getPublishedWebUiMessagePackByLocale(locale);

  if (published) {
    if (expectedRevision === null) {
      throw new WebUiMessagePackRevisionConflictError(
        `WEB_UI message pack already exists for locale ${locale}.`,
      );
    }
    if (published.revision !== expectedRevision) {
      throw new WebUiMessagePackRevisionConflictError(
        `WEB_UI message pack revision conflict for locale ${locale} (expected ${expectedRevision}).`,
      );
    }

    const merge = mergeMissingPackagedWebUiMessages({
      existing: published.messages,
      packaged,
    });

    if (!merge.changed) {
      const readiness = await assessWebUiCatalogReadinessForLocale({ locale: published.locale });
      const validation = validateWebUiMessageTreeAgainstEnglish(published.messages);
      return {
        locale: published.locale,
        pack: published,
        addedKeyCount: 0,
        existingKeyCount: merge.existingKeyCount,
        missingKeyCount: 0,
        expectedFinalCount: merge.expectedFinalCount,
        changed: false,
        validation,
        readiness,
      };
    }

    const validation = validateWebUiMessageTreeAgainstEnglish(merge.messages);
    if (existingWebUiLeavesChanged(published.messages, merge.messages)) {
      throw new WebUiMessagePackValidationError(
        "Existing published WEB_UI values cannot be changed by Add missing translations.",
      );
    }
    if (
      webUiFoundationFailuresBlockPersist(
        listBlockingWebUiFoundationFailures({
          existing: published.messages,
          next: merge.messages,
        }),
      )
    ) {
      throw new WebUiMessagePackValidationError(
        "Merged WEB_UI catalog failed English foundation validation.",
      );
    }

    const pack = await compareAndSetWebUiMessagePack({
      locale: published.locale,
      messages: merge.messages,
      status: published.status,
      sourceNote: published.sourceNote ?? null,
      updatedByParticipantId: admin.participantId,
      sourceFingerprintsByPath: published.sourceFingerprintsByPath ?? null,
      expectedRevision,
      preserveExistingPublishedLeaves: true,
    });
    const readiness = await assessWebUiCatalogReadinessForLocale({ locale: pack.locale });
    return {
      locale: pack.locale,
      pack,
      addedKeyCount: merge.missingKeyCount,
      existingKeyCount: merge.existingKeyCount,
      missingKeyCount: merge.missingKeyCount,
      expectedFinalCount: merge.expectedFinalCount,
      changed: true,
      validation,
      readiness,
    };
  }

  // No published pack — create-only from packaged catalog.
  if (expectedRevision !== null) {
    throw new WebUiMessagePackRevisionConflictError(
      `WEB_UI message pack revision conflict for locale ${locale} (expected ${expectedRevision}).`,
    );
  }

  // Draft-only pack at same localeKey would conflict on insert (unique index) → 409.
  const anyPack = await getWebUiMessagePackByLocale(locale);
  if (anyPack) {
    throw new WebUiMessagePackRevisionConflictError(
      `WEB_UI message pack already exists for locale ${locale}.`,
    );
  }

  const merge = mergeMissingPackagedWebUiMessages({
    existing: null,
    packaged,
  });
  const validation = validateWebUiMessageTreeAgainstEnglish(merge.messages);
  if (
    validation.rejectedUnknownPaths.length > 0 ||
    validation.rejectedNonStringPaths.length > 0 ||
    validation.placeholderMismatchPaths.length > 0
  ) {
    throw new WebUiMessagePackValidationError(
      "Packaged WEB_UI catalog failed English foundation validation.",
    );
  }

  const pack = await compareAndSetWebUiMessagePack({
    locale,
    messages: merge.messages,
    status: "published",
    sourceNote: "admin-add-missing-from-packaged",
    updatedByParticipantId: admin.participantId,
    expectedRevision: null,
    preserveExistingPublishedLeaves: true,
  });
  const readiness = await assessWebUiCatalogReadinessForLocale({ locale: pack.locale });
  return {
    locale: pack.locale,
    pack,
    addedKeyCount: merge.missingKeyCount,
    existingKeyCount: 0,
    missingKeyCount: merge.missingKeyCount,
    expectedFinalCount: merge.expectedFinalCount,
    changed: true,
    validation,
    readiness,
  };
}

export async function prepareAdminWebUiMessagePack(input: {
  readonly actorUserId: string;
  readonly locale: string;
  readonly scope: WebUiMessagePackPreparationScope;
}): Promise<WebUiMessagePackPreparation> {
  await assertAdminActor(input.actorUserId);
  const locale = await resolvePackLocale(input.locale);
  const selected = selectEnglishWebUiMessages(input.scope);
  const pack = await getWebUiMessagePackByLocale(locale);
  const publicReadiness = await assessWebUiCatalogReadinessForLocale({ locale });
  const participantReadiness = await assessWebUiCatalogReadinessForLocale({
    locale,
    scope: "participant",
  });
  const fullReadiness = await assessWebUiCatalogReadinessForLocale({
    locale,
    requiredPaths: collectStringPaths(loadBundledEnglishWebUiMessagePack()),
  });
  return {
    locale,
    scope: input.scope,
    source: "english-catalog",
    publicRequiredKeyCount: selected.publicRequiredKeyCount,
    participantRequiredKeyCount: selected.participantRequiredKeyCount,
    fullCatalogKeyCount: selected.fullCatalogKeyCount,
    pack: pack ? { status: pack.status, revision: pack.revision } : null,
    publicReadiness,
    participantReadiness,
    fullCatalog: {
      requiredKeyCount: fullReadiness.requiredKeyCount,
      missingKeyCount: fullReadiness.missingKeyCount,
      emptyKeyCount: fullReadiness.emptyKeyCount,
      dataReady: fullReadiness.dataReady,
    },
    messages: selected.messages,
  };
}
