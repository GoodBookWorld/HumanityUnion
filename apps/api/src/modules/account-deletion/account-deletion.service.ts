import type { AdministrationAuditAction } from "@hu/types";

import { isAccountDeletionEnabled } from "../../config/platform.config.js";
import { recordAdministrationAuditBestEffort } from "../administration/audit.service.js";
import { AuthValidationError } from "../auth/auth.errors.js";
import { verifyPassword, hashPassword } from "../auth/auth-password.js";
import { revokeAllAuthSessionsForUser } from "../auth/auth-session.repository.js";
import { findAuthUserByEmail, findAuthUserById } from "../auth/auth-user.repository.js";
import type { AuthUserRecord } from "../auth/auth-user.types.js";
import {
  consumeEmailConfirmationCode,
  createEmailConfirmationCode,
  deleteEmailConfirmationCodesByUserIds,
  discardEmailConfirmationCode,
} from "../email/email-confirmation-code.repository.js";
import { resolveLoginEmailTwoStepConfig } from "../email/login-email-two-step.config.js";
import {
  sendAccountDeletionCancelledEmail,
  sendAccountDeletionCodeEmail,
  sendAccountDeletionFinalizedEmail,
  sendAccountDeletionReminderEmail,
  sendAccountDeletionScheduledEmail,
} from "../email/email.service.js";
import { deleteEmailVerificationTokensByUserIds } from "../email/email.tokens.js";
import { findEditorGrantByParticipantId } from "../editor-grants/editor-grant.repository.js";
import { listActiveRrpAppointmentsForParticipantIds } from "../rrp-application/rrp-appointment.repository.js";
import { closeMemberProfileForAccountDeletion } from "./account-deletion.profile.js";
import {
  claimAccountDeletionFinalNotice,
  claimAccountDeletionReminder,
  createAccountDeletionRequestId,
  finalizeAccountDeletionRecord,
  listAccountDeletionFinalizationCandidates,
  listAccountDeletionReminderCandidates,
  markAccountDeletionAwaiting,
  markAccountDeletionCancelled,
  markAccountDeletionPending,
  markAccountDeletionProfileClosed,
  recordScheduledDeletionNotice,
  releaseStaleAccountDeletionReminder,
  setAccountDeletionFinalNoticeStatus,
  setAccountDeletionReminderStatus,
  skipStaleAccountDeletionFinalNotice,
} from "./account-deletion.repository.js";
import {
  ACCOUNT_DELETION_CANCEL_FAILURE_MESSAGE,
  ACCOUNT_DELETION_CANCEL_REQUEST_MESSAGE,
  ACCOUNT_DELETION_CANCEL_SUCCESS_MESSAGE,
  ACCOUNT_DELETION_NOTICE_RECLAIM_MS,
  ACCOUNT_DELETION_REMINDER_LEAD_MS,
  deletionDeadlineFromConfirmation,
  hashDeletionEmail,
  isDeletionRecoveryOpen,
  reservedDeletionEmail,
} from "./account-deletion.state.js";

export type AccountDeletionRejectionCode =
  | "admin"
  | "disabled"
  | "rrp_appointment"
  | "editor_grant"
  | "conflict"
  | "invalid_code"
  | "invalid_password"
  | "mail_failed"
  | "not_found"
  | "unavailable";

export class AccountDeletionRejectedError extends Error {
  readonly code: AccountDeletionRejectionCode;

  constructor(code: AccountDeletionRejectionCode, message: string) {
    super(message);
    this.name = "AccountDeletionRejectedError";
    this.code = code;
  }
}

export interface AccountDeletionStatus {
  phase: "none" | "awaiting_confirmation" | "pending" | "cancelled" | "finalized";
  requestId?: string;
  deadlineAt?: string;
  confirmationExpiresAt?: string;
}

export interface AccountDeletionDeps {
  now: () => string;
  findById: (userId: string) => Promise<AuthUserRecord | null>;
  findByEmail: (email: string) => Promise<AuthUserRecord | null>;
  verifyPassword: (password: string, passwordHash: string) => Promise<boolean>;
  hasActiveRrpAppointment: (participantId: string) => Promise<boolean>;
  hasActiveEditorGrant: (participantId: string) => Promise<boolean>;
  issueCode: (input: {
    userId: string;
    email: string;
    purpose: "account_deletion_confirm" | "account_deletion_cancel";
  }) => Promise<{ code: string; confirmationId: string; expiresMinutes: number }>;
  consumeCode: (input: {
    userId: string;
    code: string;
    purpose: "account_deletion_confirm" | "account_deletion_cancel";
  }) => Promise<boolean>;
  discardCode: (confirmationId: string) => Promise<void>;
  sendCode: (input: {
    to: string;
    displayName: string;
    verificationCode: string;
    expiresMinutes: number;
    action: "confirm" | "cancel";
  }) => Promise<{ emailSent: boolean; emailId: string }>;
  sendScheduled: (input: {
    to: string;
    displayName: string;
    deadlineAt: string;
  }) => Promise<{ emailSent: boolean; emailId: string }>;
  sendCancelled: (input: { to: string; displayName: string }) => Promise<{ emailSent: boolean }>;
  sendFinalized: (input: { to: string; displayName: string }) => Promise<{ emailSent: boolean }>;
  sendReminder: (input: {
    to: string;
    displayName: string;
    deadlineAt: string;
  }) => Promise<{ emailSent: boolean; emailId: string }>;
  listReminderCandidates: typeof listAccountDeletionReminderCandidates;
  claimReminder: typeof claimAccountDeletionReminder;
  setReminderStatus: typeof setAccountDeletionReminderStatus;
  releaseStaleReminder: typeof releaseStaleAccountDeletionReminder;
  markAwaiting: typeof markAccountDeletionAwaiting;
  markPending: typeof markAccountDeletionPending;
  markCancelled: typeof markAccountDeletionCancelled;
  recordScheduledNotice: typeof recordScheduledDeletionNotice;
  listCandidates: typeof listAccountDeletionFinalizationCandidates;
  claimFinalNotice: typeof claimAccountDeletionFinalNotice;
  setFinalNoticeStatus: typeof setAccountDeletionFinalNoticeStatus;
  skipStaleFinalNotice: typeof skipStaleAccountDeletionFinalNotice;
  finalizeRecord: typeof finalizeAccountDeletionRecord;
  markProfileClosed: typeof markAccountDeletionProfileClosed;
  closeProfile: (userId: string, nowIso: string) => Promise<void>;
  revokeSessions: (userId: string) => Promise<void>;
  invalidateAuthMaterial: (userId: string) => Promise<void>;
  hashReplacementPassword: () => Promise<string>;
  audit: (input: {
    actorParticipantId: string;
    action: AdministrationAuditAction;
    targetId: string;
    afterSummary: string;
  }) => void;
  createRequestId: () => string;
  noticeReclaimMs: number;
}

function expiresMinutesFromConfig(): number {
  return resolveLoginEmailTwoStepConfig().codeTtlMinutes;
}

function assertDeletionFeatureEnabled(): void {
  if (!isAccountDeletionEnabled()) {
    throw new AccountDeletionRejectedError("unavailable", "Account deletion is not available.");
  }
}

function productionDeps(): AccountDeletionDeps {
  return {
    now: () => new Date().toISOString(),
    findById: findAuthUserById,
    findByEmail: findAuthUserByEmail,
    verifyPassword,
    hasActiveRrpAppointment: async (participantId) => {
      const rows = await listActiveRrpAppointmentsForParticipantIds([participantId]);
      return rows.length > 0;
    },
    hasActiveEditorGrant: async (participantId) => {
      const grant = await findEditorGrantByParticipantId(participantId);
      return grant?.status === "ACTIVE";
    },
    issueCode: async (input) => {
      const issued = await createEmailConfirmationCode({
        userId: input.userId,
        email: input.email,
        purpose: input.purpose,
      });
      return {
        code: issued.code,
        confirmationId: issued.record.confirmationId,
        expiresMinutes: expiresMinutesFromConfig(),
      };
    },
    consumeCode: async (input) => {
      const consumed = await consumeEmailConfirmationCode(input);
      return consumed !== null;
    },
    discardCode: discardEmailConfirmationCode,
    sendCode: async (input) => {
      const result = await sendAccountDeletionCodeEmail(input);
      return { emailSent: result.emailSent, emailId: result.emailId };
    },
    sendScheduled: async (input) => {
      const result = await sendAccountDeletionScheduledEmail(input);
      return { emailSent: result.emailSent, emailId: result.emailId };
    },
    sendCancelled: async (input) => {
      const result = await sendAccountDeletionCancelledEmail(input);
      return { emailSent: result.emailSent };
    },
    sendFinalized: async (input) => {
      const result = await sendAccountDeletionFinalizedEmail(input);
      return { emailSent: result.emailSent };
    },
    sendReminder: async (input) => {
      const result = await sendAccountDeletionReminderEmail(input);
      return { emailSent: result.emailSent, emailId: result.emailId };
    },
    listReminderCandidates: listAccountDeletionReminderCandidates,
    claimReminder: claimAccountDeletionReminder,
    setReminderStatus: setAccountDeletionReminderStatus,
    releaseStaleReminder: releaseStaleAccountDeletionReminder,
    markAwaiting: markAccountDeletionAwaiting,
    markPending: markAccountDeletionPending,
    markCancelled: markAccountDeletionCancelled,
    recordScheduledNotice: recordScheduledDeletionNotice,
    listCandidates: listAccountDeletionFinalizationCandidates,
    claimFinalNotice: claimAccountDeletionFinalNotice,
    setFinalNoticeStatus: setAccountDeletionFinalNoticeStatus,
    skipStaleFinalNotice: skipStaleAccountDeletionFinalNotice,
    finalizeRecord: finalizeAccountDeletionRecord,
    markProfileClosed: markAccountDeletionProfileClosed,
    closeProfile: closeMemberProfileForAccountDeletion,
    revokeSessions: async (userId) => {
      await revokeAllAuthSessionsForUser(userId);
    },
    invalidateAuthMaterial: async (userId) => {
      await revokeAllAuthSessionsForUser(userId);
      await deleteEmailConfirmationCodesByUserIds([userId]);
      await deleteEmailVerificationTokensByUserIds([userId]);
    },
    hashReplacementPassword: () => hashPassword(createAccountDeletionRequestId()),
    audit: (input) => {
      recordAdministrationAuditBestEffort({
        actorParticipantId: input.actorParticipantId,
        action: input.action,
        targetType: "auth_user",
        targetId: input.targetId,
        afterSummary: input.afterSummary,
      });
    },
    createRequestId: createAccountDeletionRequestId,
    noticeReclaimMs: ACCOUNT_DELETION_NOTICE_RECLAIM_MS,
  };
}

function statusOf(user: AuthUserRecord | null): AccountDeletionStatus {
  const deletion = user?.accountDeletion;
  if (!deletion) {
    return { phase: "none" };
  }
  return {
    phase: deletion.phase,
    requestId: deletion.requestId,
    deadlineAt: deletion.deadlineAt,
    confirmationExpiresAt: deletion.confirmationExpiresAt,
  };
}

async function assertDeletionAllowed(
  deps: AccountDeletionDeps,
  user: AuthUserRecord,
): Promise<void> {
  if (user.role === "admin") {
    throw new AccountDeletionRejectedError(
      "admin",
      "Administrator accounts cannot be deleted from this screen.",
    );
  }
  if (user.status !== "active") {
    throw new AccountDeletionRejectedError(
      "disabled",
      "A suspended account cannot be deleted from this screen.",
    );
  }
  if (user.accountDeletion?.phase === "pending" || user.accountDeletion?.phase === "finalized") {
    throw new AccountDeletionRejectedError(
      "conflict",
      "This account already has a deletion request.",
    );
  }
  if (await deps.hasActiveRrpAppointment(user.memberId)) {
    throw new AccountDeletionRejectedError(
      "rrp_appointment",
      "End the active regional appointment before deleting this account.",
    );
  }
  if (await deps.hasActiveEditorGrant(user.memberId)) {
    throw new AccountDeletionRejectedError(
      "editor_grant",
      "An active editor permission must be removed before deleting this account.",
    );
  }
}

async function sendScheduledNoticeOnce(
  deps: AccountDeletionDeps,
  user: AuthUserRecord,
): Promise<void> {
  const deletion = user.accountDeletion;
  if (!deletion || deletion.phase !== "pending" || !deletion.deadlineAt) {
    return;
  }
  if (deletion.scheduledNoticeEmailId) {
    return;
  }
  const delivery = await deps.sendScheduled({
    to: user.email,
    displayName: user.displayName,
    deadlineAt: deletion.deadlineAt,
  });
  if (!delivery.emailSent) {
    return;
  }
  await deps.recordScheduledNotice({
    userId: user.userId,
    requestId: deletion.requestId,
    emailId: delivery.emailId,
  });
}

export async function requestAccountDeletion(
  input: { userId: string; currentPassword: string },
  deps: AccountDeletionDeps = productionDeps(),
): Promise<AccountDeletionStatus> {
  assertDeletionFeatureEnabled();
  const user = await deps.findById(input.userId);
  if (!user) {
    throw new AccountDeletionRejectedError("not_found", "Account not found.");
  }
  await assertDeletionAllowed(deps, user);
  const passwordValid = await deps.verifyPassword(input.currentPassword, user.passwordHash);
  if (!passwordValid) {
    throw new AccountDeletionRejectedError("invalid_password", "The password is incorrect.");
  }

  const issued = await deps.issueCode({
    userId: user.userId,
    email: user.email,
    purpose: "account_deletion_confirm",
  });
  const delivery = await deps.sendCode({
    to: user.email,
    displayName: user.displayName,
    verificationCode: issued.code,
    expiresMinutes: issued.expiresMinutes,
    action: "confirm",
  });
  if (!delivery.emailSent) {
    await deps.discardCode(issued.confirmationId);
    throw new AccountDeletionRejectedError(
      "mail_failed",
      "The confirmation email could not be sent. Account deletion was not scheduled.",
    );
  }

  const requestedAt = deps.now();
  const saved = await deps.markAwaiting({
    userId: user.userId,
    requestId: deps.createRequestId(),
    requestedAt,
    confirmationExpiresAt: new Date(
      Date.parse(requestedAt) + issued.expiresMinutes * 60_000,
    ).toISOString(),
  });
  if (!saved) {
    await deps.discardCode(issued.confirmationId);
    throw new AccountDeletionRejectedError(
      "conflict",
      "This account already has a deletion request.",
    );
  }

  deps.audit({
    actorParticipantId: user.memberId,
    action: "account.deletion.requested",
    targetId: user.userId,
    afterSummary: `phase=awaiting_confirmation;requestId=${saved.accountDeletion?.requestId ?? ""}`,
  });
  return statusOf(saved);
}

export async function confirmAccountDeletion(
  input: { userId: string; code: string },
  deps: AccountDeletionDeps = productionDeps(),
): Promise<AccountDeletionStatus> {
  assertDeletionFeatureEnabled();
  const user = await deps.findById(input.userId);
  if (!user || user.role !== "member" || user.status !== "active") {
    throw new AccountDeletionRejectedError("conflict", "This account cannot confirm deletion.");
  }

  if (user.accountDeletion?.phase === "pending" && user.accountDeletion.deadlineAt) {
    await sendScheduledNoticeOnce(deps, user);
    return statusOf(user);
  }

  if (user.accountDeletion?.phase !== "awaiting_confirmation" || !user.accountDeletion.requestId) {
    throw new AccountDeletionRejectedError("conflict", "There is no deletion confirmation waiting.");
  }
  if (
    user.accountDeletion.confirmationExpiresAt &&
    user.accountDeletion.confirmationExpiresAt <= deps.now()
  ) {
    throw new AccountDeletionRejectedError(
      "invalid_code",
      "The confirmation code is incorrect or expired.",
    );
  }

  const consumed = await deps.consumeCode({
    userId: user.userId,
    code: input.code,
    purpose: "account_deletion_confirm",
  });
  if (!consumed) {
    throw new AccountDeletionRejectedError(
      "invalid_code",
      "The confirmation code is incorrect or expired.",
    );
  }

  const confirmedAt = deps.now();
  const deadlineAt = deletionDeadlineFromConfirmation(confirmedAt);
  const saved = await deps.markPending({
    userId: user.userId,
    requestId: user.accountDeletion.requestId,
    confirmedAt,
    deadlineAt,
  });
  if (!saved) {
    const current = await deps.findById(user.userId);
    if (current?.accountDeletion?.phase === "pending" && current.accountDeletion.deadlineAt) {
      return statusOf(current);
    }
    throw new AccountDeletionRejectedError("conflict", "This account cannot confirm deletion.");
  }

  await deps.revokeSessions(saved.userId);
  await sendScheduledNoticeOnce(deps, saved);
  deps.audit({
    actorParticipantId: saved.memberId,
    action: "account.deletion.confirmed",
    targetId: saved.userId,
    afterSummary: `phase=pending;deadlineAt=${deadlineAt};requestId=${saved.accountDeletion?.requestId ?? ""}`,
  });
  return statusOf(saved);
}

export async function getAccountDeletionStatus(
  userId: string,
  deps: AccountDeletionDeps = productionDeps(),
): Promise<AccountDeletionStatus> {
  assertDeletionFeatureEnabled();
  const user = await deps.findById(userId);
  if (!user) {
    throw new AccountDeletionRejectedError("not_found", "Account not found.");
  }
  return statusOf(user);
}

export async function requestAccountDeletionCancellation(
  email: string,
  deps: AccountDeletionDeps = productionDeps(),
): Promise<{ message: string }> {
  if (!isAccountDeletionEnabled()) {
    return { message: ACCOUNT_DELETION_CANCEL_REQUEST_MESSAGE };
  }
  const normalized = email.trim().toLowerCase();
  if (normalized.includes("@")) {
    const user = await deps.findByEmail(normalized);
    const deletion = user?.accountDeletion;
    if (
      user &&
      user.status === "active" &&
      deletion &&
      isDeletionRecoveryOpen(deletion, deps.now())
    ) {
      const issued = await deps.issueCode({
        userId: user.userId,
        email: user.email,
        purpose: "account_deletion_cancel",
      });
      const delivery = await deps.sendCode({
        to: user.email,
        displayName: user.displayName,
        verificationCode: issued.code,
        expiresMinutes: issued.expiresMinutes,
        action: "cancel",
      });
      if (!delivery.emailSent) {
        await deps.discardCode(issued.confirmationId);
      }
    }
  }
  return { message: ACCOUNT_DELETION_CANCEL_REQUEST_MESSAGE };
}

export async function confirmAccountDeletionCancellation(
  input: { email: string; currentPassword: string; code: string },
  deps: AccountDeletionDeps = productionDeps(),
): Promise<{ message: string }> {
  const fail = new AccountDeletionRejectedError(
    "invalid_code",
    ACCOUNT_DELETION_CANCEL_FAILURE_MESSAGE,
  );
  if (!isAccountDeletionEnabled()) {
    throw fail;
  }
  const user = await deps.findByEmail(input.email);
  if (!user || user.status !== "active" || !user.accountDeletion) {
    throw fail;
  }
  if (!isDeletionRecoveryOpen(user.accountDeletion, deps.now())) {
    throw fail;
  }
  const passwordValid = await deps.verifyPassword(input.currentPassword, user.passwordHash);
  if (!passwordValid) {
    throw fail;
  }
  const consumed = await deps.consumeCode({
    userId: user.userId,
    code: input.code,
    purpose: "account_deletion_cancel",
  });
  if (!consumed) {
    throw fail;
  }
  const cancelledAt = deps.now();
  const saved = await deps.markCancelled({
    userId: user.userId,
    requestId: user.accountDeletion.requestId,
    cancelledAt,
    nowIso: cancelledAt,
  });
  if (!saved) {
    throw fail;
  }
  await deps.sendCancelled({ to: saved.email, displayName: saved.displayName });
  deps.audit({
    actorParticipantId: saved.memberId,
    action: "account.deletion.cancelled",
    targetId: saved.userId,
    afterSummary: `phase=cancelled;requestId=${saved.accountDeletion?.requestId ?? ""}`,
  });
  return { message: ACCOUNT_DELETION_CANCEL_SUCCESS_MESSAGE };
}

async function closeFinalizedProfile(
  deps: AccountDeletionDeps,
  user: AuthUserRecord,
  nowIso: string,
): Promise<void> {
  if (user.accountDeletion?.profileClosedAt) {
    return;
  }
  await deps.closeProfile(user.userId, nowIso);
  await deps.markProfileClosed({ userId: user.userId, closedAt: nowIso });
}

/**
 * Idempotent finalization. A late tick uses the stored deadline and does not
 * extend it. An administrator suspension does not keep a confirmed deletion
 * pending and is not cleared by this tick. Mail failure does not stop the
 * email release. Integrity Media links, RRP records, editor grants, and civic
 * documents are not modified.
 */
export async function runAccountDeletionFinalizationTick(
  deps: AccountDeletionDeps = productionDeps(),
): Promise<{ finalized: number; profilesClosed: number; reminders: number }> {
  if (!isAccountDeletionEnabled()) {
    return { finalized: 0, profilesClosed: 0, reminders: 0 };
  }
  const reminders = await sendDueDeletionReminders(deps);
  const nowIso = deps.now();
  const candidates = await deps.listCandidates(nowIso);
  let finalized = 0;
  let profilesClosed = 0;

  for (const candidate of candidates) {
    if (candidate.accountDeletion?.phase === "finalized") {
      await closeFinalizedProfile(deps, candidate, nowIso);
      profilesClosed += 1;
      continue;
    }
    if (candidate.accountDeletion?.phase !== "pending" || !candidate.accountDeletion.deadlineAt) {
      continue;
    }
    if (candidate.accountDeletion.deadlineAt > nowIso) {
      continue;
    }

    let noticeStatus = candidate.accountDeletion.finalNoticeStatus;
    if (!noticeStatus) {
      const claimed = await deps.claimFinalNotice({ userId: candidate.userId, nowIso });
      if (claimed) {
        const previousEmail = candidate.email;
        let status: "sent" | "failed" = "failed";
        try {
          const delivery = await deps.sendFinalized({
            to: previousEmail,
            displayName: candidate.displayName,
          });
          status = delivery.emailSent ? "sent" : "failed";
        } catch {
          status = "failed";
        }
        await deps.setFinalNoticeStatus({ userId: candidate.userId, status, nowIso });
        noticeStatus = status;
      } else {
        const claimedBefore = new Date(Date.parse(nowIso) - deps.noticeReclaimMs).toISOString();
        const skipped = await deps.skipStaleFinalNotice({
          userId: candidate.userId,
          nowIso,
          claimedBeforeIso: claimedBefore,
        });
        if (skipped) {
          noticeStatus = "skipped";
        }
      }
    } else if (noticeStatus === "sending") {
      const claimedBefore = new Date(Date.parse(nowIso) - deps.noticeReclaimMs).toISOString();
      const skipped = await deps.skipStaleFinalNotice({
        userId: candidate.userId,
        nowIso,
        claimedBeforeIso: claimedBefore,
      });
      if (skipped) {
        noticeStatus = "skipped";
      }
    }

    if (noticeStatus !== "sent" && noticeStatus !== "failed" && noticeStatus !== "skipped") {
      continue;
    }

    const passwordHash = await deps.hashReplacementPassword();
    const saved = await deps.finalizeRecord({
      userId: candidate.userId,
      nowIso,
      reservedEmail: reservedDeletionEmail(candidate.userId),
      passwordHash,
      previousEmailHash: hashDeletionEmail(candidate.email),
    });
    if (!saved) {
      const current = await deps.findById(candidate.userId);
      if (current?.accountDeletion?.phase === "finalized") {
        await closeFinalizedProfile(deps, current, nowIso);
        profilesClosed += 1;
      }
      continue;
    }

    try {
      await deps.invalidateAuthMaterial(saved.userId);
    } catch {
      // The finalized phase already blocks sign-in, refresh, and residual requests.
    }
    await closeFinalizedProfile(deps, saved, nowIso);
    deps.audit({
      actorParticipantId: saved.memberId,
      action: "account.deletion.finalized",
      targetId: saved.userId,
      afterSummary: `phase=finalized;requestId=${saved.accountDeletion?.requestId ?? ""};emailReleased=true`,
    });
    finalized += 1;
    profilesClosed += 1;
  }

  return { finalized, profilesClosed, reminders };
}

async function sendDueDeletionReminders(deps: AccountDeletionDeps): Promise<number> {
  const nowIso = deps.now();
  const reminderDueByIso = new Date(Date.parse(nowIso) + ACCOUNT_DELETION_REMINDER_LEAD_MS).toISOString();
  const candidates = await deps.listReminderCandidates(nowIso, reminderDueByIso);
  let reminders = 0;

  for (const candidate of candidates) {
    const deletion = candidate.accountDeletion;
    if (!deletion || deletion.phase !== "pending" || !deletion.deadlineAt) {
      continue;
    }
    if (deletion.reminderStatus === "sent") {
      continue;
    }
    if (deletion.reminderStatus === "sending") {
      const claimedBefore = new Date(Date.parse(nowIso) - deps.noticeReclaimMs).toISOString();
      await deps.releaseStaleReminder({
        userId: candidate.userId,
        nowIso,
        claimedBeforeIso: claimedBefore,
      });
      continue;
    }

    const claimed = await deps.claimReminder({
      userId: candidate.userId,
      nowIso,
      reminderDueByIso,
    });
    if (!claimed) {
      continue;
    }

    let status: "sent" | "failed" = "failed";
    try {
      const delivery = await deps.sendReminder({
        to: candidate.email,
        displayName: candidate.displayName,
        deadlineAt: deletion.deadlineAt,
      });
      status = delivery.emailSent ? "sent" : "failed";
    } catch {
      status = "failed";
    }
    await deps.setReminderStatus({ userId: candidate.userId, status, nowIso });
    if (status === "sent") {
      reminders += 1;
    }
  }

  return reminders;
}
