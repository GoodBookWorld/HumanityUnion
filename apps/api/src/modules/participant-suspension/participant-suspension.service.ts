import { randomUUID } from "node:crypto";

import type {
  AdminParticipantRestoreResult,
  AdminParticipantSuspendResult,
  AdminParticipantSuspensionSummary,
  AdministrationAuditAppendInput,
  AdministrationAuditRecord,
  ParticipantSuspensionReasonCode,
  ParticipantSuspensionReviewPublic,
  ParticipantSuspensionReviewSubmitResult,
} from "@hu/types";
import { PARTICIPANT_SUSPENSION_REASON_CODES } from "@hu/types";

import { AuditService } from "../administration/audit.service.js";
import { projectAdminNotificationForAdmins } from "../admin-notifications/admin-notification.service.js";
import type { AuthUserRecord } from "../auth/auth-user.types.js";
import {
  findAuthUserById,
  findAuthUserByMemberId,
  updateAuthUserAccountStatus,
} from "../auth/auth-user.repository.js";
import { revokeAllAuthSessionsForUser } from "../auth/auth-session.repository.js";
import { sendParticipantRestoredEmail, sendParticipantSuspendedEmail } from "../email/email.service.js";
import type { EmailDeliveryResult } from "../email/email.service.js";
import { updateMemberProfileRecord } from "../member-profile/member-profile.repository.js";
import {
  ParticipantSuspensionAdminRequiredError,
  ParticipantSuspensionConflictError,
  ParticipantSuspensionNotFoundError,
  ParticipantSuspensionRateLimitError,
  ParticipantSuspensionReviewInvalidError,
  ParticipantSuspensionUnauthorizedError,
  ParticipantSuspensionValidationError,
} from "./participant-suspension.errors.js";
import {
  assertParticipantSuspensionReviewSubmitAllowed,
  isParticipantSuspensionRateLimitError,
} from "./participant-suspension.rate-limit.js";
import {
  findActiveSuspensionByParticipantId,
  findActiveSuspensionsByParticipantIds,
  findSuspensionByReviewTokenHash,
  generateSuspensionReviewToken,
  hashSuspensionReviewToken,
  insertParticipantSuspension,
  markSuspensionRestored,
  replaceParticipantSuspension,
  resolveSuspensionReviewTokenExpiresAt,
  setPendingReviewRequest,
} from "./participant-suspension.repository.js";
import type { ParticipantSuspensionRecord } from "./participant-suspension.types.js";

const EXPLANATION_MAX_LENGTH = 2000;
const EXPLANATION_MIN_LENGTH = 10;

const REASON_LABELS: Record<ParticipantSuspensionReasonCode, string> = {
  community_standards_violation: "Community standards violation",
  spam_or_abusive_activity: "Spam or abusive activity",
  security_or_account_integrity: "Security or account integrity concern",
};

type SuspensionAdminActor = {
  userId: string;
  memberId: string;
};

type AdminAssertFn = (userId: string) => Promise<SuspensionAdminActor>;
type AuditRecorderFn = (
  input: AdministrationAuditAppendInput,
) => Promise<AdministrationAuditRecord>;
type FindAuthByMemberIdFn = (participantId: string) => Promise<AuthUserRecord | null>;
type FindAuthByIdFn = (userId: string) => Promise<AuthUserRecord | null>;
type UpdateAuthStatusFn = (
  userId: string,
  status: "active" | "disabled",
) => Promise<AuthUserRecord | null>;
type RevokeSessionsFn = (userId: string) => Promise<number>;
type UpdateProfileStatusFn = (
  userId: string,
  status: "active" | "suspended",
) => Promise<unknown>;
type SendSuspendedEmailFn = (input: {
  to: string;
  displayName: string;
  reasonLabel: string;
  reviewToken: string;
}) => Promise<EmailDeliveryResult>;
type SendRestoredEmailFn = (input: {
  to: string;
  displayName: string;
}) => Promise<EmailDeliveryResult>;
type ProjectNotificationFn = typeof projectAdminNotificationForAdmins;

let adminAssertOverrideForTests: AdminAssertFn | null = null;
let auditRecorderOverrideForTests: AuditRecorderFn | null = null;
let findAuthByMemberIdOverrideForTests: FindAuthByMemberIdFn | null = null;
let findAuthByIdOverrideForTests: FindAuthByIdFn | null = null;
let updateAuthStatusOverrideForTests: UpdateAuthStatusFn | null = null;
let revokeSessionsOverrideForTests: RevokeSessionsFn | null = null;
let updateProfileStatusOverrideForTests: UpdateProfileStatusFn | null = null;
let sendSuspendedEmailOverrideForTests: SendSuspendedEmailFn | null = null;
let sendRestoredEmailOverrideForTests: SendRestoredEmailFn | null = null;
let projectNotificationOverrideForTests: ProjectNotificationFn | null = null;

export function setParticipantSuspensionAdminAssertOverrideForTests(
  override: AdminAssertFn | null,
): void {
  adminAssertOverrideForTests = override;
}

export function setParticipantSuspensionAuditRecorderOverrideForTests(
  override: AuditRecorderFn | null,
): void {
  auditRecorderOverrideForTests = override;
}

export function setParticipantSuspensionAuthOverridesForTests(overrides: {
  findByMemberId?: FindAuthByMemberIdFn | null;
  findById?: FindAuthByIdFn | null;
  updateStatus?: UpdateAuthStatusFn | null;
  revokeSessions?: RevokeSessionsFn | null;
  updateProfileStatus?: UpdateProfileStatusFn | null;
} | null): void {
  findAuthByMemberIdOverrideForTests = overrides?.findByMemberId ?? null;
  findAuthByIdOverrideForTests = overrides?.findById ?? null;
  updateAuthStatusOverrideForTests = overrides?.updateStatus ?? null;
  revokeSessionsOverrideForTests = overrides?.revokeSessions ?? null;
  updateProfileStatusOverrideForTests = overrides?.updateProfileStatus ?? null;
}

export function setParticipantSuspensionEmailOverridesForTests(overrides: {
  sendSuspended?: SendSuspendedEmailFn | null;
  sendRestored?: SendRestoredEmailFn | null;
} | null): void {
  sendSuspendedEmailOverrideForTests = overrides?.sendSuspended ?? null;
  sendRestoredEmailOverrideForTests = overrides?.sendRestored ?? null;
}

export function setParticipantSuspensionNotificationOverrideForTests(
  override: ProjectNotificationFn | null,
): void {
  projectNotificationOverrideForTests = override;
}

export function resolveParticipantSuspensionReasonLabel(
  reasonCode: ParticipantSuspensionReasonCode,
): string {
  return REASON_LABELS[reasonCode];
}

export function isParticipantSuspensionReasonCode(
  value: unknown,
): value is ParticipantSuspensionReasonCode {
  return (
    typeof value === "string" &&
    (PARTICIPANT_SUSPENSION_REASON_CODES as readonly string[]).includes(value)
  );
}

function toSuspensionSummary(
  record: ParticipantSuspensionRecord,
): AdminParticipantSuspensionSummary {
  const pending = record.reviewRequest?.status === "pending" ? record.reviewRequest : undefined;
  return {
    suspensionId: record.suspensionId,
    reasonCode: record.reasonCode,
    suspendedAt: record.suspendedAt,
    hasPendingReview: Boolean(pending),
    ...(pending
      ? {
          reviewRequestId: pending.requestId,
          reviewExplanation: pending.explanation,
          reviewSubmittedAt: pending.createdAt,
        }
      : {}),
  };
}

async function recordSuspensionAudit(input: AdministrationAuditAppendInput): Promise<void> {
  if (auditRecorderOverrideForTests) {
    await auditRecorderOverrideForTests(input);
    return;
  }
  await AuditService.record(input);
}

async function assertAdminActor(userId: string): Promise<SuspensionAdminActor> {
  if (adminAssertOverrideForTests) {
    return adminAssertOverrideForTests(userId);
  }

  if (!userId.trim()) {
    throw new ParticipantSuspensionUnauthorizedError();
  }

  const user = findAuthByIdOverrideForTests
    ? await findAuthByIdOverrideForTests(userId)
    : await findAuthUserById(userId);

  if (!user || user.role !== "admin" || user.status !== "active") {
    throw new ParticipantSuspensionAdminRequiredError();
  }

  return { userId: user.userId, memberId: user.memberId };
}

async function resolveTargetAuthUser(participantId: string): Promise<AuthUserRecord> {
  const user = findAuthByMemberIdOverrideForTests
    ? await findAuthByMemberIdOverrideForTests(participantId)
    : await findAuthUserByMemberId(participantId);

  if (!user) {
    throw new ParticipantSuspensionNotFoundError();
  }

  return user;
}

async function setAuthStatus(userId: string, status: "active" | "disabled"): Promise<void> {
  const updated = updateAuthStatusOverrideForTests
    ? await updateAuthStatusOverrideForTests(userId, status)
    : await updateAuthUserAccountStatus(userId, status);

  if (!updated) {
    throw new ParticipantSuspensionNotFoundError("Unable to update account status.");
  }
}

async function revokeSessions(userId: string): Promise<void> {
  if (revokeSessionsOverrideForTests) {
    await revokeSessionsOverrideForTests(userId);
    return;
  }
  await revokeAllAuthSessionsForUser(userId);
}

async function setProfileStatus(userId: string, status: "active" | "suspended"): Promise<void> {
  if (updateProfileStatusOverrideForTests) {
    await updateProfileStatusOverrideForTests(userId, status);
    return;
  }
  // Public-projection side effect only — Auth SoT remains auth_users.status.
  await updateMemberProfileRecord(userId, { status });
}

function isReviewTokenUsable(record: ParticipantSuspensionRecord, nowIso: string): boolean {
  if (record.status !== "active") {
    return false;
  }
  if (!record.reviewTokenHash || !record.reviewTokenExpiresAt) {
    return false;
  }
  if (record.reviewTokenConsumedAt) {
    return false;
  }
  return record.reviewTokenExpiresAt > nowIso;
}

async function resolveValidSuspensionForToken(
  rawToken: string,
): Promise<ParticipantSuspensionRecord> {
  const token = rawToken.trim();
  if (!token) {
    throw new ParticipantSuspensionReviewInvalidError();
  }

  const hash = hashSuspensionReviewToken(token);
  const record = await findSuspensionByReviewTokenHash(hash);
  const now = new Date().toISOString();

  if (!record || !isReviewTokenUsable(record, now)) {
    throw new ParticipantSuspensionReviewInvalidError();
  }

  return record;
}

/**
 * Pack 24B — Admin suspend Participant (auth disabled + session revoke + suspension record).
 */
export async function suspendParticipantForAdmin(input: {
  actorUserId: string;
  participantId: string;
  reasonCode: unknown;
}): Promise<AdminParticipantSuspendResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const participantId = input.participantId.trim();

  if (!participantId) {
    throw new ParticipantSuspensionValidationError("Participant id is required.");
  }

  if (!isParticipantSuspensionReasonCode(input.reasonCode)) {
    throw new ParticipantSuspensionValidationError(
      "A valid suspension reason is required.",
    );
  }

  const target = await resolveTargetAuthUser(participantId);

  if (target.userId === admin.userId || target.memberId === admin.memberId) {
    throw new ParticipantSuspensionValidationError("You cannot suspend your own account.");
  }

  if (target.role === "admin") {
    throw new ParticipantSuspensionValidationError("Administrator accounts cannot be suspended.");
  }

  if (target.status === "disabled") {
    throw new ParticipantSuspensionConflictError("This Participant is already suspended.");
  }

  const existingActive = await findActiveSuspensionByParticipantId(participantId);
  if (existingActive) {
    throw new ParticipantSuspensionConflictError("This Participant is already suspended.");
  }

  await setAuthStatus(target.userId, "disabled");
  await revokeSessions(target.userId);
  await setProfileStatus(target.userId, "suspended");

  const rawReviewToken = generateSuspensionReviewToken();
  const issued = await insertParticipantSuspension({
    participantId,
    userId: target.userId,
    reasonCode: input.reasonCode,
    suspendedByParticipantId: admin.memberId,
    reviewTokenHash: hashSuspensionReviewToken(rawReviewToken),
    reviewTokenExpiresAt: resolveSuspensionReviewTokenExpiresAt(),
    rawReviewToken,
  });

  await recordSuspensionAudit({
    actorParticipantId: admin.memberId,
    action: "participant.suspend",
    targetType: "participant",
    targetId: participantId,
    afterSummary: `reasonCode=${input.reasonCode};status=disabled`,
  });

  let emailQueued = false;
  let emailWarning: string | undefined;

  try {
    const reasonLabel = resolveParticipantSuspensionReasonLabel(input.reasonCode);
    const send = sendSuspendedEmailOverrideForTests ?? sendParticipantSuspendedEmail;
    const delivery = await send({
      to: target.email,
      displayName: target.displayName,
      reasonLabel,
      reviewToken: rawReviewToken,
    });

    emailQueued = delivery.emailSent || delivery.status === "sent";
    if (!emailQueued) {
      emailWarning = delivery.emailDeliveryError ?? "Suspension email was not delivered.";
    }
  } catch (error) {
    emailQueued = false;
    emailWarning =
      error instanceof Error ? error.message : "Suspension email could not be sent.";
  }

  return {
    participantId,
    suspensionId: issued.suspension.suspensionId,
    status: "disabled",
    emailQueued,
    ...(emailWarning ? { emailWarning } : {}),
  };
}

/**
 * Pack 24B — Admin restore Participant (auth active + clear suspension).
 */
export async function restoreParticipantForAdmin(input: {
  actorUserId: string;
  participantId: string;
}): Promise<AdminParticipantRestoreResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const participantId = input.participantId.trim();

  if (!participantId) {
    throw new ParticipantSuspensionValidationError("Participant id is required.");
  }

  const target = await resolveTargetAuthUser(participantId);
  const active = await findActiveSuspensionByParticipantId(participantId);

  if (!active && target.status !== "disabled") {
    throw new ParticipantSuspensionConflictError("This Participant is not suspended.");
  }

  await setAuthStatus(target.userId, "active");
  await setProfileStatus(target.userId, "active");

  let suspensionId = active?.suspensionId ?? "";
  if (active) {
    const restored = await markSuspensionRestored({
      suspensionId: active.suspensionId,
      restoredByParticipantId: admin.memberId,
    });
    suspensionId = restored?.suspensionId ?? active.suspensionId;
  }

  await recordSuspensionAudit({
    actorParticipantId: admin.memberId,
    action: "participant.restore",
    targetType: "participant",
    targetId: participantId,
    afterSummary: `suspensionId=${suspensionId || "none"};status=active`,
  });

  let emailQueued = false;
  let emailWarning: string | undefined;

  try {
    const send = sendRestoredEmailOverrideForTests ?? sendParticipantRestoredEmail;
    const delivery = await send({
      to: target.email,
      displayName: target.displayName,
    });
    emailQueued = delivery.emailSent || delivery.status === "sent";
    if (!emailQueued) {
      emailWarning = delivery.emailDeliveryError ?? "Restore email was not delivered.";
    }
  } catch (error) {
    emailQueued = false;
    emailWarning =
      error instanceof Error ? error.message : "Restore email could not be sent.";
  }

  return {
    participantId,
    suspensionId: suspensionId || "none",
    status: "active",
    emailQueued,
    ...(emailWarning ? { emailWarning } : {}),
  };
}

export async function getSuspensionReviewPublic(input: {
  token: string;
}): Promise<ParticipantSuspensionReviewPublic> {
  const record = await resolveValidSuspensionForToken(input.token);
  const target = await resolveTargetAuthUser(record.participantId);

  return {
    displayName: target.displayName,
    reasonLabel: resolveParticipantSuspensionReasonLabel(record.reasonCode),
    suspendedAt: record.suspendedAt,
    alreadySubmitted: record.reviewRequest?.status === "pending",
  };
}

export async function submitSuspensionReview(input: {
  token: string;
  explanation: string;
  clientKey: string;
}): Promise<ParticipantSuspensionReviewSubmitResult> {
  try {
    assertParticipantSuspensionReviewSubmitAllowed({ clientKey: input.clientKey });
  } catch (error) {
    if (isParticipantSuspensionRateLimitError(error)) {
      throw new ParticipantSuspensionRateLimitError();
    }
    throw error;
  }

  const explanation = input.explanation.trim();
  if (explanation.length < EXPLANATION_MIN_LENGTH) {
    throw new ParticipantSuspensionValidationError(
      `Please provide an explanation of at least ${EXPLANATION_MIN_LENGTH} characters.`,
    );
  }
  if (explanation.length > EXPLANATION_MAX_LENGTH) {
    throw new ParticipantSuspensionValidationError(
      `Explanation must be at most ${EXPLANATION_MAX_LENGTH} characters.`,
    );
  }

  const record = await resolveValidSuspensionForToken(input.token);

  if (record.reviewRequest?.status === "pending") {
    return {
      requestId: record.reviewRequest.requestId,
      status: "pending",
    };
  }

  const requestId = randomUUID();
  const createdAt = new Date().toISOString();
  const updated = await setPendingReviewRequest(record.suspensionId, {
    requestId,
    explanation,
    createdAt,
    status: "pending",
  });

  if (!updated?.reviewRequest) {
    throw new ParticipantSuspensionReviewInvalidError();
  }

  // Duplicate race: another request may have won — return existing pending safely.
  const pending = updated.reviewRequest;
  if (pending.status === "pending" && pending.requestId !== requestId) {
    return { requestId: pending.requestId, status: "pending" };
  }

  await recordSuspensionAudit({
    actorParticipantId: record.participantId,
    action: "participant.suspension_review.submit",
    targetType: "participant",
    targetId: record.participantId,
    afterSummary: `requestId=${pending.requestId};status=pending`,
  });

  const project = projectNotificationOverrideForTests ?? projectAdminNotificationForAdmins;
  await project({
    type: "participant_suspension_review_requested",
    title: "Participant requested suspension review",
    targetHref: `/admin/participants?participantId=${encodeURIComponent(record.participantId)}`,
    targetLabel: record.participantId,
    sourceEventId: `suspension-review:${pending.requestId}`,
    dedupeKey: `suspension-review:${pending.requestId}`,
  });

  return {
    requestId: pending.requestId,
    status: "pending",
  };
}

export async function getActiveSuspensionForParticipant(input: {
  actorUserId: string;
  participantId: string;
}): Promise<AdminParticipantSuspensionSummary | null> {
  await assertAdminActor(input.actorUserId);
  const participantId = input.participantId.trim();
  if (!participantId) {
    throw new ParticipantSuspensionValidationError("Participant id is required.");
  }

  // Ensure participant exists (admin UI consistency).
  await resolveTargetAuthUser(participantId);

  const active = await findActiveSuspensionByParticipantId(participantId);
  return active ? toSuspensionSummary(active) : null;
}

export { findActiveSuspensionsByParticipantIds, toSuspensionSummary };

// Re-export map helper for directory enrichment with summary projection.
export async function findActiveSuspensionSummariesByParticipantIds(
  participantIds: readonly string[],
): Promise<Map<string, AdminParticipantSuspensionSummary>> {
  const records = await findActiveSuspensionsByParticipantIds(participantIds);
  const map = new Map<string, AdminParticipantSuspensionSummary>();
  for (const [participantId, record] of records) {
    map.set(participantId, toSuspensionSummary(record));
  }
  return map;
}

/** Test helper — create an active suspension with known raw token (memory-friendly). */
export async function createActiveSuspensionForTests(input: {
  participantId: string;
  userId: string;
  reasonCode: ParticipantSuspensionReasonCode;
  suspendedByParticipantId: string;
  rawReviewToken?: string;
}): Promise<{ suspension: ParticipantSuspensionRecord; rawReviewToken: string }> {
  const rawReviewToken = input.rawReviewToken ?? generateSuspensionReviewToken();
  const issued = await insertParticipantSuspension({
    participantId: input.participantId,
    userId: input.userId,
    reasonCode: input.reasonCode,
    suspendedByParticipantId: input.suspendedByParticipantId,
    reviewTokenHash: hashSuspensionReviewToken(rawReviewToken),
    reviewTokenExpiresAt: resolveSuspensionReviewTokenExpiresAt(),
    rawReviewToken,
  });
  return issued;
}

export async function consumeReviewTokenForTests(
  suspension: ParticipantSuspensionRecord,
): Promise<ParticipantSuspensionRecord> {
  return replaceParticipantSuspension({
    ...suspension,
    reviewTokenConsumedAt: new Date().toISOString(),
  });
}
