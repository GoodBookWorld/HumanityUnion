import type { EmailTemplateId } from "@hu/types";

export type EmailProviderMode = "mock" | "smtp" | "resend";

/** Canonical mail delivery outcome (internal — never expose SMTP details to users). */
export type MailDeliveryStatus = "sent" | "failed" | "deferred" | "blocked";

export interface EmailSendRequest {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: EmailTemplateId;
  replyTo?: string;
}

export interface EmailSendResult {
  status: MailDeliveryStatus;
  providerMessageId?: string;
  previewUrl?: string;
  attemptCount: number;
  provider: EmailProviderMode;
  durationMs: number;
  /** Stable internal category for diagnostics/logs — never includes secrets. */
  failureCategory?: string;
}

export interface EmailProviderHealthResult {
  healthy: boolean;
  configured: boolean;
  message: string;
  lastSuccessAt?: string;
  lastFailureCategory?: string;
}

export interface EmailProvider {
  readonly providerId: EmailProviderMode;
  sendEmail(request: EmailSendRequest): Promise<EmailSendResult>;
  verifyConfiguration(): Promise<EmailProviderHealthResult>;
  health(): Promise<EmailProviderHealthResult>;
}
