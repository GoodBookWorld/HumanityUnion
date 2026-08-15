import { resolveEmailConfig } from "../email.config.js";
import {
  assertRecipientAllowedForExternalDelivery,
  recipientDomainForLogs,
  TestRecipientBlockedError,
} from "../email-safety-guards.js";
import type {
  EmailProvider,
  EmailProviderHealthResult,
  EmailSendRequest,
  EmailSendResult,
} from "../email.types.js";

interface ResendSendResponse {
  id?: string;
}

export class ResendEmailProvider implements EmailProvider {
  readonly providerId = "resend" as const;

  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    const started = Date.now();

    try {
      assertRecipientAllowedForExternalDelivery(request.to, this.providerId);
    } catch (error) {
      if (error instanceof TestRecipientBlockedError) {
        console.warn(
          `[email:resend] test-recipient-blocked | template=${request.template} domain=${recipientDomainForLogs(request.to)}`,
        );
        return {
          status: "blocked",
          attemptCount: 0,
          provider: "resend",
          durationMs: Date.now() - started,
          failureCategory: "test_recipient_blocked",
        };
      }
      throw error;
    }

    const config = resolveEmailConfig();

    if (!config.resendApiKey) {
      return {
        status: "failed",
        attemptCount: 1,
        provider: "resend",
        durationMs: Date.now() - started,
        failureCategory: "not_configured",
      };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${config.fromName} <${config.fromAddress}>`,
        to: [request.to],
        reply_to: request.replyTo ?? config.replyTo,
        subject: request.subject,
        html: request.html,
        text: request.text,
      }),
    });

    if (!response.ok) {
      return {
        status: "failed",
        attemptCount: 1,
        provider: "resend",
        durationMs: Date.now() - started,
        failureCategory: `http_${response.status}`,
      };
    }

    const body = (await response.json()) as ResendSendResponse;

    return {
      status: "sent",
      providerMessageId: body.id,
      attemptCount: 1,
      provider: "resend",
      durationMs: Date.now() - started,
    };
  }

  async verifyConfiguration(): Promise<EmailProviderHealthResult> {
    const config = resolveEmailConfig();

    if (!config.resendApiKey || !config.fromAddress) {
      return {
        healthy: false,
        configured: false,
        message: "Resend provider requires RESEND_API_KEY and SMTP_FROM/EMAIL_FROM.",
      };
    }

    return {
      healthy: true,
      configured: true,
      message: "Resend provider credentials present.",
    };
  }

  async health(): Promise<EmailProviderHealthResult> {
    return this.verifyConfiguration();
  }
}
