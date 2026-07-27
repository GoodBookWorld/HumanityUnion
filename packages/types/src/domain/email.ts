/** Transactional email templates supported in Phase 1. */
export type EmailTemplateId =
  | "registration_verification"
  | "registration_confirmation_code"
  | "registration_welcome"
  | "login_two_step_code"
  | "password_reset"
  | "login_notification"
  | "email_change_verification"
  | "security_alert"
  | "member_badge_contribution_confirmed";

export type EmailDeliveryStatus = "queued" | "sent" | "failed";

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
}
