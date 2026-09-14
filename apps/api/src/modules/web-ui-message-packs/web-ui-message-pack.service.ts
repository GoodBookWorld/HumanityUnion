/**
 * Admin WEB_UI message pack services — data import only (no TranslationProvider).
 */

import type {
  WebUiMessagePackAdminListResponse,
  WebUiMessagePackRecord,
  WebUiMessagePackUpsertInput,
  WebUiMessageTree,
} from "@hu/types";
import { isWebUiMessagePackStatus } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { resolveLanguageRegistryLocale } from "../language/language-registry/language-registry.repository.js";
import { assessWebUiCatalogReadinessForLocale } from "../language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import {
  WebUiMessagePackNotFoundError,
  WebUiMessagePackValidationError,
} from "./web-ui-message-pack.errors.js";
import {
  getWebUiMessagePackByLocale,
  listWebUiMessagePacks,
  requireWebUiMessagePackByLocale,
  upsertWebUiMessagePack,
} from "./web-ui-message-pack.repository.js";
import { validateWebUiMessageTreeAgainstEnglish } from "./web-ui-message-pack.validate.js";

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
  if (!locale) {
    throw new AdministrationValidationError("locale is required.");
  }

  const registry = await resolveLanguageRegistryLocale(locale);
  if (!registry) {
    throw new WebUiMessagePackValidationError(
      `Locale is not in Language Registry: ${locale}`,
    );
  }

  if (body.messages == null || typeof body.messages !== "object" || Array.isArray(body.messages)) {
    throw new AdministrationValidationError("messages object is required.");
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

  const upsertInput: WebUiMessagePackUpsertInput = {
    locale: registry.locale,
    messages: body.messages as WebUiMessageTree,
    status,
    sourceNote: typeof body.sourceNote === "string" ? body.sourceNote : null,
    updatedByParticipantId: admin.participantId,
  };

  const validation = validateWebUiMessageTreeAgainstEnglish(upsertInput.messages);
  const pack = await upsertWebUiMessagePack(upsertInput);
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
