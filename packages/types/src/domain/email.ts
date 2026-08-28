/** Transactional email templates supported by the canonical MailDeliveryService. */
export type EmailTemplateId =
  | "registration_verification"
  | "registration_confirmation_code"
  | "registration_welcome"
  | "login_two_step_code"
  | "password_reset"
  | "login_notification"
  | "email_change_verification"
  | "security_alert"
  | "member_badge_contribution_confirmed"
  | "member_badge_application_label"
  /** Workspace notification digest / summary — never embeds private message bodies. */
  | "workspace_notification_summary"
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
  | "participant_restored";

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
