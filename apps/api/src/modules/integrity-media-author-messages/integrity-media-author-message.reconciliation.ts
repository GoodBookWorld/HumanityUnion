import {
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_BACKOFF_MS,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_LIMIT,
} from "./integrity-media-author-message.constants.js";
import { performRemoteDelivery } from "./integrity-media-author-message.service.js";
import { getIntegrityMediaAuthorMessageStore } from "./integrity-media-author-message.store.js";

export interface IntegrityMediaAuthorMessageReconciliationResult {
  readonly examined: number;
  readonly delivered: number;
  readonly pending: number;
  readonly failed: number;
}

/**
 * One bounded pass over durable pending deliveries.
 * Claiming a row moves its next attempt forward so overlapping passes do not both send it.
 */
export async function reconcilePendingIntegrityMediaAuthorMessages(input: {
  now?: Date;
  limit?: number;
} = {}): Promise<IntegrityMediaAuthorMessageReconciliationResult> {
  const now = input.now ?? new Date();
  const limit = Math.max(
    0,
    Math.min(input.limit ?? INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_LIMIT, 20),
  );
  const store = getIntegrityMediaAuthorMessageStore();
  const nowIso = now.toISOString();
  const backoffIso = new Date(
    now.getTime() + INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_BACKOFF_MS,
  ).toISOString();
  let examined = 0;
  let delivered = 0;
  let pending = 0;
  let failed = 0;

  for (let index = 0; index < limit; index += 1) {
    const claimed = await store.claimNext({ nowIso, backoffIso });

    if (!claimed) {
      break;
    }

    examined += 1;

    try {
      await performRemoteDelivery(claimed, now);
    } catch {
      // The claimed row stays pending until a later pass.
    }

    const current = await store.findByMessageId(claimed.messageId);

    if (current?.status === "delivered") {
      delivered += 1;
    } else if (current?.status === "failed") {
      failed += 1;
    } else {
      pending += 1;
    }
  }

  return { examined, delivered, pending, failed };
}
