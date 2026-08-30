/**
 * Production Completion Pack 01 — Admin + public Support operational links.
 */
import type {
  PlatformSupportLink,
  PlatformSupportLinkListResponse,
  PlatformSupportLinkPublic,
  PlatformSupportLinkPublicListResponse,
  PlatformSupportLinkId,
} from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { record as recordAdministrationAudit } from "../administration/audit.service.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  isPlatformSupportLinkId,
  labelForSupportLink,
} from "./platform-support-links.catalog.js";
import {
  PlatformSupportLinkNotFoundError,
  PlatformSupportLinkValidationError,
} from "./platform-support-links.errors.js";
import {
  getPlatformSupportLinkById,
  listPlatformSupportLinks,
  upsertPlatformSupportLink,
} from "./persistence/platform-support-links.repository.js";

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

/**
 * Validate Support operational URLs:
 * - HTTPS absolute external URLs (no credentials)
 * - Safe same-site relative paths starting with a single `/` (not `//`)
 */
export function validatePlatformSupportUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new PlatformSupportLinkValidationError("URL is required.");
  }
  const trimmed = rawUrl.trim();
  if (trimmed.length > 500) {
    throw new PlatformSupportLinkValidationError("URL must be at most 500 characters.");
  }

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//") || trimmed.includes("\\") || trimmed.includes("://")) {
      throw new PlatformSupportLinkValidationError(
        "Relative paths must be same-site paths starting with a single `/`.",
      );
    }
    if (!/^\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$/.test(trimmed)) {
      throw new PlatformSupportLinkValidationError("Relative path contains unsafe characters.");
    }
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new PlatformSupportLinkValidationError(
      "URL must be a valid HTTPS address or same-site relative path.",
    );
  }

  if (parsed.protocol !== "https:") {
    throw new PlatformSupportLinkValidationError("External URLs must use HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new PlatformSupportLinkValidationError("URL must not include credentials.");
  }

  return parsed.toString();
}

function summarizeLink(link: PlatformSupportLink): string {
  const urlState = link.url ? "configured" : "cleared";
  return `link=${link.linkId} enabled=${link.enabled} url=${urlState}`;
}

function toPublicLink(link: PlatformSupportLink): PlatformSupportLinkPublic | null {
  if (!link.enabled || !link.url) {
    return null;
  }
  return {
    linkId: link.linkId,
    label: link.label,
    url: link.url,
  };
}

export async function listPublicPlatformSupportLinks(): Promise<PlatformSupportLinkPublicListResponse> {
  const links = await listPlatformSupportLinks();
  return {
    links: links
      .map(toPublicLink)
      .filter((row): row is PlatformSupportLinkPublic => row !== null),
  };
}

export async function listAdminPlatformSupportLinks(input: {
  actorUserId: string;
}): Promise<PlatformSupportLinkListResponse> {
  await assertAdminActor(input.actorUserId);
  const links = await listPlatformSupportLinks();
  return { links };
}

export async function upsertAdminPlatformSupportLink(input: {
  actorUserId: string;
  linkId: string;
  body: unknown;
}): Promise<PlatformSupportLink> {
  const admin = await assertAdminActor(input.actorUserId);

  if (!isPlatformSupportLinkId(input.linkId)) {
    throw new PlatformSupportLinkNotFoundError();
  }

  if (!input.body || typeof input.body !== "object") {
    throw new AdministrationValidationError("Support link body is required.");
  }
  const body = input.body as Record<string, unknown>;

  const existing =
    (await getPlatformSupportLinkById(input.linkId)) ??
    ({
      linkId: input.linkId,
      label: labelForSupportLink(input.linkId),
      url: null,
      enabled: false,
      updatedAt: new Date(0).toISOString(),
    } satisfies PlatformSupportLink);

  const clearRequested =
    body.clear === true ||
    body.url === null ||
    (typeof body.url === "string" && body.url.trim() === "");

  let nextUrl: string | null;
  let nextEnabled: boolean;

  if (clearRequested) {
    nextUrl = null;
    nextEnabled = false;
  } else {
    nextUrl = validatePlatformSupportUrl(body.url);
    if (body.enabled === undefined) {
      nextEnabled = true;
    } else if (typeof body.enabled === "boolean") {
      nextEnabled = body.enabled;
    } else {
      throw new PlatformSupportLinkValidationError("enabled must be a boolean when provided.");
    }
  }

  const saved = await upsertPlatformSupportLink({
    linkId: input.linkId,
    label: labelForSupportLink(input.linkId),
    url: nextUrl,
    enabled: nextEnabled && Boolean(nextUrl),
    updatedAt: new Date().toISOString(),
    updatedByParticipantId: admin.participantId,
  });

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: clearRequested ? "platform.support_link.clear" : "platform.support_link.update",
    targetType: "platform_support_link",
    targetId: input.linkId,
    scope: { scopeType: "global" },
    beforeSummary: summarizeLink(existing),
    afterSummary: summarizeLink(saved),
  });

  return saved;
}

/** Resolve a public URL for a link id with seed fallback for Support page resilience. */
export async function resolvePublicSupportLinkUrl(
  linkId: PlatformSupportLinkId,
): Promise<string | null> {
  const links = await listPlatformSupportLinks();
  const match = links.find((link) => link.linkId === linkId);
  if (match?.enabled && match.url) {
    return match.url;
  }
  return null;
}
