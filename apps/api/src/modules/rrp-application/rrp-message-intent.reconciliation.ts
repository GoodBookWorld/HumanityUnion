/**
 * HU-RRP-03E — bounded reconcile of pending RRP message intents.
 * Uses atomic claim/lease so multiple API instances cannot double-process.
 */

import { claimNextRrpMessageIntent } from "./rrp-appointment-message-intent.repository.js";
import { RRP_MESSAGE_INTENT_RECONCILE_LIMIT } from "./rrp-message-intent.constants.js";
import {
  deliverRrpMessageIntentBestEffort,
  isTerminalRrpDeliveryWarning,
} from "./rrp-message-intent.delivery.js";
import { isRrpApplicationWritesEnabled } from "./rrp-application-writes.activation.js";

export interface RrpMessageIntentReconcileSummary {
  readonly scanned: number;
  readonly delivered: number;
  readonly stillPending: number;
  readonly failed: number;
}

export async function reconcilePendingRrpMessageIntents(input?: {
  limit?: number;
  now?: Date;
  claimOwnerId?: string;
}): Promise<RrpMessageIntentReconcileSummary> {
  // HU-RRP-03L.2 — do not claim/lease intents while writes are OFF.
  if (!isRrpApplicationWritesEnabled()) {
    return { scanned: 0, delivered: 0, stillPending: 0, failed: 0 };
  }

  const limit = input?.limit ?? RRP_MESSAGE_INTENT_RECONCILE_LIMIT;
  let scanned = 0;
  let delivered = 0;
  let stillPending = 0;
  let failed = 0;

  for (let i = 0; i < limit; i += 1) {
    const claimed = await claimNextRrpMessageIntent({
      now: input?.now,
      claimOwnerId: input?.claimOwnerId,
    });
    if (!claimed) {
      break;
    }
    scanned += 1;

    const warning = await deliverRrpMessageIntentBestEffort(claimed);
    if (!warning) {
      delivered += 1;
      continue;
    }
    if (isTerminalRrpDeliveryWarning(warning)) {
      failed += 1;
    } else {
      stillPending += 1;
    }
  }

  if (scanned > 0) {
    console.info(
      JSON.stringify({
        event: "rrp_message_intent_reconcile",
        scanned,
        delivered,
        stillPending,
        failed,
      }),
    );
  }

  return {
    scanned,
    delivered,
    stillPending,
    failed,
  };
}
