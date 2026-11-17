/**
 * HU-NOTIF-02C.1 — fail-closed readiness for required ledger unique indexes.
 * Does not block unrelated API operations; callers skip ledger writes when not ready.
 */

import type { IndexDescription } from "mongodb";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import {
  MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEX_NAMES,
  MEMBER_NOTIFICATION_EMAIL_DELIVERY_REQUIRED_INDEX_NAMES,
  MEMBER_NOTIFICATION_EMAIL_DIGEST_RUN_INDEX_NAMES,
  MEMBER_NOTIFICATION_EMAIL_DIGEST_RUN_REQUIRED_INDEX_NAMES,
} from "./member-notification-email-delivery.constants.js";

export const MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEXES: IndexDescription[] = [
  {
    key: { deliveryId: 1 },
    unique: true,
    name: MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEX_NAMES.deliveryIdUnique,
  },
  {
    key: { notificationId: 1, channel: 1 },
    unique: true,
    name: MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEX_NAMES.notificationChannelUnique,
  },
  {
    key: { status: 1, nextAttemptAt: 1, leaseExpiresAt: 1 },
    name: MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEX_NAMES.workerDue,
  },
  {
    key: { recipientUserId: 1, createdAt: -1 },
    name: MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEX_NAMES.recipientCreated,
  },
  {
    // HU-NOTIF-02C.4 — bounded digest bucket scans (channel + status + bucket).
    key: { channel: 1, status: 1, digestBucketKey: 1, createdAt: 1 },
    name: MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEX_NAMES.digestBucket,
  },
  {
    // HU-NOTIF-02C.4 — closed-period discovery (avoids open-period scan starvation).
    key: { channel: 1, status: 1, digestPeriodEndsAt: 1, digestBucketKey: 1 },
    name: MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEX_NAMES.digestPeriodDue,
  },
];

export const MEMBER_NOTIFICATION_EMAIL_DIGEST_RUN_INDEXES: IndexDescription[] = [
  {
    key: { digestId: 1 },
    unique: true,
    name: MEMBER_NOTIFICATION_EMAIL_DIGEST_RUN_INDEX_NAMES.digestIdUnique,
  },
  {
    key: { status: 1, nextAttemptAt: 1, leaseExpiresAt: 1 },
    name: MEMBER_NOTIFICATION_EMAIL_DIGEST_RUN_INDEX_NAMES.workerDue,
  },
  {
    key: { recipientUserId: 1, createdAt: -1 },
    name: MEMBER_NOTIFICATION_EMAIL_DIGEST_RUN_INDEX_NAMES.recipientCreated,
  },
];

let readinessOverrideForTests: boolean | null = null;
let cachedReady = false;

export function setMemberNotificationEmailDeliveryIndexesReadyForTests(
  ready: boolean | null,
): void {
  readinessOverrideForTests = ready;
  if (ready !== true) {
    cachedReady = false;
  }
}

export function resetMemberNotificationEmailDeliveryIndexReadinessForTests(): void {
  readinessOverrideForTests = null;
  cachedReady = false;
}

/**
 * Verify required unique indexes. Memory/test skipMongo paths are ready unless
 * an explicit false override is set.
 */
export async function assertMemberNotificationEmailDeliveryIndexesReady(
  options: { skipMongo?: boolean } = {},
): Promise<boolean> {
  if (readinessOverrideForTests === false) {
    return false;
  }

  if (readinessOverrideForTests === true || cachedReady) {
    return true;
  }

  if (options.skipMongo || !isMongoConfigured()) {
    cachedReady = true;
    return true;
  }

  const collection = getMongoCollection(
    MONGO_COLLECTIONS.memberNotificationEmailDeliveries,
  );

  for (const index of MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEXES) {
    try {
      await collection.createIndex(index.key, {
        unique: index.unique,
        name: index.name,
      });
    } catch (error) {
      const mongoError = error as { code?: number };
      if (mongoError.code !== 85 && mongoError.code !== 86) {
        return false;
      }
    }
  }

  let indexes: Array<{ name?: string; unique?: boolean }>;
  try {
    indexes = await collection.indexes();
  } catch {
    return false;
  }

  for (const requiredName of MEMBER_NOTIFICATION_EMAIL_DELIVERY_REQUIRED_INDEX_NAMES) {
    const found = indexes.find((entry) => entry.name === requiredName);
    if (!found || found.unique !== true) {
      return false;
    }
  }

  const digestCollection = getMongoCollection(
    MONGO_COLLECTIONS.memberNotificationEmailDigestRuns,
  );
  for (const index of MEMBER_NOTIFICATION_EMAIL_DIGEST_RUN_INDEXES) {
    try {
      await digestCollection.createIndex(index.key, {
        unique: index.unique,
        name: index.name,
      });
    } catch (error) {
      const mongoError = error as { code?: number };
      if (mongoError.code !== 85 && mongoError.code !== 86) {
        return false;
      }
    }
  }

  let digestIndexes: Array<{ name?: string; unique?: boolean }>;
  try {
    digestIndexes = await digestCollection.indexes();
  } catch {
    return false;
  }

  for (const requiredName of MEMBER_NOTIFICATION_EMAIL_DIGEST_RUN_REQUIRED_INDEX_NAMES) {
    const found = digestIndexes.find((entry) => entry.name === requiredName);
    if (!found || found.unique !== true) {
      return false;
    }
  }

  cachedReady = true;
  return true;
}
