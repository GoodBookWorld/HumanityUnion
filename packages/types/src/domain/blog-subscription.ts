/**
 * Pack 21A — Blog email subscription domain (Subscriber ≠ Participant ≠ Member).
 * Pack 21B — welcomeSentAt for one-time welcome email per confirmation lifecycle.
 * Pack 21C — Admin subscriber directory DTOs.
 */

export type BlogSubscriptionStatus = "not_confirmed" | "subscribed" | "unsubscribed";

/**
 * Extensible subscription product type. Pack 21A uses blog publications only.
 */
export type BlogSubscriptionType = "blog_publications";

export const BLOG_SUBSCRIPTION_TYPES: readonly BlogSubscriptionType[] = [
  "blog_publications",
] as const;

export type AdminBlogSubscriberStatusFilter = BlogSubscriptionStatus | "all";

export interface BlogSubscriberRecord {
  readonly subscriberId: string;
  /** Canonical unique key (trim + lowercase). */
  readonly emailNormalized: string;
  /** Safe display form for Admin UI (typically original trimmed input). */
  readonly emailDisplay: string;
  /**
   * Pack 21G — optional Admin/import display name (not a Participant account).
   * Separate from participantId linkage.
   */
  readonly displayName?: string;
  readonly status: BlogSubscriptionStatus;
  readonly subscriptionType: BlogSubscriptionType;
  /** Optional link when an Auth user exists for the same email — metadata only. */
  readonly participantId?: string;
  /** Only when legitimately supplied; never inferred from traffic IP geo. */
  readonly countryCode?: string;
  readonly subscribedAt?: string;
  readonly confirmedAt?: string;
  readonly unsubscribedAt?: string;
  /**
   * Count of subscriber-directed subscription/publication/admin messages.
   * Confirmation email does not increment this counter.
   * Pack 21B — Welcome email increments only after successful send.
   */
  readonly emailsSent: number;
  /** Pack 21B — set after successful Welcome email for the current confirmed lifecycle. */
  readonly welcomeSentAt?: string;
  readonly confirmTokenHash?: string;
  readonly confirmTokenExpiresAt?: string;
  readonly unsubscribeTokenHash?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Pack 21B — single platform-level Blog subscription welcome settings. */
export interface BlogSubscriptionSettings {
  readonly welcomeMessage: string;
  readonly updatedAt: string;
  readonly updatedByParticipantId?: string;
}

export interface BlogSubscriptionSettingsResponse {
  readonly welcomeMessage: string;
  readonly isDefault: boolean;
  readonly updatedAt?: string;
  readonly updatedByParticipantId?: string;
}

/** Pack 21C — Admin directory row (no token hashes / secrets). */
export interface AdminBlogSubscriberDirectoryItem {
  readonly subscriberId: string;
  /**
   * Stored subscriber displayName when set (Pack 21G), else linked Participant name.
   */
  readonly displayName?: string;
  readonly email: string;
  readonly subscriptionType: BlogSubscriptionType;
  readonly status: BlogSubscriptionStatus;
  readonly subscribedAt?: string;
  readonly confirmedAt?: string;
  readonly countryCode?: string;
  readonly emailsSent: number;
  readonly hasLinkedParticipant: boolean;
  readonly createdAt: string;
}

/** Pack 21G — Admin manual subscriber import mode. */
export type AdminBlogSubscriberImportMode = "confirmed_existing" | "needs_confirmation";

export interface AdminBlogSubscriberManualAddResponse {
  readonly subscriber: AdminBlogSubscriberDirectoryItem;
  readonly created: boolean;
  readonly reusedExisting: boolean;
  readonly restoredFromUnsubscribed: boolean;
  readonly confirmationEmailQueued: boolean;
  readonly message: string;
}

export interface AdminBlogSubscriberDirectoryResponse {
  readonly subscribers: readonly AdminBlogSubscriberDirectoryItem[];
  readonly total: number;
  readonly subscribedCount: number;
  readonly notConfirmedCount: number;
  readonly unsubscribedCount: number;
  readonly limit: number;
  readonly offset: number;
}

export interface AdminBlogSubscriberRemoveResponse {
  readonly removed: true;
  readonly subscriberId: string;
  readonly status: "unsubscribed";
  readonly alreadyUnsubscribed: boolean;
}

/** Pack 21D — durable (postId, subscriberId) publication delivery ledger. */
export type BlogPublicationDeliveryStatus = "pending" | "sent" | "failed";

export interface BlogPublicationDeliveryRecord {
  readonly deliveryId: string;
  readonly postId: string;
  readonly subscriberId: string;
  readonly status: BlogPublicationDeliveryStatus;
  readonly attemptedAt?: string;
  readonly sentAt?: string;
  readonly failedAt?: string;
  readonly failureCode?: string;
  readonly attemptCount: number;
  /** True after emailsSent was incremented for this delivery (dedupe guard). */
  readonly emailsSentIncremented?: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Pack 21E — Admin intentional selected-subscriber message. */
export interface BlogAdminSubscriberMessageRecord {
  readonly adminMessageId: string;
  readonly subject: string;
  readonly message: string;
  readonly selectedSubscriberIds: readonly string[];
  readonly createdByParticipantId: string;
  readonly createdAt: string;
  readonly ctaLabel?: string;
  readonly ctaUrl?: string;
}

export type BlogAdminSubscriberMessageDeliveryStatus = "pending" | "sent" | "failed";

export interface BlogAdminSubscriberMessageDeliveryRecord {
  readonly deliveryId: string;
  readonly adminMessageId: string;
  readonly subscriberId: string;
  readonly status: BlogAdminSubscriberMessageDeliveryStatus;
  readonly attemptedAt?: string;
  readonly sentAt?: string;
  readonly failedAt?: string;
  readonly failureCode?: string;
  readonly attemptCount: number;
  readonly emailsSentIncremented?: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdminBlogSubscriberMessageQueueResponse {
  readonly queued: true;
  readonly adminMessageId: string;
  readonly selectedRecipientCount: number;
  readonly status: "queued";
  readonly message: string;
}

/** Public subscribe response — intentionally non-revealing. */
export interface PublicBlogSubscribeResponse {
  readonly accepted: true;
  readonly message: string;
}

export interface PublicBlogSubscriptionConfirmResponse {
  readonly confirmed: true;
  readonly message: string;
}

export interface PublicBlogSubscriptionUnsubscribeResponse {
  readonly unsubscribed: true;
  readonly message: string;
}
