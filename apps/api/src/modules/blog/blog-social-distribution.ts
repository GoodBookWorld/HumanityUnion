/**
 * Pack 16C / 17D — social distribution provider/outbox boundary.
 *
 * Never claims external delivery. Never stores Facebook/X/LinkedIn/Instagram credentials.
 * Pack 17D resolves official destinations from Pack 17C Platform Social Accounts.
 * A configured profile URL is not sufficient to auto-post — status stays awaiting_provider.
 * Publication must succeed even when this enqueue fails.
 */
import type { BlogPost, PlatformSocialNetworkId } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../infrastructure/events/event-envelope.js";
import { enqueueDomainEvent } from "../../infrastructure/outbox/outbox.repository.js";
import { listPublicPlatformSocialAccounts } from "../platform-social-accounts/index.js";
import { getBlogSocialExternalProviderReadiness } from "./blog-social-distribution-provider.js";

export type BlogSocialDistributionDeliveryStatus =
  | "queued"
  | "awaiting_provider"
  | "skipped"
  | "blocked_not_published";

export interface ResolvedHuPlatformDistributionDestination {
  readonly networkId: PlatformSocialNetworkId;
  readonly label: string;
  /** Public profile/page URL from Pack 17C — not a credential. */
  readonly destinationUrl: string;
  readonly providerReadiness: "not_connected" | "ready" | "error";
  readonly deliveryStatus: BlogSocialDistributionDeliveryStatus;
}

export async function resolveHuPlatformDistributionDestinations(
  post: BlogPost,
): Promise<readonly ResolvedHuPlatformDistributionDestination[]> {
  const channels = post.optimization?.distribution?.huPlatformChannels ?? [];
  const permitted = channels.filter((channel) => channel.permitted);
  if (permitted.length === 0) {
    return [];
  }

  const publicAccounts = await listPublicPlatformSocialAccounts();
  const byNetwork = new Map(
    publicAccounts.accounts.map((account) => [account.networkId, account] as const),
  );

  const resolved: ResolvedHuPlatformDistributionDestination[] = [];
  for (const channel of permitted) {
    const account = byNetwork.get(channel.networkId);
    if (!account) {
      continue;
    }
    const providerReadiness = getBlogSocialExternalProviderReadiness(channel.networkId);
    resolved.push({
      networkId: channel.networkId,
      label: account.label,
      destinationUrl: account.url,
      providerReadiness,
      deliveryStatus:
        providerReadiness === "ready" ? "queued" : "awaiting_provider",
    });
  }
  return resolved;
}

export async function enqueueBlogSocialDistributionBestEffort(input: {
  post: BlogPost;
  actorParticipantId: string;
}): Promise<{ enqueued: boolean; reason: string }> {
  // Lifecycle authority: never distribute for draft/review/scheduled/blocked/archived.
  if (input.post.status !== "published") {
    return { enqueued: false, reason: "blocked_not_published" };
  }
  if (input.post.administrativelyBlocked === true) {
    return { enqueued: false, reason: "administratively_blocked" };
  }

  const distribution = input.post.optimization?.distribution;
  const huSocialShare = distribution?.huSocialShare ?? "unset";
  const resolvedDestinations = await resolveHuPlatformDistributionDestinations(input.post);

  // Legacy Pack 16C generic opt-in without per-channel rows still queues HU intent.
  const legacyHuOptIn = huSocialShare === "opt_in" && resolvedDestinations.length === 0;
  const shouldEnqueue =
    resolvedDestinations.length > 0 || legacyHuOptIn;

  if (!shouldEnqueue) {
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
          huDistributionStatus:
            resolvedDestinations.length > 0
              ? resolvedDestinations.every((row) => row.deliveryStatus === "queued")
                ? "queued"
                : "awaiting_provider"
              : legacyHuOptIn
                ? "queued"
                : "skipped",
          huPlatformDestinations: resolvedDestinations.map((row) => ({
            networkId: row.networkId,
            label: row.label,
            destinationUrl: row.destinationUrl,
            providerReadiness: row.providerReadiness,
            deliveryStatus: row.deliveryStatus,
          })),
          /**
           * Pack 17D — personal authorExternalAccounts are no longer operational.
           * Kept empty so consumers cannot invent personal-account delivery.
           */
          authorExternalAccounts: [],
          authorExternalDistributionStatus: "skipped",
          note:
            "Pack 17D — official channel destinations resolved from Platform Social Accounts; external API provider not connected; not a delivery confirmation.",
        },
      }),
    );
    return { enqueued: true, reason: "queued" };
  } catch {
    /* never block publish/save */
    return { enqueued: false, reason: "outbox_enqueue_failed" };
  }
}
