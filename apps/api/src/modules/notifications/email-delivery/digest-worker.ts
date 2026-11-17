/**
 * HU-NOTIF-02C.4 — daily/weekly digest projector worker.
 *
 * Dry-run policy:
 * - Successful dry-run → digest + included children status `dry_run_ok` (not `sent`).
 * - Live never claims `dry_run_ok`.
 * - No automatic promotion when mode flips to live.
 *
 * Completion safety:
 * - All open children for a bucket are loaded (paginated) before completion.
 * - Exceeding the child safety cap fails closed with retry (no partial success).
 * - Children are closed before digest-run terminalization; reclaim with no open
 *   children finalizes without re-invoking the adapter (no duplicate send).
 *
 * SMTP acceptance ambiguity (documented):
 * - Once live SMTP is enabled, provider acceptance without durable confirmation remains
 *   an unavoidable edge case; this phase never calls SMTP.
 */

import { hostname } from "node:os";
import { randomUUID } from "node:crypto";

import type {
  MemberNotificationEmailDeliveryRecord,
  MemberNotificationEmailDigestRunRecord,
} from "@hu/types";

import { executeMemberNotificationEmailDigestAdapter } from "./digest-adapter.js";
import {
  evaluateMemberNotificationEmailDigestChildEligibility,
  evaluateMemberNotificationEmailDigestRecipientEligibility,
} from "./digest-eligibility.js";
import { parseMemberNotificationDigestBucketKey } from "./digest-period.js";
import {
  claimNextMemberNotificationEmailDigestRun,
  ensureMemberNotificationEmailDigestRun,
  reopenMemberNotificationEmailDigestRunForResiduals,
  updateMemberNotificationEmailDigestRun,
} from "./digest-run.repository.js";
import {
  isMemberNotificationEmailDeliveryWorkerPermitted,
  resolveMemberNotificationEmailDeliveryActivationAt,
  resolveMemberNotificationEmailDeliveryMode,
} from "./feature-flag.js";
import {
  MEMBER_NOTIFICATION_EMAIL_DELIVERY_LEASE_MS,
  MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS,
  MEMBER_NOTIFICATION_EMAIL_DIGEST_BATCH_SIZE,
  MEMBER_NOTIFICATION_EMAIL_DIGEST_BUCKET_DISCOVERY_LIMIT,
  MEMBER_NOTIFICATION_EMAIL_DIGEST_CHILD_MAX,
  MEMBER_NOTIFICATION_EMAIL_DIGEST_CHILD_PAGE_SIZE,
  resolveMemberNotificationEmailDeliveryBackoffMs,
} from "./member-notification-email-delivery.constants.js";
import {
  listDueMemberNotificationEmailDigestBuckets,
  listOpenMemberNotificationEmailDigestBucketDeliveriesPage,
  updateMemberNotificationEmailDelivery,
} from "./member-notification-email-delivery.repository.js";

export interface MemberNotificationEmailDigestWorkerTickResult {
  discovered: number;
  processed: number;
  dryRunOk: number;
  cancelled: number;
  failed: number;
  liveBlocked: number;
  empty: number;
  staleLease: number;
}

function createLeaseOwner(): string {
  return `${hostname()}:${process.pid}:${randomUUID()}`;
}

async function finalizeDigestRun(
  run: MemberNotificationEmailDigestRunRecord,
  leaseOwner: string,
  patch: Partial<MemberNotificationEmailDigestRunRecord>,
): Promise<boolean> {
  const updated = await updateMemberNotificationEmailDigestRun(
    run.digestId,
    {
      leaseOwner: null,
      leaseExpiresAt: null,
      ...patch,
    },
    { expectedLeaseOwner: leaseOwner, requireClaimedStatus: true },
  );
  return updated !== null;
}

async function closeChildDeliveries(
  records: MemberNotificationEmailDeliveryRecord[],
  patch: Partial<MemberNotificationEmailDeliveryRecord>,
): Promise<void> {
  const nowIso = new Date().toISOString();
  for (const record of records) {
    await updateMemberNotificationEmailDelivery(record.deliveryId, {
      ...patch,
      updatedAt: nowIso,
    });
  }
}

/**
 * Load every open child for a bucket via keyset pagination.
 * Returns null when the safety cap would be exceeded (fail closed).
 */
export async function loadAllOpenMemberNotificationEmailDigestBucketDeliveries(input: {
  digestBucketKey: string;
  activationAt: string;
}): Promise<MemberNotificationEmailDeliveryRecord[] | null> {
  const all: MemberNotificationEmailDeliveryRecord[] = [];
  let afterCreatedAt: string | null = null;
  let afterDeliveryId: string | null = null;

  for (;;) {
    const page = await listOpenMemberNotificationEmailDigestBucketDeliveriesPage({
      digestBucketKey: input.digestBucketKey,
      activationAt: input.activationAt,
      limit: MEMBER_NOTIFICATION_EMAIL_DIGEST_CHILD_PAGE_SIZE,
      afterCreatedAt,
      afterDeliveryId,
    });
    if (page.length === 0) {
      break;
    }
    all.push(...page);
    if (all.length > MEMBER_NOTIFICATION_EMAIL_DIGEST_CHILD_MAX) {
      return null;
    }
    const last = page[page.length - 1]!;
    afterCreatedAt = last.createdAt;
    afterDeliveryId = last.deliveryId;
    if (page.length < MEMBER_NOTIFICATION_EMAIL_DIGEST_CHILD_PAGE_SIZE) {
      break;
    }
  }

  return all;
}

/**
 * Ensure digest-run rows exist for closed UTC buckets with open child intents.
 * Uses period-end filtered distinct-bucket discovery (no open-period starvation).
 * Reopens terminal runs when residual open children remain.
 */
export async function discoverMemberNotificationEmailDigestRuns(input: {
  activationAt: string;
  now?: Date;
  bucketLimit?: number;
}): Promise<number> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const bucketLimit =
    input.bucketLimit ?? MEMBER_NOTIFICATION_EMAIL_DIGEST_BUCKET_DISCOVERY_LIMIT;

  const dueBuckets = await listDueMemberNotificationEmailDigestBuckets({
    activationAt: input.activationAt,
    nowIso,
    limit: bucketLimit,
  });

  let discovered = 0;
  for (const bucket of dueBuckets) {
    const parsed = parseMemberNotificationDigestBucketKey(bucket.digestBucketKey);
    if (!parsed || parsed.channel !== bucket.channel) {
      continue;
    }

    const { record, inserted } = await ensureMemberNotificationEmailDigestRun({
      digestId: bucket.digestBucketKey,
      recipientUserId: bucket.recipientUserId,
      recipientMemberId: bucket.recipientMemberId,
      channel: bucket.channel,
      periodKey: parsed.periodKey,
      status: "pending",
      attemptCount: 0,
      maxAttempts: MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS,
      nextAttemptAt: nowIso,
      leaseOwner: null,
      leaseExpiresAt: null,
      destinationHash: null,
      providerEmailId: null,
      skipReason: null,
      lastErrorCode: null,
      includedDeliveryIds: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    if (inserted) {
      discovered += 1;
      continue;
    }

    const terminal =
      record.status === "dry_run_ok" ||
      record.status === "sent" ||
      record.status === "cancelled" ||
      record.status === "skipped" ||
      (record.status === "failed" &&
        (record.nextAttemptAt === null || record.attemptCount >= record.maxAttempts));

    if (terminal) {
      const reopened = await reopenMemberNotificationEmailDigestRunForResiduals(
        bucket.digestBucketKey,
      );
      if (reopened && reopened.status === "pending") {
        discovered += 1;
      }
    }
  }
  return discovered;
}

export async function processMemberNotificationEmailDigestClaim(
  run: MemberNotificationEmailDigestRunRecord,
  leaseOwner: string,
  options: { activationAt: string },
): Promise<
  | "dry_run_ok"
  | "cancelled"
  | "failed"
  | "live_blocked"
  | "empty"
  | "stale_lease"
> {
  const mode = resolveMemberNotificationEmailDeliveryMode();
  const parsed = parseMemberNotificationDigestBucketKey(run.digestId);
  if (!parsed || parsed.channel !== run.channel) {
    const ok = await finalizeDigestRun(run, leaseOwner, {
      status: "cancelled",
      skipReason: "frequency_mismatch",
      nextAttemptAt: null,
      lastErrorCode: "invalid_digest_id",
    });
    return ok ? "cancelled" : "stale_lease";
  }

  const openChildrenOrOverflow =
    await loadAllOpenMemberNotificationEmailDigestBucketDeliveries({
      digestBucketKey: run.digestId,
      activationAt: options.activationAt,
    });

  if (openChildrenOrOverflow === null) {
    const backoffMs = resolveMemberNotificationEmailDeliveryBackoffMs(run.attemptCount);
    const terminal = run.attemptCount >= run.maxAttempts;
    const ok = await finalizeDigestRun(run, leaseOwner, {
      status: "failed",
      lastErrorCode: "digest_child_overflow",
      nextAttemptAt: terminal
        ? null
        : new Date(Date.now() + backoffMs).toISOString(),
      providerEmailId: null,
      skipReason: null,
    });
    return ok ? "failed" : "stale_lease";
  }

  // Reclaim after partial child close: no open children → finalize without adapter/resend.
  if (openChildrenOrOverflow.length === 0) {
    const status = mode === "dry_run" ? "dry_run_ok" : "cancelled";
    const skipReason = mode === "dry_run" ? "dry_run" : "empty_digest";
    const ok = await finalizeDigestRun(run, leaseOwner, {
      status,
      skipReason,
      nextAttemptAt: null,
      lastErrorCode: null,
      providerEmailId: null,
      includedDeliveryIds: run.includedDeliveryIds ?? [],
    });
    if (!ok) {
      return "stale_lease";
    }
    return mode === "dry_run" ? "dry_run_ok" : "empty";
  }

  const recipient = await evaluateMemberNotificationEmailDigestRecipientEligibility(run);
  if (!recipient.eligible) {
    await closeChildDeliveries(openChildrenOrOverflow, {
      status: recipient.terminalStatus,
      skipReason: recipient.skipReason,
      nextAttemptAt: null,
      lastErrorCode: recipient.skipReason,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
    const ok = await finalizeDigestRun(run, leaseOwner, {
      status: recipient.terminalStatus,
      skipReason: recipient.skipReason,
      nextAttemptAt: null,
      lastErrorCode: recipient.skipReason,
      includedDeliveryIds: openChildrenOrOverflow.map((row) => row.deliveryId),
    });
    return ok ? "cancelled" : "stale_lease";
  }

  const eligible: MemberNotificationEmailDeliveryRecord[] = [];
  const ineligible: Array<{
    record: MemberNotificationEmailDeliveryRecord;
    skipReason: NonNullable<MemberNotificationEmailDeliveryRecord["skipReason"]>;
    terminalStatus: "cancelled" | "skipped";
  }> = [];

  for (const child of openChildrenOrOverflow) {
    const childResult = evaluateMemberNotificationEmailDigestChildEligibility(
      child,
      recipient.preferences,
    );
    if (childResult.eligible) {
      eligible.push(child);
    } else {
      ineligible.push({
        record: child,
        skipReason: childResult.skipReason,
        terminalStatus: childResult.terminalStatus,
      });
    }
  }

  for (const entry of ineligible) {
    await updateMemberNotificationEmailDelivery(entry.record.deliveryId, {
      status: entry.terminalStatus,
      skipReason: entry.skipReason,
      nextAttemptAt: null,
      lastErrorCode: entry.skipReason,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
  }

  if (eligible.length === 0) {
    const ok = await finalizeDigestRun(run, leaseOwner, {
      status: "cancelled",
      skipReason: "empty_digest",
      nextAttemptAt: null,
      lastErrorCode: "empty_digest",
      destinationHash: recipient.destinationHash,
      destinationModeSnapshot: recipient.destinationModeSnapshot,
      includedDeliveryIds: ineligible.map((entry) => entry.record.deliveryId),
    });
    return ok ? "empty" : "stale_lease";
  }

  try {
    const adapterResult = await executeMemberNotificationEmailDigestAdapter({
      digestId: run.digestId,
      frequency: parsed.frequency,
      destinationHash: recipient.destinationHash,
      mode,
      recipientMemberId: run.recipientMemberId,
      eligibleRecords: eligible,
    });

    if (adapterResult.outcome === "dry_run_validated") {
      // Close children first so a failed digest finalize cannot leave a sendable
      // digest that would resend after reclaim; reclaim with zero open children
      // finalizes dry_run_ok without invoking the adapter again.
      await closeChildDeliveries(eligible, {
        status: "dry_run_ok",
        skipReason: "dry_run",
        providerEmailId: null,
        nextAttemptAt: null,
        lastErrorCode: null,
        destinationHash: recipient.destinationHash,
        destinationModeSnapshot: recipient.destinationModeSnapshot,
        leaseOwner: null,
        leaseExpiresAt: null,
      });
      const ok = await finalizeDigestRun(run, leaseOwner, {
        status: "dry_run_ok",
        skipReason: "dry_run",
        providerEmailId: null,
        nextAttemptAt: null,
        lastErrorCode: null,
        destinationHash: recipient.destinationHash,
        destinationModeSnapshot: recipient.destinationModeSnapshot,
        includedDeliveryIds: eligible.map((row) => row.deliveryId),
      });
      return ok ? "dry_run_ok" : "stale_lease";
    }

    if (adapterResult.outcome === "template_failed") {
      const terminal =
        adapterResult.errorCode === "empty_digest" ||
        run.attemptCount >= run.maxAttempts;
      const backoffMs = resolveMemberNotificationEmailDeliveryBackoffMs(run.attemptCount);
      const ok = await finalizeDigestRun(run, leaseOwner, {
        status: "failed",
        lastErrorCode: adapterResult.errorCode,
        nextAttemptAt: terminal
          ? null
          : new Date(Date.now() + backoffMs).toISOString(),
        providerEmailId: null,
        skipReason: adapterResult.errorCode === "empty_digest" ? "empty_digest" : null,
      });
      return ok ? "failed" : "stale_lease";
    }

    if (adapterResult.outcome === "live_not_ready") {
      await closeChildDeliveries(eligible, {
        status: "cancelled",
        skipReason: "live_not_ready",
        providerEmailId: null,
        nextAttemptAt: null,
        lastErrorCode: "live_not_ready",
        leaseOwner: null,
        leaseExpiresAt: null,
      });
      const ok = await finalizeDigestRun(run, leaseOwner, {
        status: "cancelled",
        skipReason: "live_not_ready",
        providerEmailId: null,
        nextAttemptAt: null,
        lastErrorCode: "live_not_ready",
        destinationHash: recipient.destinationHash,
        destinationModeSnapshot: recipient.destinationModeSnapshot,
        includedDeliveryIds: eligible.map((row) => row.deliveryId),
      });
      return ok ? "live_blocked" : "stale_lease";
    }

    const ok = await finalizeDigestRun(run, leaseOwner, {
      status: "cancelled",
      skipReason: "flag_off",
      nextAttemptAt: null,
      lastErrorCode: adapterResult.errorCode,
    });
    return ok ? "cancelled" : "stale_lease";
  } catch {
    const attemptCount = run.attemptCount;
    const terminal = attemptCount >= run.maxAttempts;
    const backoffMs = resolveMemberNotificationEmailDeliveryBackoffMs(attemptCount);
    const nextAttemptAt = terminal
      ? null
      : new Date(Date.now() + backoffMs).toISOString();
    const ok = await finalizeDigestRun(run, leaseOwner, {
      status: "failed",
      lastErrorCode: terminal ? "max_attempts" : "processing_error",
      nextAttemptAt,
      providerEmailId: null,
      skipReason: null,
    });
    return ok ? "failed" : "stale_lease";
  }
}

export async function runMemberNotificationEmailDigestWorkerTick(
  options: { batchSize?: number; now?: Date } = {},
): Promise<MemberNotificationEmailDigestWorkerTickResult> {
  const result: MemberNotificationEmailDigestWorkerTickResult = {
    discovered: 0,
    processed: 0,
    dryRunOk: 0,
    cancelled: 0,
    failed: 0,
    liveBlocked: 0,
    empty: 0,
    staleLease: 0,
  };

  if (!isMemberNotificationEmailDeliveryWorkerPermitted()) {
    return result;
  }

  const activationAt = resolveMemberNotificationEmailDeliveryActivationAt();
  if (!activationAt) {
    return result;
  }

  result.discovered = await discoverMemberNotificationEmailDigestRuns({
    activationAt,
    now: options.now,
  });

  const batchSize = options.batchSize ?? MEMBER_NOTIFICATION_EMAIL_DIGEST_BATCH_SIZE;
  const leaseOwner = createLeaseOwner();

  for (let index = 0; index < batchSize; index += 1) {
    const leaseExpiresAt = new Date(
      Date.now() + MEMBER_NOTIFICATION_EMAIL_DELIVERY_LEASE_MS,
    ).toISOString();

    const claimed = await claimNextMemberNotificationEmailDigestRun({
      leaseOwner,
      leaseExpiresAt,
    });
    if (!claimed) {
      break;
    }

    result.processed += 1;
    const outcome = await processMemberNotificationEmailDigestClaim(claimed, leaseOwner, {
      activationAt,
    });
    if (outcome === "dry_run_ok") {
      result.dryRunOk += 1;
    } else if (outcome === "cancelled") {
      result.cancelled += 1;
    } else if (outcome === "failed") {
      result.failed += 1;
    } else if (outcome === "live_blocked") {
      result.liveBlocked += 1;
    } else if (outcome === "empty") {
      result.empty += 1;
    } else {
      result.staleLease += 1;
    }
  }

  return result;
}
