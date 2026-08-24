/**
 * Pack 16C — social distribution provider/outbox boundary.
 *
 * Never claims external delivery. Never stores Facebook/X/LinkedIn credentials.
 * Publication must succeed even when this enqueue fails.
 */
import type { BlogPost } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../infrastructure/events/event-envelope.js";
import { enqueueDomainEvent } from "../../infrastructure/outbox/outbox.repository.js";

export async function enqueueBlogSocialDistributionBestEffort(input: {
  post: BlogPost;
  actorParticipantId: string;
}): Promise<{ enqueued: boolean; reason: string }> {
  const distribution = input.post.optimization?.distribution;
  const huSocialShare = distribution?.huSocialShare ?? "unset";
  const authorExternalAccounts = (distribution?.authorExternalAccounts ?? []).map((account) => ({
    provider: account.provider,
    enabled: account.enabled === true,
    // Honesty: foundation has no OAuth — never report connected/delivered.
    connectionStatus: "not_connected" as const,
  }));

  const authorExternalOptIn = authorExternalAccounts.filter((account) => account.enabled);
  const shouldEnqueueHu = huSocialShare === "opt_in";
  const shouldEnqueueAuthorExternal = authorExternalOptIn.length > 0;

  if (!shouldEnqueueHu && !shouldEnqueueAuthorExternal) {
    return { enqueued: false, reason: "no_distribution_preference" };
  }

  try {
    await enqueueDomainEvent(
      createDomainEvent({
        eventName: CATALOGUE_EVENTS.blogPostSocialDistributionRequested,
        aggregateType: "BlogPost",
        aggregateId: input.post.postId,
        actorId: input.actorParticipantId,
        payload: {
          postId: input.post.postId,
          slug: input.post.slug,
          publishedVersion: input.post.publishedVersion,
          huSocialShare,
          /** Intent only — consumers must not treat this as a successful share. */
          huDistributionStatus: shouldEnqueueHu ? "queued" : "skipped",
          authorExternalAccounts: authorExternalOptIn,
          authorExternalDistributionStatus: shouldEnqueueAuthorExternal
            ? "awaiting_provider"
            : "skipped",
          note: "Pack 16C foundation — no external credentials; delivery requires a real provider.",
        },
      }),
    );
    return { enqueued: true, reason: "queued" };
  } catch {
    /* never block publish/save */
    return { enqueued: false, reason: "outbox_enqueue_failed" };
  }
}
