/**
 * Pack 17C — Admin + public services for canonical platform social account URLs.
 */
import type {
  PlatformSocialAccount,
  PlatformSocialAccountListResponse,
  PlatformSocialAccountPublic,
  PlatformSocialAccountPublicListResponse,
  PlatformSocialNetworkId,
} from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { record as recordAdministrationAudit } from "../administration/audit.service.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  isPlatformSocialNetworkId,
  labelForNetwork,
  PLATFORM_SOCIAL_HOST_ALLOWLIST,
} from "./platform-social-accounts.catalog.js";
import {
  PlatformSocialAccountNotFoundError,
  PlatformSocialAccountValidationError,
} from "./platform-social-accounts.errors.js";
import {
  getPlatformSocialAccountByNetworkId,
  listPlatformSocialAccounts,
  upsertPlatformSocialAccount,
} from "./persistence/platform-social-accounts.repository.js";

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

function hostMatchesAllowlist(hostname: string, allowlist: readonly string[]): boolean {
  const host = hostname.toLowerCase();
  return allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export function validatePlatformSocialUrl(
  networkId: PlatformSocialNetworkId,
  rawUrl: unknown,
): string {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new PlatformSocialAccountValidationError("URL is required.");
  }
  const trimmed = rawUrl.trim();
  if (trimmed.length > 500) {
    throw new PlatformSocialAccountValidationError("URL must be at most 500 characters.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new PlatformSocialAccountValidationError("URL must be a valid absolute HTTPS address.");
  }

  if (parsed.protocol !== "https:") {
    throw new PlatformSocialAccountValidationError("URL must use HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new PlatformSocialAccountValidationError("URL must not include credentials.");
  }

  const allowlist = PLATFORM_SOCIAL_HOST_ALLOWLIST[networkId];
  if (!hostMatchesAllowlist(parsed.hostname, allowlist)) {
    throw new PlatformSocialAccountValidationError(
      `URL host must match an official ${labelForNetwork(networkId)} domain.`,
    );
  }

  return parsed.toString();
}

function summarizeAccount(account: PlatformSocialAccount): string {
  const urlState = account.url ? "configured" : "cleared";
  return `network=${account.networkId} enabled=${account.enabled} url=${urlState}`;
}

function toPublicAccount(account: PlatformSocialAccount): PlatformSocialAccountPublic | null {
  if (!account.enabled || !account.url) {
    return null;
  }
  return {
    networkId: account.networkId,
    label: account.label,
    url: account.url,
  };
}

export async function listPublicPlatformSocialAccounts(): Promise<PlatformSocialAccountPublicListResponse> {
  const accounts = await listPlatformSocialAccounts();
  return {
    accounts: accounts
      .map(toPublicAccount)
      .filter((row): row is PlatformSocialAccountPublic => row !== null),
  };
}

export async function listAdminPlatformSocialAccounts(input: {
  actorUserId: string;
}): Promise<PlatformSocialAccountListResponse> {
  await assertAdminActor(input.actorUserId);
  const accounts = await listPlatformSocialAccounts();
  return { accounts };
}

export async function upsertAdminPlatformSocialAccount(input: {
  actorUserId: string;
  networkId: string;
  body: unknown;
}): Promise<PlatformSocialAccount> {
  const admin = await assertAdminActor(input.actorUserId);

  if (!isPlatformSocialNetworkId(input.networkId)) {
    throw new PlatformSocialAccountNotFoundError();
  }

  if (!input.body || typeof input.body !== "object") {
    throw new AdministrationValidationError("Social account body is required.");
  }
  const body = input.body as Record<string, unknown>;

  const existing =
    (await getPlatformSocialAccountByNetworkId(input.networkId)) ??
    ({
      networkId: input.networkId,
      label: labelForNetwork(input.networkId),
      url: null,
      enabled: false,
      updatedAt: new Date(0).toISOString(),
    } satisfies PlatformSocialAccount);

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
    nextUrl = validatePlatformSocialUrl(input.networkId, body.url);
    if (body.enabled === undefined) {
      nextEnabled = true;
    } else if (typeof body.enabled === "boolean") {
      nextEnabled = body.enabled;
    } else {
      throw new PlatformSocialAccountValidationError("enabled must be a boolean when provided.");
    }
    if (!nextEnabled) {
      // Disabled with a URL still stored for Admin restore, but not public.
      nextEnabled = false;
    }
  }

  const saved = await upsertPlatformSocialAccount({
    networkId: input.networkId,
    label: labelForNetwork(input.networkId),
    url: nextUrl,
    enabled: nextEnabled && Boolean(nextUrl),
    updatedAt: new Date().toISOString(),
    updatedByParticipantId: admin.participantId,
  });

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: clearRequested ? "platform.social_account.clear" : "platform.social_account.update",
    targetType: "platform_social_account",
    targetId: input.networkId,
    scope: { scopeType: "global" },
    beforeSummary: summarizeAccount(existing),
    afterSummary: summarizeAccount(saved),
  });

  return saved;
}
