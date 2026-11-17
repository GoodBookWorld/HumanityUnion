/**
 * HU-NOTIF-02C.1 — notification persistence + optional ledger intent.
 *
 * Atomicity:
 * - When Mongo transactions are available and the delivery flag is ON, insert
 *   member_notifications + ledger row in one transaction (atomic).
 * - MongoTransactionUnavailableError → sequential fallback (no prior insert).
 * - Other transaction errors: if the notification row is already visible, do NOT
 *   insert again; only best-effort enqueue. If absent (rolled back), sequential insert.
 *
 * Sequential fallback crash window (explicit, not exactly-once):
 *   1) notification insert succeeds
 *   2) process crash BEFORE gap registration and BEFORE successful enqueue
 *   → notification exists with no ledger row and no gap record.
 *   Bounded recovery (activation boundary + re-enqueue through live gates) can
 *   repair only when an operator/process later discovers the missing intent.
 *   This phase does NOT claim guaranteed recovery of every crash, nor exactly-once
 *   SMTP delivery (no SMTP here).
 */

import type { MemberNotification } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import {
  MongoTransactionUnavailableError,
  runMongoTransaction,
} from "../../../infrastructure/mongodb/mongo-transaction.js";
import { isMemberNotificationEmailDeliveryEnabled } from "./feature-flag.js";
import { enqueueMemberNotificationEmailDelivery } from "./member-notification-email-delivery.enqueue.js";
import { recordMemberNotificationEmailDeliveryGap } from "./member-notification-email-delivery.repository.js";

export interface PersistNotificationWithEmailIntentResult {
  notification: MemberNotification;
  /** True only when notification + intent were committed in one Mongo transaction. */
  emailIntentAtomic: boolean;
}

type RunTransaction = typeof runMongoTransaction;

let runMongoTransactionOverrideForTests: RunTransaction | null = null;

export function setRunMongoTransactionForEmailIntentTests(
  override: RunTransaction | null,
): void {
  runMongoTransactionOverrideForTests = override;
}

async function enqueueAfterNotification(
  notification: MemberNotification,
  options: { skipMongoIndexCheck?: boolean },
): Promise<void> {
  try {
    await enqueueMemberNotificationEmailDelivery(notification, {
      recipientMemberId: notification.recipientProfileId,
      skipMongoIndexCheck: options.skipMongoIndexCheck,
    });
  } catch (error) {
    await recordMemberNotificationEmailDeliveryGap({
      notificationId: notification.notificationId,
      recipientUserId: notification.recipientUserId,
      eventType: notification.eventType,
      reason: error instanceof Error ? error.message : "enqueue_failed_after_notification",
    });
  }
}

export async function persistNotificationWithOptionalEmailIntent(input: {
  notification: MemberNotification;
  insertNotification: (notification: MemberNotification) => Promise<void>;
  findNotificationById?: (notificationId: string) => Promise<MemberNotification | null>;
  persistenceMode: "memory" | "mongodb";
  skipMongoIndexCheck?: boolean;
}): Promise<PersistNotificationWithEmailIntentResult> {
  const { notification } = input;

  if (!isMemberNotificationEmailDeliveryEnabled()) {
    await input.insertNotification(notification);
    return { notification, emailIntentAtomic: false };
  }

  const runTxn = runMongoTransactionOverrideForTests ?? runMongoTransaction;
  const canAttemptTransaction =
    input.persistenceMode === "mongodb" &&
    (Boolean(runMongoTransactionOverrideForTests) || isMongoConfigured());

  if (canAttemptTransaction) {
    try {
      await runTxn(async (session) => {
        const collection = getMongoCollection(MONGO_COLLECTIONS.memberNotifications);
        await collection.insertOne(notification, { session });
        await enqueueMemberNotificationEmailDelivery(notification, {
          session,
          recipientMemberId: notification.recipientProfileId,
          skipMongoIndexCheck: input.skipMongoIndexCheck,
        });
      });
      return { notification, emailIntentAtomic: true };
    } catch (error) {
      if (error instanceof MongoTransactionUnavailableError) {
        // No writes from the transaction path — safe sequential fallback.
      } else {
        // Possible post-commit failure or aborted transaction. Avoid duplicate inserts.
        const existing = input.findNotificationById
          ? await input.findNotificationById(notification.notificationId)
          : null;
        if (existing) {
          await enqueueAfterNotification(existing, {
            skipMongoIndexCheck: input.skipMongoIndexCheck,
          });
          return { notification: existing, emailIntentAtomic: false };
        }
        // Rolled back or not visible — continue to sequential insert below.
      }
    }
  }

  await input.insertNotification(notification);

  // Crash window starts here: notification durable, intent/gap not yet written.
  await enqueueAfterNotification(notification, {
    skipMongoIndexCheck: input.skipMongoIndexCheck ?? input.persistenceMode === "memory",
  });
  return { notification, emailIntentAtomic: false };
}
