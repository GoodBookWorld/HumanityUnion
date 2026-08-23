import { randomUUID } from "node:crypto";

import { getCountryByCode, normalizeCountryInput } from "@hu/geography";
import type {
  CountryAffiliationEntry,
  CountryAffiliationEntryType,
  CountryAffiliationPublic,
} from "@hu/types";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { AuditService } from "../administration/audit.service.js";
import {
  CountryAffiliationConflictError,
  CountryAffiliationForbiddenDeleteError,
  CountryAffiliationNotFoundError,
  CountryAffiliationValidationError,
} from "./country-affiliation.errors.js";
import {
  deleteCountryAffiliation,
  getCountryAffiliationById,
  listCountryAffiliations,
  upsertCountryAffiliation,
  type ListCountryAffiliationsFilter,
} from "./persistence/country-affiliation.repository.js";

const ENTRY_TYPES = new Set<CountryAffiliationEntryType>(["TEAM_MEMBER", "PARTNER"]);
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let adminAssertOverrideForTests:
  | ((userId: string) => Promise<{ userId: string; memberId: string }>)
  | null = null;

export function setCountryAffiliationAdminAssertOverrideForTests(
  override:
    | ((userId: string) => Promise<{ userId: string; memberId: string }>)
    | null,
): void {
  adminAssertOverrideForTests = override;
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

async function assertCountryPeopleMutationActor(
  userId: string,
  countryCode: string,
): Promise<{ userId: string; memberId: string }> {
  if (adminAssertOverrideForTests) {
    return adminAssertOverrideForTests(userId);
  }
  const { assertAdminOrEditorCanMutate } = await import("../editor-grants/editor-grant.dual-auth.js");
  const {
    countryAffiliationCompatibleWithEditorScope,
    countryAffiliationContentGeography,
  } = await import("../editor-grants/editor-content-geography.js");
  const { findEditorGrantByParticipantId } = await import(
    "../editor-grants/editor-grant.repository.js"
  );
  const { findAuthUserById: findUser } = await import("../auth/auth-user.repository.js");

  const actor = await assertAdminOrEditorCanMutate({
    actorUserId: userId,
    capability: "COUNTRY_PEOPLE_EDIT",
    content: countryAffiliationContentGeography(countryCode),
  });

  if (actor.authority === "editor") {
    const user = await findUser(userId);
    const grant = user ? await findEditorGrantByParticipantId(user.memberId) : null;
    if (
      !grant ||
      !countryAffiliationCompatibleWithEditorScope(grant.geographicScope, countryCode)
    ) {
      throw new AdministrationForbiddenError(
        "You do not have Editor permission for this content.",
      );
    }
  }

  return { userId: actor.userId, memberId: actor.participantId };
}

function assertEntryType(value: string): CountryAffiliationEntryType {
  if (!ENTRY_TYPES.has(value as CountryAffiliationEntryType)) {
    throw new CountryAffiliationValidationError(
      `entryType must be TEAM_MEMBER or PARTNER.`,
    );
  }
  return value as CountryAffiliationEntryType;
}

function assertCountryCode(value: string | null | undefined): string {
  const normalized = normalizeCountryInput(value ?? "");
  if (!normalized) {
    throw new CountryAffiliationValidationError("countryCode is required.");
  }
  const country = getCountryByCode(normalized);
  if (!country) {
    throw new CountryAffiliationValidationError(`Unknown countryCode: ${normalized}.`);
  }
  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeOptionalEmail(value: string | null | undefined): string | null {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.toLowerCase();
  if (!SIMPLE_EMAIL_PATTERN.test(normalized)) {
    throw new CountryAffiliationValidationError("email must be a valid email address.");
  }
  return normalized;
}

function normalizeOptionalWebsiteUrl(
  value: string | null | undefined,
): string | null {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
    return trimmed;
  } catch {
    throw new CountryAffiliationValidationError(
      "websiteUrl must be an absolute http(s) URL.",
    );
  }
}

function normalizeOptionalImageUrl(
  value: string | null | undefined,
): string | null {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
    return trimmed;
  } catch {
    throw new CountryAffiliationValidationError(
      "imageUrl must be an absolute http(s) URL or a site-relative path.",
    );
  }
}

function summarizeEntry(entry: CountryAffiliationEntry): string {
  return `${entry.entryType}:${entry.countryCode}:${entry.name}:${entry.active ? "active" : "inactive"}`;
}

export function toPublicProjection(
  entry: CountryAffiliationEntry,
): CountryAffiliationPublic {
  return {
    entryId: entry.entryId,
    countryCode: entry.countryCode,
    entryType: entry.entryType,
    name: entry.name,
    roleOrPosition: entry.roleOrPosition ?? null,
    imageUrl: entry.imageUrl ?? null,
    email: entry.email ?? null,
    websiteUrl: entry.websiteUrl ?? null,
    sortOrder: entry.sortOrder,
  };
}

export interface AdminCountryAffiliationCreateInput {
  actorUserId: string;
  countryCode: string;
  entryType: CountryAffiliationEntryType;
  name: string;
  roleOrPosition?: string | null;
  imageUrl?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  sortOrder?: number;
  active?: boolean;
  entryId?: string;
}

export interface AdminCountryAffiliationUpdateInput {
  actorUserId: string;
  entryId: string;
  countryCode?: string;
  entryType?: CountryAffiliationEntryType;
  name?: string;
  roleOrPosition?: string | null;
  imageUrl?: string | null;
  email?: string | null;
  websiteUrl?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export async function listAdminCountryAffiliations(input: {
  actorUserId: string;
  countryCode?: string;
  entryType?: CountryAffiliationEntryType;
  active?: boolean;
}): Promise<CountryAffiliationEntry[]> {
  await assertAdminUser(input.actorUserId);

  const filter: ListCountryAffiliationsFilter = {};
  if (input.countryCode !== undefined) {
    filter.countryCode = assertCountryCode(input.countryCode);
  }
  if (input.entryType) {
    filter.entryType = assertEntryType(input.entryType);
  }
  if (input.active !== undefined) {
    filter.active = input.active;
  }

  return listCountryAffiliations(filter);
}

export async function getAdminCountryAffiliation(input: {
  actorUserId: string;
  entryId: string;
}): Promise<CountryAffiliationEntry> {
  await assertAdminUser(input.actorUserId);
  const entry = await getCountryAffiliationById(input.entryId);
  if (!entry) {
    throw new CountryAffiliationNotFoundError();
  }
  return entry;
}

export async function createAdminCountryAffiliation(
  input: AdminCountryAffiliationCreateInput,
): Promise<CountryAffiliationEntry> {
  const countryCode = assertCountryCode(input.countryCode);
  const admin = await assertCountryPeopleMutationActor(input.actorUserId, countryCode);

  const entryType = assertEntryType(input.entryType);
  const name = input.name?.trim();
  if (!name) {
    throw new CountryAffiliationValidationError("name is required.");
  }

  const entryId = input.entryId?.trim() || `country-affiliation-${randomUUID()}`;
  if (await getCountryAffiliationById(entryId)) {
    throw new CountryAffiliationConflictError(
      `Country affiliation entryId already exists: ${entryId}.`,
    );
  }

  const now = new Date().toISOString();
  const entry: CountryAffiliationEntry = {
    entryId,
    countryCode,
    entryType,
    name,
    roleOrPosition: normalizeOptionalText(input.roleOrPosition),
    imageUrl: normalizeOptionalImageUrl(input.imageUrl),
    email: normalizeOptionalEmail(input.email),
    websiteUrl: normalizeOptionalWebsiteUrl(input.websiteUrl),
    sortOrder:
      typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
        ? Math.trunc(input.sortOrder)
        : 1000,
    active: input.active !== false,
    createdAt: now,
    updatedAt: now,
  };

  await upsertCountryAffiliation(entry);
  await AuditService.record({
    actorParticipantId: admin.memberId,
    action: "country_affiliation.create",
    targetType: "country_affiliation",
    targetId: entry.entryId,
    afterSummary: summarizeEntry(entry),
  });
  return entry;
}

export async function updateAdminCountryAffiliation(
  input: AdminCountryAffiliationUpdateInput,
): Promise<CountryAffiliationEntry> {
  const existing = await getCountryAffiliationById(input.entryId);
  if (!existing) {
    throw new CountryAffiliationNotFoundError();
  }

  const countryCode =
    input.countryCode !== undefined
      ? assertCountryCode(input.countryCode)
      : existing.countryCode;
  const admin = await assertCountryPeopleMutationActor(input.actorUserId, existing.countryCode);
  await assertCountryPeopleMutationActor(input.actorUserId, countryCode);

  const entryType =
    input.entryType !== undefined
      ? assertEntryType(input.entryType)
      : existing.entryType;
  const name = input.name !== undefined ? input.name.trim() : existing.name;
  if (!name) {
    throw new CountryAffiliationValidationError("name is required.");
  }

  const entry: CountryAffiliationEntry = {
    ...existing,
    countryCode,
    entryType,
    name,
    roleOrPosition:
      input.roleOrPosition !== undefined
        ? normalizeOptionalText(input.roleOrPosition)
        : existing.roleOrPosition ?? null,
    imageUrl:
      input.imageUrl !== undefined
        ? normalizeOptionalImageUrl(input.imageUrl)
        : existing.imageUrl ?? null,
    email:
      input.email !== undefined
        ? normalizeOptionalEmail(input.email)
        : existing.email ?? null,
    websiteUrl:
      input.websiteUrl !== undefined
        ? normalizeOptionalWebsiteUrl(input.websiteUrl)
        : existing.websiteUrl ?? null,
    sortOrder:
      typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
        ? Math.trunc(input.sortOrder)
        : existing.sortOrder,
    active: input.active !== undefined ? input.active : existing.active,
    updatedAt: new Date().toISOString(),
  };

  await upsertCountryAffiliation(entry);
  await AuditService.record({
    actorParticipantId: admin.memberId,
    action: "country_affiliation.update",
    targetType: "country_affiliation",
    targetId: entry.entryId,
    beforeSummary: summarizeEntry(existing),
    afterSummary: summarizeEntry(entry),
  });
  return entry;
}

export async function activateAdminCountryAffiliation(input: {
  actorUserId: string;
  entryId: string;
}): Promise<CountryAffiliationEntry> {
  const existing = await getCountryAffiliationById(input.entryId);
  if (!existing) {
    throw new CountryAffiliationNotFoundError();
  }
  const admin = await assertCountryPeopleMutationActor(input.actorUserId, existing.countryCode);
  if (existing.active) {
    return existing;
  }
  const entry: CountryAffiliationEntry = {
    ...existing,
    active: true,
    updatedAt: new Date().toISOString(),
  };
  await upsertCountryAffiliation(entry);
  await AuditService.record({
    actorParticipantId: admin.memberId,
    action: "country_affiliation.activate",
    targetType: "country_affiliation",
    targetId: entry.entryId,
    beforeSummary: summarizeEntry(existing),
    afterSummary: summarizeEntry(entry),
  });
  return entry;
}

export async function deactivateAdminCountryAffiliation(input: {
  actorUserId: string;
  entryId: string;
}): Promise<CountryAffiliationEntry> {
  const existing = await getCountryAffiliationById(input.entryId);
  if (!existing) {
    throw new CountryAffiliationNotFoundError();
  }
  const admin = await assertCountryPeopleMutationActor(input.actorUserId, existing.countryCode);
  if (!existing.active) {
    return existing;
  }
  const entry: CountryAffiliationEntry = {
    ...existing,
    active: false,
    updatedAt: new Date().toISOString(),
  };
  await upsertCountryAffiliation(entry);
  await AuditService.record({
    actorParticipantId: admin.memberId,
    action: "country_affiliation.deactivate",
    targetType: "country_affiliation",
    targetId: entry.entryId,
    beforeSummary: summarizeEntry(existing),
    afterSummary: summarizeEntry(entry),
  });
  return entry;
}

export async function deleteAdminCountryAffiliation(input: {
  actorUserId: string;
  entryId: string;
  hard?: boolean;
}): Promise<{ entry: CountryAffiliationEntry | null; softDeactivated: boolean }> {
  const admin = await assertAdminUser(input.actorUserId);
  const existing = await getCountryAffiliationById(input.entryId);
  if (!existing) {
    throw new CountryAffiliationNotFoundError();
  }

  if (!input.hard) {
    if (!existing.active) {
      return { entry: existing, softDeactivated: true };
    }
    const entry: CountryAffiliationEntry = {
      ...existing,
      active: false,
      updatedAt: new Date().toISOString(),
    };
    await upsertCountryAffiliation(entry);
    await AuditService.record({
      actorParticipantId: admin.memberId,
      action: "country_affiliation.deactivate",
      targetType: "country_affiliation",
      targetId: entry.entryId,
      beforeSummary: summarizeEntry(existing),
      afterSummary: summarizeEntry(entry),
    });
    return { entry, softDeactivated: true };
  }

  if (existing.active) {
    throw new CountryAffiliationForbiddenDeleteError(
      "Hard delete requires the entry to be inactive first.",
    );
  }

  await deleteCountryAffiliation(existing.entryId);
  await AuditService.record({
    actorParticipantId: admin.memberId,
    action: "country_affiliation.delete",
    targetType: "country_affiliation",
    targetId: existing.entryId,
    beforeSummary: summarizeEntry(existing),
  });
  return { entry: null, softDeactivated: false };
}

export async function listPublicByCountry(
  countryCodeInput: string,
  entryType?: CountryAffiliationEntryType,
): Promise<CountryAffiliationPublic[]> {
  const countryCode = normalizeCountryInput(countryCodeInput);
  if (!countryCode || !getCountryByCode(countryCode)) {
    return [];
  }

  const filter: ListCountryAffiliationsFilter = {
    countryCode,
    active: true,
  };
  if (entryType) {
    filter.entryType = assertEntryType(entryType);
  }

  const entries = await listCountryAffiliations(filter);
  return entries.map(toPublicProjection);
}
