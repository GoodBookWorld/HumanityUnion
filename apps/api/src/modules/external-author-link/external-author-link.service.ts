import { createHash, randomBytes, randomUUID } from "node:crypto";

import { getMemberById } from "../member/application/member-read.service.js";
import { buildIntegrityMediaReturnUrl } from "./external-author-link.config.js";
import {
  INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN,
  INTEGRITY_MEDIA_AUTHOR_ID_PATTERN,
  INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
  INTEGRITY_MEDIA_RESULT_CODE_PATTERN,
  INTEGRITY_MEDIA_RESULT_TTL_MS,
  INTEGRITY_MEDIA_SOURCE,
} from "./external-author-link.constants.js";
import {
  buildIntegrityMediaLinkRedeemPayload,
  hasIntegrityMediaRedeemSignature,
  integrityMediaLinkSignaturesEqual,
  noteIntegrityMediaRedeemSignature,
  signIntegrityMediaLinkRedeem,
} from "./external-author-link.hmac.js";
import {
  getExternalAuthorLinkStore,
  type ExternalAuthorLinkStore,
} from "./external-author-link.store.js";
import type {
  ExternalAuthorLinkAuditAction,
  ExternalAuthorLinkConflict,
  ExternalAuthorLinkRecord,
} from "./external-author-link.types.js";

export interface IntegrityMediaLinkFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export interface IntegrityMediaPreviewSuccess {
  ok: true;
  source: typeof INTEGRITY_MEDIA_SOURCE;
  displayName: string;
}

export interface IntegrityMediaConfirmSuccess {
  ok: true;
  confirmed: true;
  redirectUrl: string | null;
  resultCode: string;
}

export interface IntegrityMediaCancelSuccess {
  ok: true;
  cancelled: true;
  redirectUrl: string | null;
}

export interface IntegrityMediaRedeemSuccess {
  ok: true;
  memberId: string;
  source: typeof INTEGRITY_MEDIA_SOURCE;
  externalAuthorId: string;
  reconnected: boolean;
}

type DisplayNameResolver = (memberId: string, email: string) => Promise<string>;

let displayNameResolverOverride: DisplayNameResolver | null = null;

export function setIntegrityMediaDisplayNameResolverForTests(
  resolver: DisplayNameResolver | null,
): void {
  displayNameResolverOverride = resolver;
}

export async function previewIntegrityMediaLink(input: {
  memberId: string;
  email: string;
  attemptState: string;
}): Promise<IntegrityMediaPreviewSuccess | IntegrityMediaLinkFailure> {
  if (!isSessionMemberId(input.memberId)) {
    return failure(401, "authentication_required", "Authentication required.");
  }

  if (!INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN.test(input.attemptState)) {
    return failure(400, "invalid_state", "This confirmation link is incomplete.");
  }

  return {
    ok: true,
    source: INTEGRITY_MEDIA_SOURCE,
    displayName: await resolveDisplayName(input.memberId, input.email),
  };
}

export async function confirmIntegrityMediaLink(input: {
  memberId: string;
  attemptState: string;
  now?: Date;
}): Promise<IntegrityMediaConfirmSuccess | IntegrityMediaLinkFailure> {
  if (!isSessionMemberId(input.memberId)) {
    return failure(401, "authentication_required", "Authentication required.");
  }

  if (!INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN.test(input.attemptState)) {
    return failure(400, "invalid_state", "This confirmation link is incomplete.");
  }

  const now = input.now ?? new Date();
  const resultCode = randomBytes(32).toString("base64url");
  const store = getExternalAuthorLinkStore();

  await store.insertResult({
    resultCode,
    source: INTEGRITY_MEDIA_SOURCE,
    attemptState: input.attemptState,
    memberId: input.memberId,
    expiresAt: new Date(now.getTime() + INTEGRITY_MEDIA_RESULT_TTL_MS).toISOString(),
    consumedAt: null,
    createdAt: now.toISOString(),
  });

  await recordAudit(store, {
    action: "link_confirmation_created",
    memberId: input.memberId,
    externalAuthorId: null,
    attemptState: input.attemptState,
    reason: "confirmed",
    now,
  });

  return {
    ok: true,
    confirmed: true,
    resultCode,
    redirectUrl: buildIntegrityMediaReturnUrl({
      status: "confirmed",
      attemptState: input.attemptState,
      resultCode,
      nodeEnv: process.env.NODE_ENV,
    }),
  };
}

export async function cancelIntegrityMediaLink(input: {
  memberId: string;
  attemptState: string;
  now?: Date;
}): Promise<IntegrityMediaCancelSuccess | IntegrityMediaLinkFailure> {
  if (!isSessionMemberId(input.memberId)) {
    return failure(401, "authentication_required", "Authentication required.");
  }

  if (!INTEGRITY_MEDIA_ATTEMPT_STATE_PATTERN.test(input.attemptState)) {
    return failure(400, "invalid_state", "This confirmation link is incomplete.");
  }

  const now = input.now ?? new Date();

  await recordAudit(getExternalAuthorLinkStore(), {
    action: "link_rejected",
    memberId: input.memberId,
    externalAuthorId: null,
    attemptState: input.attemptState,
    reason: "cancelled",
    now,
  });

  return {
    ok: true,
    cancelled: true,
    redirectUrl: buildIntegrityMediaReturnUrl({
      status: "cancelled",
      attemptState: input.attemptState,
      nodeEnv: process.env.NODE_ENV,
    }),
  };
}

export async function rejectIntegrityMediaLinkRequest(input: {
  memberId: string | null;
  reason:
    "browser_member_id" | "unexpected_field" | "invalid_signature" | "stale_timestamp" | "replayed";
  now?: Date;
}): Promise<void> {
  await recordAudit(getExternalAuthorLinkStore(), {
    action: "link_rejected",
    memberId: input.memberId,
    externalAuthorId: null,
    attemptState: null,
    reason: input.reason,
    now: input.now ?? new Date(),
  });
}

export async function redeemIntegrityMediaLink(input: {
  resultCode: string;
  externalAuthorId: string;
  timestamp: string;
  signature: string;
  secret: string | null;
  now?: Date;
}): Promise<IntegrityMediaRedeemSuccess | IntegrityMediaLinkFailure> {
  if (!INTEGRITY_MEDIA_RESULT_CODE_PATTERN.test(input.resultCode)) {
    return failure(400, "invalid_result", "The confirmation result is not valid.");
  }

  if (!INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.externalAuthorId)) {
    return failure(400, "invalid_author", "The Integrity Media author id is not valid.");
  }

  if (!/^\d{10}$/.test(input.timestamp)) {
    return failure(400, "invalid_timestamp", "The redemption timestamp is not valid.");
  }

  if (!input.secret) {
    return failure(
      503,
      "link_redeem_not_configured",
      "Integrity Media link redemption is not configured.",
    );
  }

  const now = input.now ?? new Date();
  const expected = signIntegrityMediaLinkRedeem(
    input.secret,
    buildIntegrityMediaLinkRedeemPayload({
      timestamp: input.timestamp,
      resultCode: input.resultCode,
      externalAuthorId: input.externalAuthorId,
      purpose: INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE,
    }),
  );

  if (!integrityMediaLinkSignaturesEqual(expected, input.signature)) {
    await rejectIntegrityMediaLinkRequest({ memberId: null, reason: "invalid_signature", now });
    return failure(401, "invalid_signature", "The redemption signature is not valid.");
  }

  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = Math.floor(now.getTime() / 1000);

  if (Math.abs(nowSeconds - timestampSeconds) > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS) {
    await rejectIntegrityMediaLinkRequest({ memberId: null, reason: "stale_timestamp", now });
    return failure(
      401,
      "stale_timestamp",
      "The redemption timestamp is outside the allowed window.",
    );
  }

  if (hasIntegrityMediaRedeemSignature(input.signature, now.getTime())) {
    await rejectIntegrityMediaLinkRequest({ memberId: null, reason: "replayed", now });
    return failure(401, "replayed", "This redemption request was already used.");
  }

  noteIntegrityMediaRedeemSignature(input.signature, now.getTime());

  const store = getExternalAuthorLinkStore();
  const claimed = await store.claimResult(input.resultCode, now.toISOString());

  if (claimed.status === "missing") {
    return failure(404, "result_not_found", "The confirmation result was not found.");
  }

  if (claimed.status === "consumed") {
    return failure(409, "result_already_used", "This confirmation result was already used.");
  }

  if (claimed.status === "expired") {
    await recordAudit(store, {
      action: "link_expired",
      memberId: null,
      externalAuthorId: null,
      attemptState: null,
      reason: "expired",
      now,
    });
    return failure(410, "result_expired", "This confirmation result has expired.");
  }

  const established = await establishLink(store, {
    externalAuthorId: input.externalAuthorId,
    memberId: claimed.record.memberId,
    now,
  });

  if (!established.ok) {
    await recordAudit(store, {
      action: "link_conflict",
      memberId: claimed.record.memberId,
      externalAuthorId: input.externalAuthorId,
      attemptState: claimed.record.attemptState,
      reason: established.conflict,
      now,
    });
    return failure(409, established.conflict, conflictMessage(established.conflict));
  }

  await recordAudit(store, {
    action: "result_redeemed",
    memberId: claimed.record.memberId,
    externalAuthorId: input.externalAuthorId,
    attemptState: claimed.record.attemptState,
    reason: established.reason,
    now,
  });

  return {
    ok: true,
    memberId: claimed.record.memberId,
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: input.externalAuthorId,
    reconnected: established.reconnected,
  };
}

export async function disableIntegrityMediaAuthorLink(
  externalAuthorId: string,
  now = new Date(),
): Promise<"disabled" | "missing" | "invalid"> {
  if (!INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(externalAuthorId)) {
    return "invalid";
  }

  const store = getExternalAuthorLinkStore();
  const existing = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, externalAuthorId);

  if (!existing) {
    return "missing";
  }

  const updated = await store.updateLink({
    ...existing,
    state: "disabled",
    disconnectedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  return updated === "updated" ? "disabled" : "missing";
}

async function establishLink(
  store: ExternalAuthorLinkStore,
  input: { externalAuthorId: string; memberId: string; now: Date },
): Promise<
  | { ok: true; reconnected: boolean; reason: "confirmed" | "already_linked" | "reconnected" }
  | { ok: false; conflict: ExternalAuthorLinkConflict }
> {
  const decision = await classifyLink(store, input);

  if (!decision.ok) {
    return decision;
  }

  if (decision.existing) {
    if (decision.existing.state !== "disabled") {
      return { ok: true, reconnected: false, reason: "already_linked" };
    }

    const updated = await store.updateLink({
      ...decision.existing,
      state: "linked",
      disconnectedAt: null,
      confirmedAt: input.now.toISOString(),
      updatedAt: input.now.toISOString(),
    });

    if (updated !== "updated") {
      return { ok: false, conflict: "external_author_already_linked" };
    }

    return { ok: true, reconnected: true, reason: "reconnected" };
  }

  const record: ExternalAuthorLinkRecord = {
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: input.externalAuthorId,
    memberId: input.memberId,
    state: "linked",
    createdAt: input.now.toISOString(),
    updatedAt: input.now.toISOString(),
    confirmedAt: input.now.toISOString(),
    disconnectedAt: null,
  };
  const inserted = await store.insertLink(record);

  if (inserted === "inserted") {
    return { ok: true, reconnected: false, reason: "confirmed" };
  }

  const raced = await classifyLink(store, input);

  if (!raced.ok) {
    return raced;
  }

  if (raced.existing && raced.existing.memberId === input.memberId) {
    return { ok: true, reconnected: false, reason: "already_linked" };
  }

  return { ok: false, conflict: "external_author_already_linked" };
}

async function classifyLink(
  store: ExternalAuthorLinkStore,
  input: { externalAuthorId: string; memberId: string },
): Promise<
  | { ok: true; existing: ExternalAuthorLinkRecord | null }
  | { ok: false; conflict: ExternalAuthorLinkConflict }
> {
  const byAuthor = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, input.externalAuthorId);
  const byMember = await store.findLinkByMember(INTEGRITY_MEDIA_SOURCE, input.memberId);

  if (byAuthor && byAuthor.memberId !== input.memberId) {
    return { ok: false, conflict: "external_author_already_linked" };
  }

  if (byMember && byMember.externalAuthorId !== input.externalAuthorId) {
    return { ok: false, conflict: "member_already_linked" };
  }

  return { ok: true, existing: byAuthor ?? byMember };
}

async function resolveDisplayName(memberId: string, email: string): Promise<string> {
  if (displayNameResolverOverride) {
    return displayNameResolverOverride(memberId, email);
  }

  try {
    const member = await getMemberById(memberId);
    const name = member?.profile.displayName?.trim();

    if (name) {
      return name;
    }
  } catch {
    // The profile label is optional. The session member id remains the proof.
  }

  const local = email.split("@")[0]?.trim();
  return local && local.length > 0 ? local : "Member";
}

async function recordAudit(
  store: ExternalAuthorLinkStore,
  input: {
    action: ExternalAuthorLinkAuditAction;
    memberId: string | null;
    externalAuthorId: string | null;
    attemptState: string | null;
    reason: string | null;
    now: Date;
  },
): Promise<void> {
  await store.appendAudit({
    eventId: randomUUID(),
    action: input.action,
    source: INTEGRITY_MEDIA_SOURCE,
    memberId: input.memberId,
    externalAuthorId: input.externalAuthorId,
    attemptStateHash: input.attemptState ? hashAttemptState(input.attemptState) : null,
    reason: input.reason,
    createdAt: input.now.toISOString(),
  });
}

function hashAttemptState(attemptState: string): string {
  return createHash("sha256").update(attemptState).digest("hex");
}

function isSessionMemberId(memberId: string): boolean {
  return memberId.trim().length > 0 && !/\s/.test(memberId);
}

function conflictMessage(conflict: ExternalAuthorLinkConflict): string {
  if (conflict === "external_author_already_linked") {
    return "This Integrity Media author is already linked to another Humanity Union account.";
  }

  return "This Humanity Union account is already linked to another Integrity Media author.";
}

function failure(status: number, code: string, message: string): IntegrityMediaLinkFailure {
  return { ok: false, status, code, message };
}
