/**
 * HU-RRP-03C — administrator confirm-appointment (approve + platform designation).
 * Authz: admin only. Platform "Representative" designation is internal only —
 * not legal authority, employment, funding entitlement, or admin permissions.
 * Application fundingModel semantics are unchanged (not a funding commitment).
 */

import type {
  AdminRrpApplicationDetail,
  RrpAppointmentDetail,
  RrpConfirmAppointmentResult,
  RrpApplicationDecisionHistoryEntry,
  RrpApplicationRecord,
} from "@hu/types";

import { recordAdministrationAuditBestEffort } from "../administration/audit.service.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";
import { runMongoTransaction } from "../../infrastructure/mongodb/mongo-transaction.js";
import { assertAdminMayTransition } from "./rrp-application.lifecycle.js";
import {
  RrpApplicationAccessDeniedError,
  RrpApplicationConflictError,
  RrpApplicationNotFoundError,
  RrpApplicationValidationError,
} from "./rrp-application.errors.js";
import {
  buildRrpApplicationAuditSummary,
  toAdminRrpApplicationDetail,
} from "./rrp-application.projection.js";
import {
  findActiveRrpAppointmentBySourceApplicationId,
  findActiveRrpAppointmentForParticipantCountry,
  buildRrpAppointmentRecord,
  insertRrpAppointment,
} from "./rrp-appointment.repository.js";
import {
  buildRrpAppointmentMessageIntent,
  findRrpAppointmentMessageIntentByAppointmentId,
  insertRrpAppointmentMessageIntentIdempotent,
} from "./rrp-appointment-message-intent.repository.js";
import {
  deliverRrpMessageIntentBestEffort,
  retryRrpAppointmentMessageIntentDelivery,
} from "./rrp-message-intent.delivery.js";
import {
  findRrpApplicationById,
  replaceRrpApplicationIfRevision,
} from "./rrp-application.repository.js";
import { parseExpectedRevision } from "./rrp-application.validation.js";

export { retryRrpAppointmentMessageIntentDelivery };

function toAppointmentDetail(record: {
  appointmentId: string;
  participantId: string;
  representCountryCode: string;
  sourceApplicationId: string;
  status: "active" | "revoked";
  appointedAt: string;
  revision: number;
}): RrpAppointmentDetail {
  return {
    appointmentId: record.appointmentId,
    participantId: record.participantId,
    representCountryCode: record.representCountryCode,
    sourceApplicationId: record.sourceApplicationId,
    status: record.status,
    appointedAt: record.appointedAt,
    revision: record.revision,
  };
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

function validateConfirmAppointmentBody(body: unknown): { expectedRevision: number } {
  if (!body || typeof body !== "object") {
    throw new RrpApplicationValidationError("Request body must be an object.");
  }
  const expectedRevision = parseExpectedRevision(body as Record<string, unknown>, true);
  if (expectedRevision === undefined) {
    throw new RrpApplicationValidationError("expectedRevision is required.");
  }
  return { expectedRevision };
}

async function applyConfirmAppointmentInMemory(input: {
  admin: { userId: string; participantId: string };
  current: RrpApplicationRecord;
  expectedRevision: number;
}): Promise<{
  application: AdminRrpApplicationDetail;
  appointment: RrpAppointmentDetail;
  messageIntentRecorded: boolean;
  intent: Awaited<ReturnType<typeof buildRrpAppointmentMessageIntent>>;
}> {
  const existingAppointment = await findActiveRrpAppointmentBySourceApplicationId(
    input.current.applicationId,
  );
  if (input.current.status === "approved" && existingAppointment) {
    const intent =
      (await findRrpAppointmentMessageIntentByAppointmentId(existingAppointment.appointmentId)) ??
      buildRrpAppointmentMessageIntent({
        appointmentId: existingAppointment.appointmentId,
        applicationId: input.current.applicationId,
        applicationRevision: input.current.revision,
        recipientParticipantId: input.current.participantId,
        adminParticipantId: input.admin.participantId,
        representCountryCode: input.current.representCountryCode,
      });
    if (!(await findRrpAppointmentMessageIntentByAppointmentId(existingAppointment.appointmentId))) {
      await insertRrpAppointmentMessageIntentIdempotent(intent);
    }
    return {
      application: toAdminRrpApplicationDetail(input.current),
      appointment: toAppointmentDetail(existingAppointment),
      messageIntentRecorded: true,
      intent,
    };
  }

  if (input.current.revision !== input.expectedRevision) {
    throw new RrpApplicationConflictError(
      "Application was updated by another request. Refresh and try again.",
    );
  }

  assertAdminMayTransition({
    fromStatus: input.current.status,
    decision: "approve",
  });

  const conflicting = await findActiveRrpAppointmentForParticipantCountry({
    participantId: input.current.participantId,
    representCountryCode: input.current.representCountryCode,
  });
  if (conflicting && conflicting.sourceApplicationId !== input.current.applicationId) {
    throw new RrpApplicationConflictError(
      "An active Representative appointment already exists for this participant and country.",
    );
  }

  const now = new Date().toISOString();
  const historyEntry: RrpApplicationDecisionHistoryEntry = {
    fromStatus: input.current.status,
    toStatus: "approved",
    at: now,
    byUserId: input.admin.userId,
    byRole: "admin",
    note: null,
  };

  const nextApplication: RrpApplicationRecord = {
    ...input.current,
    status: "approved",
    updatedAt: now,
    reviewedAt: now,
    reviewerAdminUserId: input.admin.userId,
    revision: input.current.revision + 1,
    decisionHistory: [...input.current.decisionHistory, historyEntry],
  };

  const updated = await replaceRrpApplicationIfRevision({
    expectedRevision: input.expectedRevision,
    next: nextApplication,
  });
  if (!updated) {
    throw new RrpApplicationConflictError(
      "Application was updated by another request. Refresh and try again.",
    );
  }

  const appointment = buildRrpAppointmentRecord({
    participantId: updated.participantId,
    userId: updated.userId,
    representCountryCode: updated.representCountryCode,
    sourceApplicationId: updated.applicationId,
    appointedByAdminUserId: input.admin.userId,
    appointedAt: now,
  });
  await insertRrpAppointment(appointment);

  const intent = buildRrpAppointmentMessageIntent({
    appointmentId: appointment.appointmentId,
    applicationId: updated.applicationId,
    applicationRevision: updated.revision,
    recipientParticipantId: updated.participantId,
    adminParticipantId: input.admin.participantId,
    representCountryCode: updated.representCountryCode,
  });
  await insertRrpAppointmentMessageIntentIdempotent(intent);

  recordAdministrationAuditBestEffort({
    actorParticipantId: input.admin.participantId,
    action: "rrp.application.approve_and_appoint",
    targetType: "rrp_application",
    targetId: updated.applicationId,
    beforeSummary: buildRrpApplicationAuditSummary(input.current),
    afterSummary: `${buildRrpApplicationAuditSummary(updated)};appointmentId=${appointment.appointmentId}`,
  });

  return {
    application: toAdminRrpApplicationDetail(updated),
    appointment: toAppointmentDetail(appointment),
    messageIntentRecorded: true,
    intent,
  };
}

/**
 * Approve application + create active appointment + durable message intent.
 * DM delivery is best-effort after commit.
 */
export async function confirmRrpAppointmentForAdminActor(input: {
  actorUserId: string;
  applicationId: string;
  body: unknown;
}): Promise<RrpConfirmAppointmentResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const { expectedRevision } = validateConfirmAppointmentBody(input.body);

  const current = await findRrpApplicationById(input.applicationId);
  if (!current) {
    throw new RrpApplicationNotFoundError();
  }

  // Force-memory / unit tests: sequential in-memory path (transaction not required).
  const useMemoryPath =
    process.env.NODE_TEST_ENV === "true" || !isMongoConfigured();

  const committed = useMemoryPath
    ? await applyConfirmAppointmentInMemory({ admin, current, expectedRevision })
    : await runMongoTransaction(async (session) => {
        const existingAppointment = await findActiveRrpAppointmentBySourceApplicationId(
          current.applicationId,
        );
        if (current.status === "approved" && existingAppointment) {
          let intent = await findRrpAppointmentMessageIntentByAppointmentId(
            existingAppointment.appointmentId,
          );
          if (!intent) {
            intent = buildRrpAppointmentMessageIntent({
              appointmentId: existingAppointment.appointmentId,
              applicationId: current.applicationId,
              applicationRevision: current.revision,
              recipientParticipantId: current.participantId,
              adminParticipantId: admin.participantId,
              representCountryCode: current.representCountryCode,
            });
            await insertRrpAppointmentMessageIntentIdempotent(intent, { session });
          }
          return {
            application: toAdminRrpApplicationDetail(current),
            appointment: toAppointmentDetail(existingAppointment),
            messageIntentRecorded: true,
            intent,
          };
        }

        if (current.revision !== expectedRevision) {
          throw new RrpApplicationConflictError(
            "Application was updated by another request. Refresh and try again.",
          );
        }

        assertAdminMayTransition({
          fromStatus: current.status,
          decision: "approve",
        });

        const conflicting = await findActiveRrpAppointmentForParticipantCountry({
          participantId: current.participantId,
          representCountryCode: current.representCountryCode,
        });
        if (conflicting && conflicting.sourceApplicationId !== current.applicationId) {
          throw new RrpApplicationConflictError(
            "An active Representative appointment already exists for this participant and country.",
          );
        }

        const now = new Date().toISOString();
        const historyEntry: RrpApplicationDecisionHistoryEntry = {
          fromStatus: current.status,
          toStatus: "approved",
          at: now,
          byUserId: admin.userId,
          byRole: "admin",
          note: null,
        };

        const nextApplication: RrpApplicationRecord = {
          ...current,
          status: "approved",
          updatedAt: now,
          reviewedAt: now,
          reviewerAdminUserId: admin.userId,
          revision: current.revision + 1,
          decisionHistory: [...current.decisionHistory, historyEntry],
        };

        const updated = await replaceRrpApplicationIfRevision({
          expectedRevision,
          next: nextApplication,
          session,
        });
        if (!updated) {
          throw new RrpApplicationConflictError(
            "Application was updated by another request. Refresh and try again.",
          );
        }

        const appointment = buildRrpAppointmentRecord({
          participantId: updated.participantId,
          userId: updated.userId,
          representCountryCode: updated.representCountryCode,
          sourceApplicationId: updated.applicationId,
          appointedByAdminUserId: admin.userId,
          appointedAt: now,
        });
        await insertRrpAppointment(appointment, { session });

        const intent = buildRrpAppointmentMessageIntent({
          appointmentId: appointment.appointmentId,
          applicationId: updated.applicationId,
          applicationRevision: updated.revision,
          recipientParticipantId: updated.participantId,
          adminParticipantId: admin.participantId,
          representCountryCode: updated.representCountryCode,
        });
        await insertRrpAppointmentMessageIntentIdempotent(intent, { session });

        recordAdministrationAuditBestEffort({
          actorParticipantId: admin.participantId,
          action: "rrp.application.approve_and_appoint",
          targetType: "rrp_application",
          targetId: updated.applicationId,
          beforeSummary: buildRrpApplicationAuditSummary(current),
          afterSummary: `${buildRrpApplicationAuditSummary(updated)};appointmentId=${appointment.appointmentId}`,
        });

        return {
          application: toAdminRrpApplicationDetail(updated),
          appointment: toAppointmentDetail(appointment),
          messageIntentRecorded: true,
          intent,
        };
      });

  const messageWarning = await deliverRrpMessageIntentBestEffort(committed.intent);

  return {
    application: committed.application,
    appointment: committed.appointment,
    messageIntentRecorded: committed.messageIntentRecorded,
    ...(messageWarning ? { messageWarning } : {}),
  };
}
