/** HU-NOTIF-02C.1 — ledger index names and defaults. */

export const MEMBER_NOTIFICATION_EMAIL_DELIVERY_MAX_ATTEMPTS = 5;

export const MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEX_NAMES = {
  deliveryIdUnique: "member_notification_email_deliveries_delivery_id_unique",
  notificationChannelUnique:
    "member_notification_email_deliveries_notification_channel_unique",
  workerDue: "member_notification_email_deliveries_worker_due",
  recipientCreated: "member_notification_email_deliveries_recipient_created",
} as const;

export const MEMBER_NOTIFICATION_EMAIL_DELIVERY_REQUIRED_INDEX_NAMES = [
  MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEX_NAMES.deliveryIdUnique,
  MEMBER_NOTIFICATION_EMAIL_DELIVERY_INDEX_NAMES.notificationChannelUnique,
] as const;
