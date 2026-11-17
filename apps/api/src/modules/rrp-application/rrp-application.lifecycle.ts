import type {
  AdminRrpApplicationReviewDecision,
  RrpApplicationStatus,
} from "@hu/types";

import { RRP_APPLICATION_ACTIVE_STATUSES } from "./rrp-application.constants.js";
import { RrpApplicationConflictError, RrpApplicationValidationError } from "./rrp-application.errors.js";

const ACTIVE = new Set<RrpApplicationStatus>(RRP_APPLICATION_ACTIVE_STATUSES);

export function isRrpApplicationActiveStatus(status: RrpApplicationStatus): boolean {
  return ACTIVE.has(status);
}

/** Statuses from which the applicant may withdraw. */
const WITHDRAWABLE: ReadonlySet<RrpApplicationStatus> = new Set([
  "draft",
  "submitted",
  "under_review",
  "information_requested",
]);

/** Statuses from which the applicant may edit field content. */
const PARTICIPANT_EDITABLE: ReadonlySet<RrpApplicationStatus> = new Set([
  "draft",
  "information_requested",
]);

/** Statuses from which the applicant may submit / resubmit. */
const PARTICIPANT_SUBMITTABLE: ReadonlySet<RrpApplicationStatus> = new Set([
  "draft",
  "information_requested",
]);

const ADMIN_TRANSITIONS: Readonly<
  Record<AdminRrpApplicationReviewDecision, ReadonlySet<RrpApplicationStatus>>
> = {
  mark_under_review: new Set(["submitted", "information_requested"]),
  request_information: new Set(["submitted", "under_review"]),
  approve: new Set(["submitted", "under_review"]),
  reject: new Set(["submitted", "under_review", "information_requested"]),
};

const ADMIN_TARGET: Readonly<Record<AdminRrpApplicationReviewDecision, RrpApplicationStatus>> = {
  mark_under_review: "under_review",
  request_information: "information_requested",
  approve: "approved",
  reject: "rejected",
};

export function assertParticipantMayUpdate(status: RrpApplicationStatus): void {
  if (!PARTICIPANT_EDITABLE.has(status)) {
    throw new RrpApplicationConflictError(
      "Only draft or information-requested applications can be updated by the applicant.",
    );
  }
}

export function assertParticipantMaySubmit(status: RrpApplicationStatus): void {
  if (!PARTICIPANT_SUBMITTABLE.has(status)) {
    throw new RrpApplicationConflictError(
      "Only draft or information-requested applications can be submitted.",
    );
  }
}

export function assertParticipantMayWithdraw(status: RrpApplicationStatus): void {
  if (!WITHDRAWABLE.has(status)) {
    throw new RrpApplicationConflictError(
      "This application can no longer be withdrawn.",
    );
  }
}

export function resolveAdminReviewTargetStatus(
  decision: AdminRrpApplicationReviewDecision,
): RrpApplicationStatus {
  return ADMIN_TARGET[decision];
}

export function assertAdminMayTransition(input: {
  fromStatus: RrpApplicationStatus;
  decision: AdminRrpApplicationReviewDecision;
}): RrpApplicationStatus {
  const allowed = ADMIN_TRANSITIONS[input.decision];
  if (!allowed) {
    throw new RrpApplicationValidationError("Unknown review decision.");
  }

  if (!allowed.has(input.fromStatus)) {
    throw new RrpApplicationConflictError(
      `Cannot apply decision "${input.decision}" from status "${input.fromStatus}".`,
    );
  }

  return resolveAdminReviewTargetStatus(input.decision);
}

/**
 * Idempotent terminal checks — caller returns existing record without re-auditing.
 */
export function isIdempotentAdminDecision(input: {
  status: RrpApplicationStatus;
  decision: AdminRrpApplicationReviewDecision;
}): boolean {
  if (input.decision === "approve" && input.status === "approved") {
    return true;
  }
  if (input.decision === "reject" && input.status === "rejected") {
    return true;
  }
  if (input.decision === "mark_under_review" && input.status === "under_review") {
    return true;
  }
  if (input.decision === "request_information" && input.status === "information_requested") {
    return true;
  }
  return false;
}

export function isIdempotentWithdraw(status: RrpApplicationStatus): boolean {
  return status === "withdrawn";
}

export function isIdempotentSubmit(status: RrpApplicationStatus): boolean {
  return status === "submitted";
}
