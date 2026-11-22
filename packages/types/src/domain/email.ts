/** Transactional email templates supported by the canonical MailDeliveryService. */
export type EmailTemplateId =
  | "registration_verification"
  | "registration_confirmation_code"
  /** HU-NOTIF-02B — ownership proof for alternative notification email (not auth email change). */
  | "notification_alternative_email_code"
  | "registration_welcome"
  | "login_two_step_code"
  /** Code that proves ownership before an Integrity Media author is linked to an existing account. */
  | "integrity_media_account_link_code"
  | "password_reset"
  | "login_notification"
  | "email_change_verification"
  | "security_alert"
  | "member_badge_contribution_confirmed"
  | "member_badge_application_label"
  /** Workspace notification digest / summary — never embeds private message bodies. */
  | "workspace_notification_summary"
  /**
   * HU-NOTIF-02C.3 — privacy-safe localized copy for a single allowlisted
   * member_notification event. Never embeds raw notification title/body.
   */
  | "member_notification_copy"
  /**
   * HU-NOTIF-02C.4 — privacy-safe localized daily/weekly digest.
   * Category counts only — never raw notification bodies or private metadata.
   */
  | "member_notification_digest"
  /** Blog Author Access Pack 04 status updates (approved / changes / declined). */
  | "blog_author_application_status"
  /** Editorial Review Pack 06 — publication review/publish status summary. */
  | "blog_publication_status"
  /** Direct message alert — link only; never includes message content. */
  | "workspace_message_alert"
  /** Pack 21A — confirm Blog publication email subscription (opt-in). */
  | "blog_subscription_confirm"
  /** Pack 21B — welcome email after confirmed Blog subscription. */
  | "blog_subscription_welcome"
  /** Pack 21D — new Blog publication notice for confirmed subscribers. */
  | "blog_publication_digest"
  /** Pack 21E — Admin message to selected Blog subscribers. */
  | "blog_subscription_admin_message"
  /** Pack 24B — Participant account suspension notice with review CTA. */
  | "participant_suspended"
  /** Pack 24B — optional notice that participation was restored. */
  | "participant_restored"
  /** HU-ACCOUNT-DELETE-01B — single-use code before the recovery window starts. */
  | "account_deletion_code"
  /** HU-ACCOUNT-DELETE-01B — window started. No secret token. */
  | "account_deletion_scheduled"
  /** HU-ACCOUNT-DELETE-01B — pending deletion was cancelled. */
  | "account_deletion_cancelled"
  /** HU-ACCOUNT-DELETE-01B — best-effort notice sent before the login email is released. */
  | "account_deletion_finalized"
  /** HU-ACCOUNT-DELETE-01C — one reminder in the last three days. Link only, no restore token. */
  | "account_deletion_reminder";

export type EmailDeliveryStatus = "queued" | "sent" | "failed" | "deferred" | "blocked";

export type EmailVerificationTokenPurpose = "registration" | "password_reset" | "email_change";

export type EmailVerificationStatus = "pending" | "verified";

/** Safe audit projection — no raw tokens or full email bodies. */
export interface EmailAuditRecordPublic {
  emailId: string;
  template: EmailTemplateId;
  provider: string;
  recipientHash: string;
  status: EmailDeliveryStatus;
  createdAt: string;
  sentAt?: string;
  errorSummary?: string;
}

export interface EmailProviderHealth {
  provider: string;
  healthy: boolean;
  configured: boolean;
  message: string;
  /** ISO timestamp of last successful delivery/verify when known (admin diagnostics). */
  lastSuccessAt?: string;
  /** Stable failure category — never includes SMTP secrets or raw auth payloads. */
  lastFailureCategory?: string;
}
