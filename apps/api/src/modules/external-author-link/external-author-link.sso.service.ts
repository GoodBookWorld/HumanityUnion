import { randomBytes } from "node:crypto";

import { logger } from "../../shared/observability/logger.js";
import { AuthCodeRateLimitError } from "../auth/auth.errors.js";
import { assertAuthCodeSendAllowed } from "../auth/auth-code-rate-limit.js";
import {
  buildRegistrationPendingConfirmationResultAsync,
  queueRegistrationConfirmationCode,
} from "../auth/auth-email-confirmation.service.js";
import { issueAuthSession } from "../auth/auth-session.issue.js";
import type { AuthUserRecord } from "../auth/auth-user.types.js";
import {
  findActiveEmailConfirmationCode,
  findLatestEmailConfirmationSendAt,
} from "../email/email-confirmation-code.repository.js";
import { resolveIntegrityMediaLinkConfig } from "./external-author-link.config.js";
import {
  INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN,
  INTEGRITY_MEDIA_AUTHOR_ID_PATTERN,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
  INTEGRITY_MEDIA_SSO_GRANT_TTL_MS,
} from "./external-author-link.constants.js";
import {
  integrityMediaLinkSignaturesEqual,
  signIntegrityMediaLinkRedeem,
} from "./external-author-link.hmac.js";
import { readRawPlatformMode } from "./external-author-link.provision.service.js";
import { linkRevisionMatches } from "./external-author-link.revision.js";
import {
  currentSsoDatabase,
  runSsoTransaction,
  withSsoLock,
  type SsoDatabase,
  type SsoGrantRecord,
} from "./external-author-link.sso.database.js";
import { buildSsoGrantPayload } from "./external-author-link.sso.hmac.js";
import type { ExternalAuthorLinkRecord } from "./external-author-link.types.js";

const SSO_GRANT_PATH = "/connect/integrity-media/sso";
const SSO_GRANT_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SSO_WEB_ORIGIN_BY_RAW_PLATFORM_MODE: Readonly<Record<string, string>> = {
  staging: "https://staging.huws.org",
  production: "https://huws.org",
};
const WORKSPACE_DESTINATION = "/workspace";
const CONFIRMATION_DESTINATION = "/confirm-email";
const CONFIRMATION_PURPOSE = "registration_email_confirmation" as const;
const LINK_REVISION_LIMIT = 1_000_000;

export class SsoRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SsoRequestError";
  }
}

export interface SsoRegistrationResult {
  grantUrl: string;
}

export interface SsoSessionCompletion {
  kind: "session";
  destination: typeof WORKSPACE_DESTINATION;
  tokens: { accessToken: string; refreshToken: string };
}

export interface SsoConfirmationCompletion {
  kind: "confirmation";
  destination: typeof CONFIRMATION_DESTINATION;
  emailConfirmationRequired: true;
  emailSent: boolean;
  maskedEmail: string;
  resendAvailableAt: string | null;
  pendingConfirmationToken: string;
  emailDeliveryError?: string;
}

export type SsoCompletionResult = SsoSessionCompletion | SsoConfirmationCompletion;

interface NormalizedSsoRequest {
  timestamp: string;
  requestId: string;
  externalAuthorId: string;
  memberId: string;
  linkRevision: number;
  target: string;
}

interface ResolvedSsoIdentity {
  user: AuthUserRecord;
  memberId: string;
}

interface SsoLogFields {
  outcome: string;
  externalAuthorId?: string;
  memberId?: string;
  target?: string;
  linkRevision?: number;
  emailSent?: boolean;
}

type StoredGrant = { grantId: string; created: boolean };

type TransactionCompletion =
  | {
      kind: "session";
      destination: typeof WORKSPACE_DESTINATION;
      tokens: { accessToken: string; refreshToken: string };
      log: SsoLogFields;
    }
  | { kind: "pending"; user: AuthUserRecord; log: SsoLogFields };

let ssoNow: () => Date = () => new Date();

/** Unit tests only. Production always reads the system clock. */
export function setSsoNowForTests(clock: (() => Date) | null): void {
  if (clock && process.env.NODE_TEST_ENV !== "true") {
    throw new Error("SSO test clock is unavailable.");
  }

  ssoNow = clock ?? (() => new Date());
}

export async function registerSsoGrant(input: {
  body: unknown;
  timestamp: string;
  signature: string;
  now?: Date;
}): Promise<SsoRegistrationResult> {
  const now = input.now ?? ssoNow();
  const normalized = normalizeSsoBody(input.body);
  verifySsoSignature({
    normalized,
    timestamp: input.timestamp,
    signature: input.signature,
    now,
  });

  if (normalized.target !== readRawPlatformMode()) {
    fail(
      403,
      "target_mismatch",
      "This sign-in request is for a different Humanity Union environment.",
      normalized,
    );
  }

  const origin = resolveHuWebOrigin();
  const stored = await withSsoLock(() => storeSsoGrant(normalized, now));

  if (stored.created) {
    logSso({
      outcome: "grant_created",
      externalAuthorId: normalized.externalAuthorId,
      memberId: normalized.memberId,
      target: normalized.target,
      linkRevision: normalized.linkRevision,
    });
  }

  return { grantUrl: buildGrantUrl(origin, stored.grantId) };
}

export async function completeSsoGrant(input: {
  body: unknown;
  userAgent?: string;
  ipKey?: string;
  now?: Date;
}): Promise<SsoCompletionResult> {
  const now = input.now ?? ssoNow();
  const grantId = normalizeGrantId(input.body);
  const nowIso = now.toISOString();
  const completed = await runSsoTransaction((db) =>
    consumeSsoGrant(db, grantId, nowIso, input.userAgent, input.ipKey),
  );

  if (completed.kind === "session") {
    logSso(completed.log);
    return {
      kind: "session",
      destination: completed.destination,
      tokens: completed.tokens,
    };
  }

  return finishPendingConfirmation(completed.user, completed.log, input.ipKey);
}

async function consumeSsoGrant(
  db: SsoDatabase,
  grantId: string,
  nowIso: string,
  userAgent: string | undefined,
  ipKey: string | undefined,
): Promise<TransactionCompletion> {
  const grant = await loadOpenGrant(db, grantId, nowIso);
  const identity = await resolveSsoIdentity(db, {
    externalAuthorId: grant.externalAuthorId,
    memberId: grant.memberId,
    linkRevision: grant.linkRevision,
  });

  if (identity.user.userId !== grant.userId || identity.memberId !== grant.memberId) {
    fail(409, "identity_mismatch", "This Humanity Union sign-in link is no longer valid.", grant);
  }

  if (grant.target !== readRawPlatformMode()) {
    fail(
      403,
      "target_mismatch",
      "This sign-in request is for a different Humanity Union environment.",
      grant,
    );
  }

  const pending = identity.user.emailVerificationStatus !== "verified";
  if (pending) {
    try {
      await assertPendingConfirmationSendAllowed(identity.user.userId, ipKey);
    } catch (error) {
      if (error instanceof AuthCodeRateLimitError) {
        logSso({
          outcome: "auth_code_rate_limited",
          externalAuthorId: grant.externalAuthorId,
          memberId: grant.memberId,
          target: grant.target,
          linkRevision: grant.linkRevision,
        });
      }
      throw error;
    }
  }

  const consumed = await db.consumeGrant(grant.grantId, nowIso);
  if (!consumed) {
    fail(409, "grant_consumed", "This Humanity Union sign-in link was already used.", grant);
  }

  const log = {
    externalAuthorId: grant.externalAuthorId,
    memberId: grant.memberId,
    target: grant.target,
    linkRevision: grant.linkRevision,
  };

  if (!pending) {
    const session = await issueAuthSession(identity.user, userAgent, { session: db.clientSession });
    return {
      kind: "session",
      destination: WORKSPACE_DESTINATION,
      tokens: {
        accessToken: session.tokens.accessToken,
        refreshToken: session.tokens.refreshToken,
      },
      log: { outcome: "session_issued", ...log },
    };
  }

  return { kind: "pending", user: identity.user, log: { outcome: "confirmation_pending", ...log } };
}

async function storeSsoGrant(normalized: NormalizedSsoRequest, now: Date): Promise<StoredGrant> {
  const db = currentSsoDatabase();
  const existing = await db.findGrantByRequestId(normalized.requestId);

  if (existing) {
    return { grantId: reuseSsoGrant(existing, normalized, now), created: false };
  }

  const identity = await resolveSsoIdentity(db, normalized);
  const grantId = randomBytes(32).toString("base64url");
  const record: SsoGrantRecord = {
    grantId,
    requestId: normalized.requestId,
    externalAuthorId: normalized.externalAuthorId,
    memberId: normalized.memberId,
    userId: identity.user.userId,
    linkRevision: normalized.linkRevision,
    target: normalized.target,
    expiresAt: new Date(now.getTime() + INTEGRITY_MEDIA_SSO_GRANT_TTL_MS).toISOString(),
    consumedAt: null,
    createdAt: now.toISOString(),
  };
  const inserted = await db.insertGrant(record);

  if (inserted === "inserted") {
    return { grantId, created: true };
  }

  const raced = await db.findGrantByRequestId(normalized.requestId);
  if (!raced) {
    fail(503, "unavailable", "Integrity Media sign-in is not available.", normalized);
  }

  return { grantId: reuseSsoGrant(raced, normalized, now), created: false };
}

function reuseSsoGrant(existing: SsoGrantRecord, normalized: NormalizedSsoRequest, now: Date): string {
  if (!sameSignedRequest(existing, normalized)) {
    fail(409, "request_conflict", "This sign-in request does not match the original request.", normalized);
  }

  if (existing.consumedAt) {
    fail(409, "grant_consumed", "This Humanity Union sign-in link was already used.", normalized);
  }

  if (existing.expiresAt <= now.toISOString()) {
    fail(409, "grant_expired", "This Humanity Union sign-in link has expired.", normalized);
  }

  logSso({
    outcome: "grant_reused",
    externalAuthorId: normalized.externalAuthorId,
    memberId: normalized.memberId,
    target: normalized.target,
    linkRevision: normalized.linkRevision,
  });

  return existing.grantId;
}

/**
 * SMTP runs after the grant transaction commits. A provider failure stays on
 * the existing confirmation path: the account remains pending, the code is
 * discarded by the mailer, and the caller can resend. A crash after consume
 * and before a send does not issue a session; the person starts sign-in again.
 * This is not atomic across SMTP and MongoDB.
 */
async function finishPendingConfirmation(
  user: AuthUserRecord,
  log: SsoLogFields,
  ipKey: string | undefined,
): Promise<SsoConfirmationCompletion> {
  try {
    const delivery = await queueRegistrationConfirmationCode(user.userId, ipKey);
    const confirmation = await buildRegistrationPendingConfirmationResultAsync(
      {
        userId: user.userId,
        memberId: user.memberId,
        email: user.email,
        displayName: user.displayName,
      },
      delivery,
    );

    logSso({ ...log, emailSent: confirmation.emailSent });

    return {
      kind: "confirmation",
      destination: CONFIRMATION_DESTINATION,
      emailConfirmationRequired: true,
      emailSent: confirmation.emailSent,
      maskedEmail: confirmation.maskedEmail,
      resendAvailableAt: confirmation.resendAvailableAt,
      pendingConfirmationToken: confirmation.pendingConfirmationToken,
      emailDeliveryError: confirmation.emailDeliveryError,
    };
  } catch (error) {
    logSso({ ...log, outcome: "confirmation_delivery_failed", emailSent: false });
    if (error instanceof SsoRequestError || error instanceof AuthCodeRateLimitError) {
      throw error;
    }
    throw new SsoRequestError(
      503,
      "unavailable",
      "Integrity Media sign-in could not send the confirmation email. Start sign-in again.",
    );
  }
}

async function loadOpenGrant(db: SsoDatabase, grantId: string, nowIso: string): Promise<SsoGrantRecord> {
  const grant = await db.findGrantById(grantId);

  if (!grant) {
    fail(404, "grant_not_found", "This Humanity Union sign-in link is incomplete.");
  }

  if (grant.consumedAt) {
    fail(409, "grant_consumed", "This Humanity Union sign-in link was already used.", grant);
  }

  if (grant.expiresAt <= nowIso) {
    fail(409, "grant_expired", "This Humanity Union sign-in link has expired.", grant);
  }

  return grant;
}

async function resolveSsoIdentity(
  db: SsoDatabase,
  input: { externalAuthorId: string; memberId: string; linkRevision: number },
): Promise<ResolvedSsoIdentity> {
  const link = await db.findLink(input.externalAuthorId);

  if (!link) {
    fail(404, "author_not_found", "This Integrity Media author is not linked.", input);
  }

  if (link.state === "disabled") {
    fail(409, "link_disabled", "This Integrity Media link is disabled.", input);
  }

  if (!isSsoEligibleLink(link)) {
    fail(409, "link_not_confirmed", "This Integrity Media link is not confirmed.", input);
  }

  if (link.memberId !== input.memberId) {
    fail(409, "member_mismatch", "This sign-in request does not match the linked account.", input);
  }

  if (!linkRevisionMatches(link.linkRevision, input.linkRevision)) {
    fail(409, "revision_mismatch", "This sign-in request does not match the linked account.", input);
  }

  const member = await db.findMember(link.memberId);
  const user = member ? await db.findUser(member.identityId) : null;

  if (!member || !user || user.memberId !== link.memberId) {
    fail(409, "identity_mismatch", "This Humanity Union sign-in link is no longer valid.", input);
  }

  if (user.status !== "active") {
    fail(403, "account_disabled", "This Humanity Union account is disabled.", input);
  }

  return { user, memberId: link.memberId };
}

async function assertPendingConfirmationSendAllowed(
  userId: string,
  ipKey: string | undefined,
): Promise<void> {
  const activeCode = await findActiveEmailConfirmationCode({
    userId,
    purpose: CONFIRMATION_PURPOSE,
  });
  const lastSentAt =
    activeCode?.lastSentAt ??
    (await findLatestEmailConfirmationSendAt({
      userId,
      purpose: CONFIRMATION_PURPOSE,
    })) ??
    undefined;

  await assertAuthCodeSendAllowed({
    userId,
    purpose: CONFIRMATION_PURPOSE,
    ipKey,
    lastSentAt,
    challengeId: activeCode?.confirmationId,
  });
}

function verifySsoSignature(input: {
  normalized: NormalizedSsoRequest;
  timestamp: string;
  signature: string;
  now: Date;
}): void {
  if (input.timestamp !== input.normalized.timestamp) {
    fail(400, "timestamp_mismatch", "The sign-in request is not valid.", input.normalized);
  }

  const config = resolveIntegrityMediaLinkConfig();
  if (!config.hmacSecret) {
    fail(503, "sso_not_configured", "Integrity Media sign-in is not configured.", input.normalized);
  }

  const payload = buildSsoGrantPayload({
    timestamp: input.normalized.timestamp,
    requestId: input.normalized.requestId,
    externalAuthorId: input.normalized.externalAuthorId,
    memberId: input.normalized.memberId,
    linkRevision: String(input.normalized.linkRevision),
    target: input.normalized.target,
  });
  const expected = signIntegrityMediaLinkRedeem(config.hmacSecret, payload);

  if (!integrityMediaLinkSignaturesEqual(expected, input.signature.trim())) {
    fail(401, "invalid_signature", "The Integrity Media signature is not valid.", input.normalized);
  }

  const timestampSeconds = Number(input.normalized.timestamp);
  if (Math.abs(unixSeconds(input.now) - timestampSeconds) > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS) {
    fail(401, "stale_timestamp", "The sign-in timestamp is outside the allowed window.", input.normalized);
  }
}

function normalizeSsoBody(body: unknown): NormalizedSsoRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail(400, "invalid_request", "The sign-in request is not valid.");
  }

  const record = body as Record<string, unknown>;
  const allowed = new Set([
    "timestamp",
    "requestId",
    "externalAuthorId",
    "memberId",
    "linkRevision",
    "target",
  ]);

  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      fail(400, "invalid_request", "The sign-in request is not valid.");
    }
  }

  const timestamp = canonicalTimestamp(record.timestamp);
  const requestId = requiredString(record.requestId);
  const externalAuthorId = requiredString(record.externalAuthorId);
  const memberId = requiredString(record.memberId);
  const linkRevision = canonicalLinkRevision(record.linkRevision);
  const target = requiredString(record.target);

  if (
    !timestamp ||
    !INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN.test(requestId) ||
    !INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(externalAuthorId) ||
    !isMemberId(memberId) ||
    linkRevision === null ||
    !isTarget(target)
  ) {
    fail(400, "invalid_request", "The sign-in request is not valid.");
  }

  return { timestamp, requestId, externalAuthorId, memberId, linkRevision, target };
}

function normalizeGrantId(body: unknown): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail(400, "invalid_request", "The sign-in request is not valid.");
  }

  const record = body as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "grant") {
      fail(400, "invalid_request", "The sign-in request is not valid.");
    }
  }

  const grantId = requiredString(record.grant);
  if (!SSO_GRANT_ID_PATTERN.test(grantId)) {
    fail(400, "invalid_request", "The sign-in request is not valid.");
  }

  return grantId;
}

function resolveHuWebOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const expected = SSO_WEB_ORIGIN_BY_RAW_PLATFORM_MODE[readRawPlatformMode(env)];
  const configured = env.WEB_ORIGIN?.trim() ?? "";

  if (!expected || configured !== expected) {
    fail(503, "sso_not_configured", "Integrity Media sign-in is not configured.");
  }

  return expected;
}

function buildGrantUrl(origin: string, grantId: string): string {
  const url = new URL(SSO_GRANT_PATH, `${origin}/`);
  url.searchParams.set("grant", grantId);
  return url.toString();
}

function isSsoEligibleLink(link: ExternalAuthorLinkRecord): boolean {
  return (
    link.state === "linked" &&
    (link.linkFinalization === "confirmed" || link.linkFinalization === undefined)
  );
}

function sameSignedRequest(existing: SsoGrantRecord, normalized: NormalizedSsoRequest): boolean {
  return (
    existing.externalAuthorId === normalized.externalAuthorId &&
    existing.memberId === normalized.memberId &&
    existing.linkRevision === normalized.linkRevision &&
    existing.target === normalized.target
  );
}

function canonicalTimestamp(value: unknown): string | null {
  if (typeof value === "string" && /^\d{10}$/.test(value)) {
    return value;
  }

  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1_000_000_000 &&
    value <= 9_999_999_999
  ) {
    return String(value);
  }

  return null;
}

function canonicalLinkRevision(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= LINK_REVISION_LIMIT) {
    return value;
  }

  if (typeof value === "string" && /^(?:[1-9][0-9]{0,6})$/.test(value)) {
    const parsed = Number(value);
    if (parsed >= 1 && parsed <= LINK_REVISION_LIMIT) {
      return parsed;
    }
  }

  return null;
}

function requiredString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isMemberId(value: string): boolean {
  return value.length > 0 && value.length <= 200 && value.trim() === value && !/\s/.test(value);
}

function isTarget(value: string): boolean {
  return value.length > 0 && value.length <= 64 && value.trim() === value && !/\s/.test(value);
}

function unixSeconds(now: Date): number {
  return Math.floor(now.getTime() / 1000);
}

function logSso(fields: SsoLogFields): void {
  const payload: Record<string, unknown> = { ...fields };
  logger.info("integrity_media_account_sso", payload);
}

function fail(
  status: number,
  code: string,
  message: string,
  fields: Partial<NormalizedSsoRequest> | SsoGrantRecord = {},
): never {
  logSso({
    outcome: code,
    externalAuthorId: fields.externalAuthorId,
    memberId: fields.memberId,
    target: fields.target,
    linkRevision: fields.linkRevision,
  });
  throw new SsoRequestError(status, code, message);
}
