/**
 * SEO Pack 07 — Admin page SEO override service.
 */
import { getCountryByCode } from "@hu/geography";
import type {
  SeoPageOverride,
  SeoPageOverrideFamily,
  SeoPageOverrideFields,
  SeoPageOverridePublicView,
} from "@hu/types";
import {
  buildSeoPageOverrideId,
  seoPageOverrideHasCustomFields,
} from "@hu/types";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { record as recordAdministrationAudit } from "../administration/audit.service.js";
import {
  SeoPageOverrideForbiddenTargetError,
  SeoPageOverrideNotFoundError,
  SeoPageOverrideValidationError,
} from "./seo-page-overrides.errors.js";
import {
  deleteSeoPageOverride,
  getSeoPageOverrideByPageId,
  listSeoPageOverrides,
  upsertSeoPageOverride,
} from "./persistence/seo-page-overrides.repository.js";
import {
  expectedCanonicalPathForSeoPage,
  parseSeoPageOverrideFamily,
  validateSeoPageCanonicalPath,
  validateSeoPageEntityKey,
  validateSeoPageOverrideFields,
} from "./seo-page-overrides.validators.js";

async function assertAdminActor(userId: string): Promise<{
  userId: string;
  participantId: string;
}> {
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

function summarizeOverride(override: SeoPageOverride | null): string | undefined {
  if (!override) {
    return "none";
  }
  const keys = Object.keys(override.fields).filter(
    (key) => (override.fields as Record<string, string | undefined>)[key],
  );
  return `${override.pageId} fields=[${keys.join(",")}]`;
}

function toPublicView(override: SeoPageOverride | null, input: {
  family: SeoPageOverrideFamily;
  entityKey: string;
  canonicalPath: string;
}): SeoPageOverridePublicView {
  const fields = override?.fields ?? {};
  return {
    family: input.family,
    entityKey: input.entityKey,
    canonicalPath: input.canonicalPath,
    fields,
    mode: seoPageOverrideHasCustomFields(fields) ? "customized" : "automatic",
  };
}

/**
 * Validate that the target identity is a known public-page family identity.
 * Does not load private entity payloads into the SEO API response.
 */
export function assertEditableSeoPageTarget(input: {
  family: SeoPageOverrideFamily;
  entityKey: string;
}): void {
  if (input.family === "country") {
    const country = getCountryByCode(input.entityKey);
    if (!country) {
      throw new SeoPageOverrideForbiddenTargetError("Unknown Country code.");
    }
  }
  // Initiative / Knowledge / Civic Archive identity format is validated;
  // existence is checked at public render time. Guessing private IDs only
  // stores unused presentation metadata and never exposes private content.
}

export async function getAdminSeoPageOverride(input: {
  actorUserId: string;
  family: string;
  entityKey: string;
}): Promise<SeoPageOverridePublicView> {
  await assertAdminActor(input.actorUserId);
  const family = parseSeoPageOverrideFamily(input.family);
  const entityKey = validateSeoPageEntityKey(family, input.entityKey);
  const canonicalPath = expectedCanonicalPathForSeoPage(family, entityKey);
  assertEditableSeoPageTarget({ family, entityKey });

  const pageId = buildSeoPageOverrideId(family, entityKey);
  const existing = await getSeoPageOverrideByPageId(pageId);
  return toPublicView(existing, { family, entityKey, canonicalPath });
}

export async function listAdminSeoPageOverrideIds(input: {
  actorUserId: string;
  family?: string;
}): Promise<{ pageIds: string[] }> {
  await assertAdminActor(input.actorUserId);
  const family = input.family ? parseSeoPageOverrideFamily(input.family) : undefined;
  const rows = await listSeoPageOverrides({ family });
  return {
    pageIds: rows
      .filter((row) => seoPageOverrideHasCustomFields(row.fields))
      .map((row) => row.pageId),
  };
}

export async function upsertAdminSeoPageOverride(input: {
  actorUserId: string;
  family: string;
  entityKey: string;
  canonicalPath: string;
  fields: unknown;
}): Promise<SeoPageOverridePublicView> {
  const admin = await assertAdminActor(input.actorUserId);
  const family = parseSeoPageOverrideFamily(input.family);
  const entityKey = validateSeoPageEntityKey(family, input.entityKey);
  const canonicalPath = validateSeoPageCanonicalPath(family, entityKey, input.canonicalPath);
  assertEditableSeoPageTarget({ family, entityKey });

  const fields = validateSeoPageOverrideFields(input.fields);
  const pageId = buildSeoPageOverrideId(family, entityKey);
  const existing = await getSeoPageOverrideByPageId(pageId);

  if (!seoPageOverrideHasCustomFields(fields)) {
    if (existing) {
      await deleteSeoPageOverride(pageId);
      await recordAdministrationAudit({
        actorParticipantId: admin.participantId,
        action: "seo.page_override.clear",
        targetType: "seo_page_override",
        targetId: pageId,
        scope: { scopeType: "global" },
        beforeSummary: summarizeOverride(existing),
        afterSummary: "none",
      });
    }
    return toPublicView(null, { family, entityKey, canonicalPath });
  }

  const now = new Date().toISOString();
  const saved: SeoPageOverride = {
    pageId,
    family,
    entityKey,
    canonicalPath,
    fields,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    updatedByParticipantId: admin.participantId,
  };

  await upsertSeoPageOverride(saved);
  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: existing ? "seo.page_override.update" : "seo.page_override.create",
    targetType: "seo_page_override",
    targetId: pageId,
    scope: { scopeType: "global" },
    beforeSummary: summarizeOverride(existing),
    afterSummary: summarizeOverride(saved),
  });

  return toPublicView(saved, { family, entityKey, canonicalPath });
}

export async function clearAdminSeoPageOverride(input: {
  actorUserId: string;
  family: string;
  entityKey: string;
}): Promise<SeoPageOverridePublicView> {
  const admin = await assertAdminActor(input.actorUserId);
  const family = parseSeoPageOverrideFamily(input.family);
  const entityKey = validateSeoPageEntityKey(family, input.entityKey);
  const canonicalPath = expectedCanonicalPathForSeoPage(family, entityKey);
  assertEditableSeoPageTarget({ family, entityKey });

  const pageId = buildSeoPageOverrideId(family, entityKey);
  const existing = await getSeoPageOverrideByPageId(pageId);
  if (!existing) {
    throw new SeoPageOverrideNotFoundError();
  }

  await deleteSeoPageOverride(pageId);
  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "seo.page_override.clear",
    targetType: "seo_page_override",
    targetId: pageId,
    scope: { scopeType: "global" },
    beforeSummary: summarizeOverride(existing),
    afterSummary: "none",
  });

  return toPublicView(null, { family, entityKey, canonicalPath });
}

/** Public read for metadata merge — no private entity payload. */
export async function getPublicSeoPageOverride(input: {
  family: string;
  entityKey: string;
}): Promise<SeoPageOverridePublicView | null> {
  let family: SeoPageOverrideFamily;
  let entityKey: string;
  try {
    family = parseSeoPageOverrideFamily(input.family);
    entityKey = validateSeoPageEntityKey(family, input.entityKey);
  } catch (error) {
    if (error instanceof SeoPageOverrideValidationError) {
      return null;
    }
    throw error;
  }

  const canonicalPath = expectedCanonicalPathForSeoPage(family, entityKey);
  const pageId = buildSeoPageOverrideId(family, entityKey);
  const existing = await getSeoPageOverrideByPageId(pageId);
  if (!existing || !seoPageOverrideHasCustomFields(existing.fields)) {
    return null;
  }
  return toPublicView(existing, { family, entityKey, canonicalPath });
}

export function mergeSeoOverrideFields(
  automatic: {
    title: string;
    description?: string | null;
    socialTitle?: string | null;
    socialDescription?: string | null;
    imageUrl?: string | null;
  },
  override: SeoPageOverrideFields | null | undefined,
): {
  title: string;
  description?: string | null;
  socialTitle?: string | null;
  socialDescription?: string | null;
  imageUrl?: string | null;
} {
  if (!override || !seoPageOverrideHasCustomFields(override)) {
    return automatic;
  }
  return {
    title: override.seoTitle?.trim() || automatic.title,
    description: override.seoDescription?.trim() || automatic.description,
    socialTitle: override.socialTitle?.trim() || automatic.socialTitle || automatic.title,
    socialDescription:
      override.socialDescription?.trim() ||
      automatic.socialDescription ||
      override.seoDescription?.trim() ||
      automatic.description,
    imageUrl: override.socialImageUrl?.trim() || automatic.imageUrl,
  };
}
