import type {
  AdminMemberBadgeFulfillmentUpdateInput,
  AdminMemberBadgeLabelEmailResult,
  AdminMemberBadgeOrderDetail,
  MemberBadgeApplicationFulfillmentStatus,
  MemberBadgeApplicationRecord,
} from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { recordAdministrationAuditBestEffort } from "../administration/audit.service.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  MemberBadgeApplicationNotFoundError,
  MemberBadgeApplicationValidationError,
} from "./member-badge-application.errors.js";
import { toAdminMemberBadgeOrderDetail } from "./member-badge-application.projection.js";
import {
  findMemberBadgeApplicationById,
  markMemberBadgeApplicationLabelEmailed,
  updateMemberBadgeApplicationFulfillmentMarkers,
} from "./member-badge-application.repository.js";
import {
  emailMemberBadgeApplicationLabel,
  resolveMemberBadgeApplicationLookupUrl,
} from "./member-badge-application-label.service.js";

async function assertAdminActor(userId: string): Promise<{
  userId: string;
  memberId: string;
  displayName: string;
}> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }

  const user = await findAuthUserById(userId);
  if (!user || user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }

  return {
    userId: user.userId,
    memberId: user.memberId,
    displayName: user.displayName,
  };
}

export function deriveMemberBadgeFulfillmentStatus(input: {
  paymentStatus: MemberBadgeApplicationRecord["paymentStatus"];
  shipped: boolean;
  delivered: boolean;
}): MemberBadgeApplicationFulfillmentStatus {
  if (input.paymentStatus === "unpaid") {
    return "not_ready";
  }
  if (input.delivered) {
    return "completed";
  }
  if (input.shipped) {
    return "shipped";
  }
  return "awaiting_fulfillment";
}

function resolveFulfillmentMarkers(
  current: MemberBadgeApplicationRecord,
  patch: AdminMemberBadgeFulfillmentUpdateInput,
): {
  shipped: boolean;
  shippedAt: string | null;
  delivered: boolean;
  deliveredAt: string | null;
} {
  let shipped = current.shipped;
  let shippedAt = current.shippedAt;
  let delivered = current.delivered;
  let deliveredAt = current.deliveredAt;
  const now = new Date().toISOString();

  if (patch.delivered === true) {
    // Delivered implies shipped.
    delivered = true;
    deliveredAt = deliveredAt ?? now;
    shipped = true;
    shippedAt = shippedAt ?? now;
  } else if (patch.delivered === false) {
    // Unmark delivered; keep shipped.
    delivered = false;
    deliveredAt = null;
  }

  if (patch.shipped === true) {
    shipped = true;
    shippedAt = shippedAt ?? now;
  } else if (patch.shipped === false) {
    // Unmark shipped while delivered also unmarks delivered.
    shipped = false;
    shippedAt = null;
    if (delivered) {
      delivered = false;
      deliveredAt = null;
    }
  }

  return { shipped, shippedAt, delivered, deliveredAt };
}

function validateRefundedFulfillmentTransition(
  current: MemberBadgeApplicationRecord,
  next: { shipped: boolean; delivered: boolean },
): void {
  if (current.paymentStatus !== "refunded") {
    return;
  }

  const markingShip = !current.shipped && next.shipped;
  const markingDeliver = !current.delivered && next.delivered;

  if (!current.shipped && !current.delivered && (markingShip || markingDeliver)) {
    throw new MemberBadgeApplicationValidationError(
      "Cannot mark shipped or delivered on a refunded Member Badge Application that was never fulfilled.",
    );
  }
}

function buildFulfillmentAfterSummary(record: MemberBadgeApplicationRecord): string {
  return [
    `payment=${record.paymentStatus}`,
    `fulfillment=${record.fulfillmentStatus}`,
    `shipped=${record.shipped ? 1 : 0}`,
    `delivered=${record.delivered ? 1 : 0}`,
  ].join(";");
}

export async function getAdminMemberBadgeOrderDetail(input: {
  actorUserId: string;
  applicationId: string;
}): Promise<AdminMemberBadgeOrderDetail> {
  await assertAdminActor(input.actorUserId);

  const applicationId = input.applicationId.trim();
  if (!applicationId) {
    throw new MemberBadgeApplicationValidationError("applicationId is required.");
  }

  const record = await findMemberBadgeApplicationById(applicationId);
  if (!record) {
    throw new MemberBadgeApplicationNotFoundError();
  }

  const owner = await findAuthUserById(record.userId);

  return toAdminMemberBadgeOrderDetail({
    record,
    displayName: owner?.displayName?.trim() || "Participant",
    email: owner?.email ?? "",
    lookupUrl: resolveMemberBadgeApplicationLookupUrl(record.applicationId),
  });
}

export async function updateAdminMemberBadgeFulfillment(input: {
  actorUserId: string;
  applicationId: string;
  patch: AdminMemberBadgeFulfillmentUpdateInput;
}): Promise<AdminMemberBadgeOrderDetail> {
  const admin = await assertAdminActor(input.actorUserId);

  const applicationId = input.applicationId.trim();
  if (!applicationId) {
    throw new MemberBadgeApplicationValidationError("applicationId is required.");
  }

  if (input.patch.shipped === undefined && input.patch.delivered === undefined) {
    throw new MemberBadgeApplicationValidationError(
      "At least one of shipped or delivered must be provided.",
    );
  }

  const current = await findMemberBadgeApplicationById(applicationId);
  if (!current) {
    throw new MemberBadgeApplicationNotFoundError();
  }

  const nextMarkers = resolveFulfillmentMarkers(current, input.patch);
  validateRefundedFulfillmentTransition(current, nextMarkers);

  const fulfillmentStatus = deriveMemberBadgeFulfillmentStatus({
    paymentStatus: current.paymentStatus,
    shipped: nextMarkers.shipped,
    delivered: nextMarkers.delivered,
  });

  const updated = await updateMemberBadgeApplicationFulfillmentMarkers({
    applicationId,
    shipped: nextMarkers.shipped,
    shippedAt: nextMarkers.shippedAt,
    delivered: nextMarkers.delivered,
    deliveredAt: nextMarkers.deliveredAt,
    fulfillmentStatus,
  });

  if (!updated) {
    throw new MemberBadgeApplicationNotFoundError();
  }

  if (current.shipped !== updated.shipped) {
    recordAdministrationAuditBestEffort({
      actorParticipantId: admin.memberId,
      action: updated.shipped
        ? "member_badge.fulfillment.shipped_marked"
        : "member_badge.fulfillment.shipped_unmarked",
      targetType: "member_badge_application",
      targetId: updated.applicationId,
      beforeSummary: buildFulfillmentAfterSummary(current),
      afterSummary: buildFulfillmentAfterSummary(updated),
    });
  }

  if (current.delivered !== updated.delivered) {
    recordAdministrationAuditBestEffort({
      actorParticipantId: admin.memberId,
      action: updated.delivered
        ? "member_badge.fulfillment.delivered_marked"
        : "member_badge.fulfillment.delivered_unmarked",
      targetType: "member_badge_application",
      targetId: updated.applicationId,
      beforeSummary: buildFulfillmentAfterSummary(current),
      afterSummary: buildFulfillmentAfterSummary(updated),
    });
  }

  const owner = await findAuthUserById(updated.userId);

  return toAdminMemberBadgeOrderDetail({
    record: updated,
    displayName: owner?.displayName?.trim() || "Participant",
    email: owner?.email ?? "",
    lookupUrl: resolveMemberBadgeApplicationLookupUrl(updated.applicationId),
  });
}

export async function emailAdminMemberBadgeLabel(input: {
  actorUserId: string;
  applicationId: string;
}): Promise<AdminMemberBadgeLabelEmailResult> {
  const admin = await assertAdminActor(input.actorUserId);

  const applicationId = input.applicationId.trim();
  if (!applicationId) {
    throw new MemberBadgeApplicationValidationError("applicationId is required.");
  }

  const record = await findMemberBadgeApplicationById(applicationId);
  if (!record) {
    throw new MemberBadgeApplicationNotFoundError();
  }

  const owner = await findAuthUserById(record.userId);
  const result = await emailMemberBadgeApplicationLabel({
    application: record,
    participantDisplayName: owner?.displayName?.trim() || "Participant",
  });

  await markMemberBadgeApplicationLabelEmailed(record.applicationId);

  recordAdministrationAuditBestEffort({
    actorParticipantId: admin.memberId,
    action: "member_badge.fulfillment.label_emailed",
    targetType: "member_badge_application",
    targetId: record.applicationId,
    afterSummary: `payment=${record.paymentStatus};fulfillment=${record.fulfillmentStatus};labelEmailed=1`,
  });

  return result;
}

export async function getAdminMemberBadgeLabelPdfBuffer(input: {
  actorUserId: string;
  applicationId: string;
}): Promise<{ buffer: Buffer; filename: string }> {
  await assertAdminActor(input.actorUserId);

  const applicationId = input.applicationId.trim();
  if (!applicationId) {
    throw new MemberBadgeApplicationValidationError("applicationId is required.");
  }

  const record = await findMemberBadgeApplicationById(applicationId);
  if (!record) {
    throw new MemberBadgeApplicationNotFoundError();
  }

  const { generateLabelPdfBuffer } = await import("./member-badge-application-label.service.js");
  const buffer = await generateLabelPdfBuffer(record);
  return {
    buffer,
    filename: `member-badge-label-${record.applicationId.slice(0, 8)}.pdf`,
  };
}
