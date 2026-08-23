import type {
  MemberNotification,
  MemberNotificationPriority,
  MemberNotificationStatus,
} from "@hu/types";

export type { MemberNotification, MemberNotificationPriority, MemberNotificationStatus };

export interface NotificationListFilter {
  userId: string;
  status?: MemberNotificationStatus | "all";
  limit?: number;
  offset?: number;
}

export interface NotificationPersistenceAdapter {
  readonly mode: "memory" | "mongodb";
  insert(notification: MemberNotification): Promise<void>;
  list(filter: NotificationListFilter): Promise<MemberNotification[]>;
  countByUserId(userId: string, status?: MemberNotificationStatus): Promise<number>;
  findById(notificationId: string): Promise<MemberNotification | null>;
  update(notification: MemberNotification): Promise<void>;
  delete(notificationId: string): Promise<void>;
  deleteArchivedByUserId(userId: string): Promise<number>;
  deleteByRelatedEntity(
    relatedEntityType: MemberNotification["relatedEntityType"],
    relatedEntityId: string,
  ): Promise<number>;
  /**
   * Pack 14A — existence check for idempotent Admin review notification delivery.
   * Key: (recipientUserId, eventType, relatedEntityType, relatedEntityId).
   */
  existsForRecipientEventAndRelatedEntity(input: {
    recipientUserId: string;
    eventType: MemberNotification["eventType"];
    relatedEntityType: MemberNotification["relatedEntityType"];
    relatedEntityId: string;
  }): Promise<boolean>;
  clearForTests?(): void;
}

export const PRIVATE_NOTIFICATION_RESPONSE_KEYS = [
  "recipientUserId",
  "recipientProfileId",
  "participantId",
  "authorId",
  "stewardId",
  "memberId",
  "email",
  "passwordHash",
  "refreshTokenHash",
  "voteId",
  "voteHistory",
  "rawSource",
  "messageHeaders",
  "providerMetadata",
  "jwt",
  "sessionId",
  "userId",
] as const;

export const FORBIDDEN_NOTIFICATION_UX_TERMS = [
  "streak",
  "badge",
  "you missed",
  "engagement",
  "popularity",
  "like",
  "follow",
  "reaction",
] as const;
