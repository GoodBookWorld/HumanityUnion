/**
 * HU-NOTIF-02C.2 — process claimed immediate delivery rows.
 *
 * Dry-run reprocessing policy:
 * - Successful dry-run → status `dry_run_ok` (not `sent`).
 * - Live never claims `dry_run_ok`.
 * - Promotion to live requires explicit `requeueDryRunOkMemberNotificationEmailDeliveries`.
 * - No automatic promotion when mode flips to live.
 *
 * Lease safety:
 * - Completions require matching leaseOwner and status === claimed.
 * - Stale workers after lease expiry/steal cannot finalize.
 * - Shutdown may leave claimed rows; expired leases are reclaimable (not permanently blocked).
 */

import { hostname } from "node:os";
import { randomUUID } from "node:crypto";

import type { MemberNotificationEmailDeliveryRecord } from "@hu/types";

import { executeMemberNotificationEmailDeliveryAdapter } from "./delivery-adapter.js";
import {
  logMemberNotificationEmailDeliveryEvent,
  recordMemberNotificationEmailMetric,
} from "./delivery-metrics.js";
import { evaluateMemberNotificationEmailDeliveryEligibility } from "./eligibility.js";
import {
  isMemberNotificationEmailDeliveryWorkerPermitted,
  resolveMemberNotificationEmailDeliveryActivationAt,
  resolveMemberNotificationEmailDeliveryMode,
} from "./feature-flag.js";
import {
  MEMBER_NOTIFICATION_EMAIL_DELIVERY_BATCH_SIZE,
  MEMBER_NOTIFICATION_EMAIL_DELIVERY_LEASE_MS,
  resolveMemberNotificationEmailDeliveryBackoffMs,
} from "./member-notification-email-delivery.constants.js";
import {
  claimNextMemberNotificationEmailDelivery,
  updateMemberNotificationEmailDelivery,
} from "./member-notification-email-delivery.repository.js";
import { resolveNotificationPersistenceAdapter } from "../persistence/resolve-notification-persistence.js";

export interface MemberNotificationEmailWorkerTickResult {
  processed: number;
  dryRunOk: number;
  sent: number;
  cancelled: number;
  failed: number;
  liveBlocked: number;
  skipped: number;
  staleLease: number;
  rateLimited: number;
}

function createLeaseOwner(): string {
  return `${hostname()}:${process.pid}:${randomUUID()}`;
}

async function finalizeClaimed(
  record: MemberNotificationEmailDeliveryRecord,
  leaseOwner: string,
  patch: Partial<MemberNotificationEmailDeliveryRecord>,
): Promise<boolean> {
  const updated = await updateMemberNotificationEmailDelivery(
    record.deliveryId,
    {
      leaseOwner: null,
      leaseExpiresAt: null,
      ...patch,
    },
    { expectedLeaseOwner: leaseOwner, requireClaimedStatus: true },
  );
  return updated !== null;
}

export async function processMemberNotificationEmailDeliveryClaim(
  record: MemberNotificationEmailDeliveryRecord,
  leaseOwner: string,
): Promise<
  | "dry_run_ok"
  | "sent"
  | "cancelled"
  | "failed"
  | "live_blocked"
  | "skipped"
  | "stale_lease"
  | "rate_limited"
> {
  const mode = resolveMemberNotificationEmailDeliveryMode();
  const eligibility = await evaluateMemberNotificationEmailDeliveryEligibility(record);

  if (!eligibility.eligible) {
    recordMemberNotificationEmailMetric(
      eligibility.terminalStatus === "cancelled" ? "cancelled" : "skipped",
    );
    const ok = await finalizeClaimed(record, leaseOwner, {
      status: eligibility.terminalStatus,
      skipReason: eligibility.skipReason,
      nextAttemptAt: null,
      lastErrorCode: eligibility.skipReason,
      destinationHash: record.destinationHash ?? null,
    });
    if (!ok) {
      return "stale_lease";
    }
    return eligibility.terminalStatus === "cancelled" ? "cancelled" : "skipped";
  }

  const hashUpdate = await updateMemberNotificationEmailDelivery(
    record.deliveryId,
    {
      destinationHash: eligibility.destinationHash,
      destinationModeSnapshot: eligibility.destinationModeSnapshot,
    },
    { expectedLeaseOwner: leaseOwner, requireClaimedStatus: true },
  );
  if (!hashUpdate) {
    return "stale_lease";
  }

  try {
    const notification = await resolveNotificationPersistenceAdapter().findById(
      record.notificationId,
    );

    const adapterResult = await executeMemberNotificationEmailDeliveryAdapter({
      deliveryId: record.deliveryId,
      notificationId: record.notificationId,
      eventType: record.eventType,
      destinationHash: eligibility.destinationHash,
      mode,
      recipientUserId: record.recipientUserId,
      recipientMemberId: record.recipientMemberId,
      relatedUrl: notification?.relatedUrl ?? null,
      createdAt: record.createdAt,
    });

    if (adapterResult.outcome === "dry_run_validated") {
      recordMemberNotificationEmailMetric("dry_run_ok");
      const ok = await finalizeClaimed(record, leaseOwner, {
        status: "dry_run_ok",
        skipReason: "dry_run",
        providerEmailId: null,
        nextAttemptAt: null,
        lastErrorCode: null,
        destinationHash: eligibility.destinationHash,
        destinationModeSnapshot: eligibility.destinationModeSnapshot,
      });
      return ok ? "dry_run_ok" : "stale_lease";
    }

    if (adapterResult.outcome === "sent") {
      const ok = await finalizeClaimed(record, leaseOwner, {
        status: "sent",
        skipReason: null,
        providerEmailId: adapterResult.providerEmailId,
        nextAttemptAt: null,
        lastErrorCode: null,
        destinationHash: adapterResult.destinationHash,
        destinationModeSnapshot: eligibility.destinationModeSnapshot,
      });
      return ok ? "sent" : "stale_lease";
    }

    if (adapterResult.outcome === "template_failed") {
      const ok = await finalizeClaimed(record, leaseOwner, {
        status: "failed",
        lastErrorCode: adapterResult.errorCode,
        nextAttemptAt: null,
        providerEmailId: null,
        skipReason: null,
      });
      return ok ? "failed" : "stale_lease";
    }

    if (adapterResult.outcome === "live_gate_failed") {
      const retryable = !adapterResult.terminal;
      const backoffMs = resolveMemberNotificationEmailDeliveryBackoffMs(record.attemptCount);
      const ok = await finalizeClaimed(record, leaseOwner, {
        status: retryable ? "failed" : "cancelled",
        skipReason: adapterResult.errorCode,
        providerEmailId: null,
        nextAttemptAt: retryable
          ? new Date(Date.now() + backoffMs).toISOString()
          : null,
        lastErrorCode: adapterResult.errorCode,
        destinationHash: eligibility.destinationHash,
      });
      if (!ok) {
        return "stale_lease";
      }
      if (
        adapterResult.errorCode === "rate_limited" ||
        adapterResult.errorCode === "index_not_ready"
      ) {
        return "rate_limited";
      }
      return retryable ? "failed" : "live_blocked";
    }

    if (
      adapterResult.outcome === "provider_deferred" ||
      adapterResult.outcome === "provider_failed" ||
      adapterResult.outcome === "provider_blocked" ||
      adapterResult.outcome === "provider_ambiguous"
    ) {
      const terminal =
        adapterResult.terminal || record.attemptCount >= record.maxAttempts;
      const backoffMs = resolveMemberNotificationEmailDeliveryBackoffMs(record.attemptCount);
      const ok = await finalizeClaimed(record, leaseOwner, {
        status: "failed",
        skipReason: adapterResult.errorCode,
        providerEmailId: adapterResult.providerEmailId,
        nextAttemptAt: terminal
          ? null
          : new Date(Date.now() + backoffMs).toISOString(),
        lastErrorCode: adapterResult.errorCode,
        destinationHash: eligibility.destinationHash,
      });
      if (!ok) {
        return "stale_lease";
      }
      if (!terminal) {
        recordMemberNotificationEmailMetric("retried");
        logMemberNotificationEmailDeliveryEvent({
          channel: "immediate",
          outcome: "retry_scheduled",
          errorCode: adapterResult.errorCode,
        });
      }
      return "failed";
    }

    if (adapterResult.outcome === "live_not_ready") {
      const ok = await finalizeClaimed(record, leaseOwner, {
        status: "cancelled",
        skipReason: "live_not_ready",
        providerEmailId: null,
        nextAttemptAt: null,
        lastErrorCode: "live_not_ready",
      });
      return ok ? "live_blocked" : "stale_lease";
    }

    const ok = await finalizeClaimed(record, leaseOwner, {
      status: "cancelled",
      skipReason: "flag_off",
      nextAttemptAt: null,
      lastErrorCode: adapterResult.errorCode,
    });
    return ok ? "cancelled" : "stale_lease";
  } catch {
    const attemptCount = record.attemptCount;
    const terminal = attemptCount >= record.maxAttempts;
    const backoffMs = resolveMemberNotificationEmailDeliveryBackoffMs(attemptCount);
    const nextAttemptAt = terminal
      ? null
      : new Date(Date.now() + backoffMs).toISOString();

    const ok = await finalizeClaimed(record, leaseOwner, {
      status: "failed",
      lastErrorCode: terminal ? "max_attempts" : "processing_error",
      nextAttemptAt,
      providerEmailId: null,
      skipReason: null,
    });
    return ok ? "failed" : "stale_lease";
  }
}

export async function runMemberNotificationEmailDeliveryWorkerTick(
  options: { batchSize?: number } = {},
): Promise<MemberNotificationEmailWorkerTickResult> {
  const result: MemberNotificationEmailWorkerTickResult = {
    processed: 0,
    dryRunOk: 0,
    sent: 0,
    cancelled: 0,
    failed: 0,
    liveBlocked: 0,
    skipped: 0,
    staleLease: 0,
    rateLimited: 0,
  };

  if (!isMemberNotificationEmailDeliveryWorkerPermitted()) {
    return result;
  }

  const activationAt = resolveMemberNotificationEmailDeliveryActivationAt();
  if (!activationAt) {
    return result;
  }

  const batchSize = options.batchSize ?? MEMBER_NOTIFICATION_EMAIL_DELIVERY_BATCH_SIZE;
  const leaseOwner = createLeaseOwner();

  for (let index = 0; index < batchSize; index += 1) {
    const leaseExpiresAt = new Date(
      Date.now() + MEMBER_NOTIFICATION_EMAIL_DELIVERY_LEASE_MS,
    ).toISOString();

    const claimed = await claimNextMemberNotificationEmailDelivery({
      leaseOwner,
      leaseExpiresAt,
      activationAt,
    });

    if (!claimed) {
      break;
    }

    result.processed += 1;
    const outcome = await processMemberNotificationEmailDeliveryClaim(claimed, leaseOwner);
    if (outcome === "dry_run_ok") {
      result.dryRunOk += 1;
    } else if (outcome === "sent") {
      result.sent += 1;
    } else if (outcome === "cancelled") {
      result.cancelled += 1;
    } else if (outcome === "failed") {
      result.failed += 1;
    } else if (outcome === "live_blocked") {
      result.liveBlocked += 1;
    } else if (outcome === "rate_limited") {
      result.rateLimited += 1;
    } else if (outcome === "stale_lease") {
      result.staleLease += 1;
    } else {
      result.skipped += 1;
    }
  }

  return result;
}
