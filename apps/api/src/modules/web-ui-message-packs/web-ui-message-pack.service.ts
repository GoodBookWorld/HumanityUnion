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
  planSelectedPackagedWebUiUpdates,
  type SelectedPackagedReplacement,
  type WebUiSelectedUpdatePreview,
  type WebUiSelectedUpdateResult,
} from "./plan-selected-packaged-web-ui-updates.js";
import {
  ADMIN_CONSENT_ACCEPTED_STATUS_PATH,
  CONSENT_ACCEPTED_STATUS_MIGRATION_PATHS,
  assessConsentAcceptedStatusMigrationReadiness,
  decideConsentAcceptedStatusMigration,
  replaceConsentAcceptedStatusLeaf,
  type ConsentAcceptedStatusMigrationDecision,
  type ConsentAcceptedStatusMigrationReadiness,
} from "./repair-admin-consent-accepted-status.js";
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
  changedWebUiLeafPaths,
  collectStringPaths,
  existingWebUiLeavesChanged,
  listBlockingWebUiFoundationFailures,
  loadBundledEnglishWebUiMessagePack,
  readWebUiStringLeaf,
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

interface SelectedUpdateBody {
  readonly expectedRevision?: unknown;
  readonly paths?: unknown;
  readonly updates?: unknown;
  readonly messages?: unknown;
  readonly status?: unknown;
}

function assertSelectedUpdateBodyHasNoCatalog(body: SelectedUpdateBody): void {
  if (Object.prototype.hasOwnProperty.call(body, "messages")) {
    throw new AdministrationValidationError(
      "Full catalog replacement is not accepted by Update selected translations.",
    );
  }
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    throw new AdministrationValidationError(
      "Update selected translations cannot change published status.",
    );
  }
}

function parseSelectedPaths(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AdministrationValidationError("paths must list at least one selected key.");
  }
  const paths: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new AdministrationValidationError("Each selected path must be a string.");
    }
    paths.push(entry.trim());
  }
  return paths;
}

function parseSelectedReplacements(raw: unknown): SelectedPackagedReplacement[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AdministrationValidationError("updates must list at least one selected key.");
  }
  const updates: SelectedPackagedReplacement[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new AdministrationValidationError("Each selected update must be an object.");
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.path !== "string" || record.path.trim().length === 0) {
      throw new AdministrationValidationError("Each selected update requires a path.");
    }
    if (typeof record.existingValue !== "string" || typeof record.proposedValue !== "string") {
      throw new AdministrationValidationError(
        "Each selected update requires string existingValue and proposedValue.",
      );
    }
    updates.push({
      path: record.path.trim(),
      existingValue: record.existingValue,
      proposedValue: record.proposedValue,
    });
  }
  return updates;
}

function selectedUpdateFailureMessage(plan: {
  readonly validationErrors: readonly string[];
  readonly entries: readonly { readonly path: string; readonly errors: readonly string[] }[];
}): string {
  const details = [
    ...plan.validationErrors,
    ...plan.entries.flatMap((entry) => entry.errors.map((error) => `${entry.path}: ${error}`)),
  ];
  return details[0] ?? "Selected WEB_UI translations failed validation.";
}

/**
 * Admin read-only preview of explicit packaged replacements.
 * No writes. No provider calls. Unlisted catalog differences are ignored.
 */
export async function previewAdminUpdateSelectedWebUiFromPackaged(input: {
  readonly actorUserId: string;
  readonly locale: string;
  readonly body: unknown;
}): Promise<WebUiSelectedUpdatePreview> {
  await assertAdminActor(input.actorUserId);
  const locale = await resolvePackLocale(input.locale);
  const body = (input.body ?? {}) as SelectedUpdateBody;
  assertSelectedUpdateBodyHasNoCatalog(body);
  const paths = parseSelectedPaths(body.paths);
  const packaged = loadPackagedWebUiCatalog(locale);
  const published = await getPublishedWebUiMessagePackByLocale(locale);
  const plan = planSelectedPackagedWebUiUpdates({
    paths,
    published: published?.messages ?? null,
    packaged,
  });
  return {
    locale,
    currentRevision: published?.revision ?? null,
    packStatus: published?.status ?? null,
    selectedKeyCount: paths.length,
    entries: plan.entries,
    validationErrors: plan.validationErrors,
  };
}

/**
 * Replace only the confirmed published leaves with packaged catalog values.
 * One revision compare-and-set writes every selected key or none.
 */
export async function applyAdminUpdateSelectedWebUiFromPackaged(input: {
  readonly actorUserId: string;
  readonly locale: string;
  readonly body: unknown;
}): Promise<WebUiSelectedUpdateResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const locale = await resolvePackLocale(input.locale);
  const body = (input.body ?? {}) as SelectedUpdateBody;
  assertSelectedUpdateBodyHasNoCatalog(body);
  if (!Object.prototype.hasOwnProperty.call(body, "expectedRevision")) {
    throw new AdministrationValidationError(
      "expectedRevision is required (number for update, null for create).",
    );
  }
  const expectedRevision = parseExpectedRevision(body.expectedRevision);
  if (expectedRevision === null) {
    throw new WebUiMessagePackValidationError(
      "Selected translation updates require an existing published revision.",
    );
  }
  const updates = parseSelectedReplacements(body.updates);
  const packaged = loadPackagedWebUiCatalog(locale);
  const published = await getPublishedWebUiMessagePackByLocale(locale);
  if (!published) {
    throw new WebUiMessagePackRevisionConflictError(
      `WEB_UI message pack revision conflict for locale ${locale} (expected ${expectedRevision}).`,
    );
  }
  if (published.revision !== expectedRevision) {
    throw new WebUiMessagePackRevisionConflictError(
      `WEB_UI message pack revision conflict for locale ${locale} (expected ${expectedRevision}).`,
    );
  }

  const plan = planSelectedPackagedWebUiUpdates({
    paths: updates.map((update) => update.path),
    published: published.messages,
    packaged,
    replacements: updates,
  });
  if (
    plan.validationErrors.length > 0 ||
    plan.entries.some((entry) => entry.errors.length > 0) ||
    plan.messages == null
  ) {
    throw new WebUiMessagePackValidationError(selectedUpdateFailureMessage(plan));
  }

  const pack = await compareAndSetWebUiMessagePack({
    locale: published.locale,
    messages: plan.messages,
    status: published.status,
    sourceNote: published.sourceNote ?? null,
    updatedByParticipantId: admin.participantId,
    expectedRevision,
    allowedChangedPaths: updates.map((update) => update.path),
  });
  const readiness = await assessWebUiCatalogReadinessForLocale({ locale: pack.locale });
  return {
    locale: pack.locale,
    pack,
    updatedKeyCount: updates.length,
    paths: updates.map((update) => update.path),
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

const CONSENT_STATUS_MIGRATION_BODY_FIELDS = [
  "confirm",
  "expectedRevision",
  "existingValue",
] as const;

export interface ConsentAcceptedStatusMigrationResult {
  readonly locale: string;
  readonly changed: boolean;
  readonly changedPaths: readonly string[];
  readonly revision: number;
  readonly pack: WebUiMessagePackRecord;
  readonly readiness: ConsentAcceptedStatusMigrationReadiness;
}

export interface ConsentAcceptedStatusMigrationPreview {
  readonly locale: string;
  readonly revision: number;
  readonly path: typeof ADMIN_CONSENT_ACCEPTED_STATUS_PATH;
  readonly action: ConsentAcceptedStatusMigrationDecision["action"];
  readonly reason: string | null;
  readonly publishedValue: string;
  readonly proposedValue: string | null;
  readonly readiness: ConsentAcceptedStatusMigrationReadiness;
}

/**
 * Temporary. Remove with repair-admin-consent-accepted-status.ts after every
 * affected published locale has been repaired.
 */
function parseConsentAcceptedStatusMigrationBody(
  body: unknown,
  mode: "preview" | "apply",
): { readonly expectedRevision: number; readonly existingValue: string } {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    throw new AdministrationValidationError("Request body must be an object.");
  }
  const record = body as Record<string, unknown>;
  const allowed = new Set<string>(CONSENT_STATUS_MIGRATION_BODY_FIELDS);
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) {
      throw new AdministrationValidationError(
        `The consent status migration does not accept ${field}.`,
      );
    }
  }
  if (mode === "apply" && record.confirm !== true) {
    throw new AdministrationValidationError(
      "Explicit confirmation is required. Send confirm: true.",
    );
  }
  if (
    mode === "preview" &&
    Object.prototype.hasOwnProperty.call(record, "confirm") &&
    record.confirm !== true
  ) {
    throw new AdministrationValidationError("confirm must be true when supplied.");
  }
  if (!Object.prototype.hasOwnProperty.call(record, "expectedRevision")) {
    throw new AdministrationValidationError("expectedRevision is required.");
  }
  const expectedRevision = parseExpectedRevision(record.expectedRevision);
  if (expectedRevision === null) {
    throw new AdministrationValidationError(
      "expectedRevision must be the current published revision.",
    );
  }
  if (typeof record.existingValue !== "string") {
    throw new AdministrationValidationError("existingValue must be a string.");
  }
  return { expectedRevision, existingValue: record.existingValue };
}

async function prepareConsentAcceptedStatusMigration(input: {
  readonly actorUserId: string;
  readonly locale: string;
  readonly body: unknown;
  readonly mode: "preview" | "apply";
}): Promise<{
  readonly admin: AdminActor;
  readonly published: WebUiMessagePackRecord;
  readonly publishedValue: string;
  readonly decision: ConsentAcceptedStatusMigrationDecision;
}> {
  const admin = await assertAdminActor(input.actorUserId);
  const parsed = parseConsentAcceptedStatusMigrationBody(input.body, input.mode);
  const locale = await resolvePackLocale(input.locale);
  const published = await getPublishedWebUiMessagePackByLocale(locale);
  if (!published || published.revision !== parsed.expectedRevision) {
    throw new WebUiMessagePackRevisionConflictError(
      `WEB_UI message pack revision conflict for locale ${locale} (expected ${parsed.expectedRevision}).`,
    );
  }
  const publishedValue = readWebUiStringLeaf(
    published.messages,
    ADMIN_CONSENT_ACCEPTED_STATUS_PATH,
  );
  if (publishedValue === undefined) {
    throw new WebUiMessagePackValidationError("Published consent status label is missing.");
  }
  if (publishedValue !== parsed.existingValue) {
    throw new WebUiMessagePackValidationError(
      "existingValue does not match the published consent status label.",
    );
  }
  const packagedValue = readWebUiStringLeaf(
    requirePackagedCatalog(locale),
    ADMIN_CONSENT_ACCEPTED_STATUS_PATH,
  );
  if (packagedValue === undefined) {
    throw new WebUiMessagePackValidationError("Packaged consent status label is missing.");
  }
  const englishValue = readWebUiStringLeaf(
    loadBundledEnglishWebUiMessagePack() as WebUiMessageTree,
    ADMIN_CONSENT_ACCEPTED_STATUS_PATH,
  );
  if (englishValue === undefined) {
    throw new WebUiMessagePackValidationError(
      "Canonical English consent status label is missing.",
    );
  }
  return {
    admin,
    published,
    publishedValue,
    decision: decideConsentAcceptedStatusMigration({
      englishValue,
      publishedValue,
      packagedValue,
    }),
  };
}

export async function previewAdminConsentAcceptedStatusMigration(input: {
  readonly actorUserId: string;
  readonly locale: string;
  readonly body: unknown;
}): Promise<ConsentAcceptedStatusMigrationPreview> {
  const prepared = await prepareConsentAcceptedStatusMigration({ ...input, mode: "preview" });
  const proposedValue =
    prepared.decision.action === "repair" ? prepared.decision.proposedValue : null;
  const readinessMessages =
    proposedValue === null
      ? prepared.published.messages
      : replaceConsentAcceptedStatusLeaf(prepared.published.messages, proposedValue);
  return {
    locale: prepared.published.locale,
    revision: prepared.published.revision,
    path: ADMIN_CONSENT_ACCEPTED_STATUS_PATH,
    action: prepared.decision.action,
    reason: prepared.decision.action === "reject" ? prepared.decision.reason : null,
    publishedValue: prepared.publishedValue,
    proposedValue,
    readiness: assessConsentAcceptedStatusMigrationReadiness(readinessMessages),
  };
}

/**
 * Publish the packaged admin consent-status label for one locale and revision.
 * Temporary. Remove with repair-admin-consent-accepted-status.ts.
 */
export async function applyAdminConsentAcceptedStatusMigration(input: {
  readonly actorUserId: string;
  readonly locale: string;
  readonly body: unknown;
}): Promise<ConsentAcceptedStatusMigrationResult> {
  const prepared = await prepareConsentAcceptedStatusMigration({ ...input, mode: "apply" });
  if (prepared.decision.action === "reject") {
    throw new WebUiMessagePackValidationError(prepared.decision.reason);
  }
  if (prepared.decision.action === "noop") {
    return {
      locale: prepared.published.locale,
      changed: false,
      changedPaths: [],
      revision: prepared.published.revision,
      pack: prepared.published,
      readiness: assessConsentAcceptedStatusMigrationReadiness(prepared.published.messages),
    };
  }

  const nextMessages = replaceConsentAcceptedStatusLeaf(
    prepared.published.messages,
    prepared.decision.proposedValue,
  );
  const changed = changedWebUiLeafPaths(prepared.published.messages, nextMessages);
  if (changed.length !== 1 || changed[0] !== ADMIN_CONSENT_ACCEPTED_STATUS_PATH) {
    throw new WebUiMessagePackValidationError(
      "Consent status migration can change only the approved path.",
    );
  }

  const pack = await compareAndSetWebUiMessagePack({
    locale: prepared.published.locale,
    messages: nextMessages,
    status: prepared.published.status,
    sourceNote: prepared.published.sourceNote,
    updatedByParticipantId: prepared.admin.participantId,
    expectedRevision: prepared.published.revision,
    allowedChangedPaths: CONSENT_ACCEPTED_STATUS_MIGRATION_PATHS,
  });
  return {
    locale: pack.locale,
    changed: true,
    changedPaths: CONSENT_ACCEPTED_STATUS_MIGRATION_PATHS,
    revision: pack.revision,
    pack,
    readiness: assessConsentAcceptedStatusMigrationReadiness(pack.messages),
  };
}
