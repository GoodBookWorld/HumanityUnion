import type {
  AdminRrpApplicationDetail,
  AdminRrpApplicationListItem,
  RrpApplicationDetail,
  RrpApplicationDecisionHistoryEntry,
  RrpApplicationRecord,
  RrpFundingModel,
  RrpApplicationStatus,
} from "@hu/types";

import { recordAdministrationAuditBestEffort } from "../administration/audit.service.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  assertAdminMayTransition,
  assertParticipantMaySubmit,
  assertParticipantMayUpdate,
  assertParticipantMayWithdraw,
  isIdempotentAdminDecision,
  isIdempotentSubmit,
  isIdempotentWithdraw,
} from "./rrp-application.lifecycle.js";
import {
  RrpApplicationAccessDeniedError,
  RrpApplicationConflictError,
  RrpApplicationNotFoundError,
  RrpApplicationValidationError,
} from "./rrp-application.errors.js";
import {
  buildRrpApplicationAuditSummary,
  toAdminRrpApplicationDetail,
  toAdminRrpApplicationListItem,
  toRrpApplicationDetail,
} from "./rrp-application.projection.js";
import {
  buildRrpApplicationRecord,
  findActiveRrpApplicationForParticipantCountry,
  findRrpApplicationById,
  findRrpApplicationByIdForUser,
  insertRrpApplication,
  listRrpApplicationsForAdmin,
  listRrpApplicationsForUser,
  replaceRrpApplicationIfRevision,
} from "./rrp-application.repository.js";
import {
  assertSubmissionFieldsComplete,
  clampAdminListLimit,
  clampAdminListOffset,
  validateAdminReviewBody,
  validateCreateDraftBody,
  validateRrpCountryCode,
  validateSubmitBody,
  validateUpdateDraftBody,
} from "./rrp-application.validation.js";

async function assertVerifiedActiveParticipant(userId: string): Promise<{
  userId: string;
  participantId: string;
}> {
  const user = await findAuthUserById(userId);

  if (!user) {
    throw new RrpApplicationAccessDeniedError("Authentication session is invalid.");
  }

  if (user.status !== "active") {
    throw new RrpApplicationAccessDeniedError("Your account access is suspended.");
  }

  if (user.emailVerificationStatus !== "verified") {
    throw new RrpApplicationAccessDeniedError(
      "Confirm your email before applying for the Regional Representative Program.",
    );
  }

  return { userId: user.userId, participantId: user.memberId };
}

async function assertAdminActor(userId: string): Promise<{
  userId: string;
  participantId: string;
}> {
  const user = await findAuthUserById(userId);

  if (!user || user.role !== "admin") {
    throw new RrpApplicationAccessDeniedError("Administrator access is required.");
  }

  if (user.status !== "active") {
    throw new RrpApplicationAccessDeniedError("Administrator account is not active.");
  }

  return { userId: user.userId, participantId: user.memberId };
}

function appendHistory(
  record: RrpApplicationRecord,
  entry: RrpApplicationDecisionHistoryEntry,
): readonly RrpApplicationDecisionHistoryEntry[] {
  return [...record.decisionHistory, entry];
}

function assertRevisionMatch(record: RrpApplicationRecord, expectedRevision: number): void {
  if (record.revision !== expectedRevision) {
    throw new RrpApplicationConflictError(
      "Application was updated by another request. Refresh and try again.",
    );
  }
}

async function commitRevision(input: {
  expectedRevision: number;
  next: RrpApplicationRecord;
}): Promise<RrpApplicationRecord> {
  const updated = await replaceRrpApplicationIfRevision(input);
  if (!updated) {
    throw new RrpApplicationConflictError(
      "Application was updated by another request. Refresh and try again.",
    );
  }
  return updated;
}

export async function createRrpApplicationDraftForUser(
  userId: string,
  body: unknown,
): Promise<RrpApplicationDetail> {
  const actor = await assertVerifiedActiveParticipant(userId);
  const fields = validateCreateDraftBody(body);

  const existing = await findActiveRrpApplicationForParticipantCountry({
    participantId: actor.participantId,
    representCountryCode: fields.representCountryCode,
  });

  if (existing) {
    throw new RrpApplicationConflictError(
      "An active Regional Representative application already exists for this representation country.",
    );
  }

  const created = buildRrpApplicationRecord({
    userId: actor.userId,
    participantId: actor.participantId,
    ...fields,
  });

  await insertRrpApplication(created);
  return toRrpApplicationDetail(created);
}

export async function listOwnRrpApplicationsForUser(
  userId: string,
): Promise<RrpApplicationDetail[]> {
  await assertVerifiedActiveParticipant(userId);
  const records = await listRrpApplicationsForUser(userId);
  return records.map(toRrpApplicationDetail);
}

export async function getOwnRrpApplicationForUser(input: {
  userId: string;
  applicationId: string;
}): Promise<RrpApplicationDetail> {
  await assertVerifiedActiveParticipant(input.userId);
  const record = await findRrpApplicationByIdForUser({
    applicationId: input.applicationId,
    userId: input.userId,
  });

  if (!record) {
    throw new RrpApplicationNotFoundError();
  }

  return toRrpApplicationDetail(record);
}

export async function updateOwnRrpApplicationDraftForUser(input: {
  userId: string;
  applicationId: string;
  body: unknown;
}): Promise<RrpApplicationDetail> {
  const actor = await assertVerifiedActiveParticipant(input.userId);
  const patch = validateUpdateDraftBody(input.body);

  const current = await findRrpApplicationByIdForUser({
    applicationId: input.applicationId,
    userId: actor.userId,
  });

  if (!current) {
    throw new RrpApplicationNotFoundError();
  }

  assertParticipantMayUpdate(current.status);
  assertRevisionMatch(current, patch.expectedRevision);

  const nextCountry = patch.representCountryCode ?? current.representCountryCode;
  if (nextCountry !== current.representCountryCode) {
    const conflict = await findActiveRrpApplicationForParticipantCountry({
      participantId: actor.participantId,
      representCountryCode: nextCountry,
    });
    if (conflict && conflict.applicationId !== current.applicationId) {
      throw new RrpApplicationConflictError(
        "An active Regional Representative application already exists for this representation country.",
      );
    }
  }

  const now = new Date().toISOString();
  const next: RrpApplicationRecord = {
    ...current,
    legalFirstName:
      patch.legalFirstName !== undefined ? patch.legalFirstName : current.legalFirstName,
    legalLastName:
      patch.legalLastName !== undefined ? patch.legalLastName : current.legalLastName,
    profession: patch.profession !== undefined ? patch.profession : current.profession,
    residenceCountryCode:
      patch.residenceCountryCode !== undefined
        ? patch.residenceCountryCode
        : current.residenceCountryCode,
    representCountryCode: nextCountry,
    dateOfBirth: patch.dateOfBirth !== undefined ? patch.dateOfBirth : current.dateOfBirth,
    fundingModel: patch.fundingModel !== undefined ? patch.fundingModel : current.fundingModel,
    annualRequestedAmountCad:
      patch.annualRequestedAmountCad !== undefined
        ? patch.annualRequestedAmountCad
        : current.annualRequestedAmountCad,
    teamMemberCount:
      patch.teamMemberCount !== undefined ? patch.teamMemberCount : current.teamMemberCount,
    relevantExperience:
      patch.relevantExperience !== undefined
        ? patch.relevantExperience
        : current.relevantExperience,
    motivation: patch.motivation !== undefined ? patch.motivation : current.motivation,
    updatedAt: now,
    revision: current.revision + 1,
  };

  const updated = await commitRevision({
    expectedRevision: patch.expectedRevision,
    next,
  });

  return toRrpApplicationDetail(updated);
}

export async function submitOwnRrpApplicationForUser(input: {
  userId: string;
  applicationId: string;
  body: unknown;
}): Promise<RrpApplicationDetail> {
  const actor = await assertVerifiedActiveParticipant(input.userId);
  const submit = validateSubmitBody(input.body);

  const current = await findRrpApplicationByIdForUser({
    applicationId: input.applicationId,
    userId: actor.userId,
  });

  if (!current) {
    throw new RrpApplicationNotFoundError();
  }

  assertRevisionMatch(current, submit.expectedRevision);

  // Idempotent retry of an already-submitted application — no duplicate audit.
  if (isIdempotentSubmit(current.status)) {
    return toRrpApplicationDetail(current);
  }

  assertParticipantMaySubmit(current.status);
  assertSubmissionFieldsComplete(current);

  const now = new Date().toISOString();
  const historyEntry: RrpApplicationDecisionHistoryEntry = {
    fromStatus: current.status,
    toStatus: "submitted",
    at: now,
    byUserId: actor.userId,
    byRole: "participant",
    note: null,
  };

  const next: RrpApplicationRecord = {
    ...current,
    status: "submitted",
    consentAcceptedAt: now,
    consentVersion: submit.consentVersion,
    submittedAt: now,
    updatedAt: now,
    revision: current.revision + 1,
    decisionHistory: appendHistory(current, historyEntry),
  };

  const updated = await commitRevision({
    expectedRevision: submit.expectedRevision,
    next,
  });

  return toRrpApplicationDetail(updated);
}

export async function withdrawOwnRrpApplicationForUser(input: {
  userId: string;
  applicationId: string;
  body: unknown;
}): Promise<RrpApplicationDetail> {
  const actor = await assertVerifiedActiveParticipant(input.userId);
  const record =
    input.body && typeof input.body === "object" && !Array.isArray(input.body)
      ? (input.body as Record<string, unknown>)
      : {};
  const expectedRevision = record.expectedRevision;

  if (
    typeof expectedRevision !== "number" ||
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 1
  ) {
    throw new RrpApplicationValidationError("expectedRevision is required.");
  }

  const current = await findRrpApplicationByIdForUser({
    applicationId: input.applicationId,
    userId: actor.userId,
  });

  if (!current) {
    throw new RrpApplicationNotFoundError();
  }

  assertRevisionMatch(current, expectedRevision);

  if (isIdempotentWithdraw(current.status)) {
    return toRrpApplicationDetail(current);
  }

  assertParticipantMayWithdraw(current.status);

  const now = new Date().toISOString();
  const historyEntry: RrpApplicationDecisionHistoryEntry = {
    fromStatus: current.status,
    toStatus: "withdrawn",
    at: now,
    byUserId: actor.userId,
    byRole: "participant",
    note: null,
  };

  const next: RrpApplicationRecord = {
    ...current,
    status: "withdrawn",
    updatedAt: now,
    revision: current.revision + 1,
    decisionHistory: appendHistory(current, historyEntry),
  };

  const updated = await commitRevision({
    expectedRevision,
    next,
  });

  return toRrpApplicationDetail(updated);
}

function parseOptionalAmountBound(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  const value = typeof raw === "string" ? Number(raw) : Number(raw);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

export async function listRrpApplicationsForAdminActor(input: {
  actorUserId: string;
  query: Record<string, unknown>;
}): Promise<{ items: AdminRrpApplicationListItem[]; total: number; limit: number; offset: number }> {
  await assertAdminActor(input.actorUserId);

  const limit = clampAdminListLimit(input.query.limit);
  const offset = clampAdminListOffset(input.query.offset);

  let representCountryCode: string | undefined;
  if (typeof input.query.representCountryCode === "string" && input.query.representCountryCode.trim()) {
    representCountryCode = validateRrpCountryCode(
      input.query.representCountryCode,
      "Representation country",
    );
  }

  let fundingModel: RrpFundingModel | undefined;
  if (typeof input.query.fundingModel === "string") {
    if (
      input.query.fundingModel === "SELF" ||
      input.query.fundingModel === "PARTIAL" ||
      input.query.fundingModel === "FULL"
    ) {
      fundingModel = input.query.fundingModel;
    }
  }

  let status: RrpApplicationStatus | undefined;
  if (typeof input.query.status === "string") {
    status = input.query.status as RrpApplicationStatus;
  }

  const result = await listRrpApplicationsForAdmin({
    representCountryCode,
    fundingModel,
    status,
    annualRequestedAmountCadMin: parseOptionalAmountBound(input.query.annualRequestedAmountCadMin),
    annualRequestedAmountCadMax: parseOptionalAmountBound(input.query.annualRequestedAmountCadMax),
    // Also accept annualRequestedAmountCad as exact match via min=max when provided alone
    ...(typeof input.query.annualRequestedAmountCad === "string" ||
    typeof input.query.annualRequestedAmountCad === "number"
      ? {
          annualRequestedAmountCadMin: parseOptionalAmountBound(input.query.annualRequestedAmountCad),
          annualRequestedAmountCadMax: parseOptionalAmountBound(input.query.annualRequestedAmountCad),
        }
      : {}),
    limit,
    offset,
  });

  return {
    items: result.items.map(toAdminRrpApplicationListItem),
    total: result.total,
    limit,
    offset,
  };
}

export async function getRrpApplicationDetailForAdminActor(input: {
  actorUserId: string;
  applicationId: string;
}): Promise<AdminRrpApplicationDetail> {
  await assertAdminActor(input.actorUserId);
  const record = await findRrpApplicationById(input.applicationId);

  if (!record) {
    throw new RrpApplicationNotFoundError();
  }

  return toAdminRrpApplicationDetail(record);
}

export async function reviewRrpApplicationForAdminActor(input: {
  actorUserId: string;
  applicationId: string;
  body: unknown;
}): Promise<AdminRrpApplicationDetail> {
  const admin = await assertAdminActor(input.actorUserId);
  const review = validateAdminReviewBody(input.body);

  const current = await findRrpApplicationById(input.applicationId);
  if (!current) {
    throw new RrpApplicationNotFoundError();
  }

  assertRevisionMatch(current, review.expectedRevision);

  if (isIdempotentAdminDecision({ status: current.status, decision: review.decision })) {
    return toAdminRrpApplicationDetail(current);
  }

  const toStatus = assertAdminMayTransition({
    fromStatus: current.status,
    decision: review.decision,
  });

  const now = new Date().toISOString();
  const historyEntry: RrpApplicationDecisionHistoryEntry = {
    fromStatus: current.status,
    toStatus,
    at: now,
    byUserId: admin.userId,
    byRole: "admin",
    note: review.note,
  };

  const next: RrpApplicationRecord = {
    ...current,
    status: toStatus,
    updatedAt: now,
    reviewedAt: now,
    reviewerAdminUserId: admin.userId,
    revision: current.revision + 1,
    decisionHistory: appendHistory(current, historyEntry),
  };

  const updated = await commitRevision({
    expectedRevision: review.expectedRevision,
    next,
  });

  // Status review only — Representative appointment requires confirm-appointment.
  recordAdministrationAuditBestEffort({
    actorParticipantId: admin.participantId,
    action: "rrp.application.review",
    targetType: "rrp_application",
    targetId: updated.applicationId,
    reason: review.note ?? undefined,
    beforeSummary: buildRrpApplicationAuditSummary(current),
    afterSummary: buildRrpApplicationAuditSummary(updated),
  });

  return toAdminRrpApplicationDetail(updated);
}
