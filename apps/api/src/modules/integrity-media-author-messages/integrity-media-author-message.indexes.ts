import type { IndexDescription } from "mongodb";

export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_INDEXES: IndexDescription[] = [
  {
    key: { messageId: 1 },
    unique: true,
    name: "integrity_media_author_messages_message_id_unique",
  },
  {
    key: { status: 1, nextAttemptAt: 1, createdAt: 1 },
    name: "integrity_media_author_messages_pending_claim",
  },
  {
    key: { recipientMemberId: 1, createdAt: -1 },
    name: "integrity_media_author_messages_recipient_created",
  },
];

export const INTEGRITY_MEDIA_AUTHOR_MESSAGE_AUDIT_INDEXES: IndexDescription[] = [
  {
    key: { messageId: 1, createdAt: 1 },
    name: "integrity_media_author_message_audit_message_created",
  },
  {
    key: { action: 1, createdAt: -1 },
    name: "integrity_media_author_message_audit_action_created",
  },
];
