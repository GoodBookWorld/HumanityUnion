import type { EmailTemplateId } from "@hu/types";

export type EmailProviderMode = "mock" | "smtp" | "resend";

export interface EmailSendRequest {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: EmailTemplateId;
  replyTo?: string;
}

export interface EmailSendResult {
  providerMessageId?: string;
  previewUrl?: string;
}

export interface EmailProviderHealthResult {
  healthy: boolean;
  configured: boolean;
  message: string;
}

export interface EmailProvider {
  readonly providerId: EmailProviderMode;
  sendEmail(request: EmailSendRequest): Promise<EmailSendResult>;
  verifyConfiguration(): Promise<EmailProviderHealthResult>;
  health(): Promise<EmailProviderHealthResult>;
}
