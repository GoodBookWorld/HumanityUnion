import {
  INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_BACKOFF_MS,
  INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_LIMIT,
  INTEGRITY_MEDIA_SOURCE,
} from "./external-author-link.constants.js";
import { recoverProvenIntegrityMediaAuthorLink } from "./external-author-link.service.js";
import { getExternalAuthorLinkStore } from "./external-author-link.store.js";

export interface IntegrityMediaAuthorActivationReconciliationResult {
  readonly examined: number;
  readonly recovered: number;
  readonly pending: number;
}

/**
 * One bounded pass over durable pending activations.
 * Claims a linked row before recovery so overlapping passes do not both write it.
 */
export async function reconcilePendingIntegrityMediaAuthorActivations(input: {
  now?: Date;
  limit?: number;
} = {}): Promise<IntegrityMediaAuthorActivationReconciliationResult> {
  const now = input.now ?? new Date();
  const limit = Math.max(0, Math.min(input.limit ?? INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_LIMIT, 20));
  const store = getExternalAuthorLinkStore();
  const eligibleBeforeIso = new Date(
    now.getTime() - INTEGRITY_MEDIA_AUTHOR_ACTIVATION_RECONCILE_BACKOFF_MS,
  ).toISOString();
  let examined = 0;
  let recovered = 0;
  let pending = 0;

  for (let index = 0; index < limit; index += 1) {
    const claimed = await store.claimNextPendingAuthorActivation({
      source: INTEGRITY_MEDIA_SOURCE,
      nowIso: now.toISOString(),
      eligibleBeforeIso,
    });

    if (!claimed) {
      break;
    }

    examined += 1;
    const result = await recoverProvenIntegrityMediaAuthorLink({
      externalAuthorId: claimed.externalAuthorId,
      now,
    });

    if (result.ok) {
      recovered += 1;
    } else {
      pending += 1;
    }
  }

  return { examined, recovered, pending };
}
