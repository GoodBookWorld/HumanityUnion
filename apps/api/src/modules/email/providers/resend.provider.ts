import { resolveEmailConfig } from "../email.config.js";
import { assertSafeRecipientForVerificationMode } from "../email-verification-guards.js";
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
    assertSafeRecipientForVerificationMode(request.to, this.providerId);

    const config = resolveEmailConfig();

    if (!config.resendApiKey) {
      throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend.");
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
      throw new Error(`Resend provider request failed with status ${response.status}.`);
    }

    const body = (await response.json()) as ResendSendResponse;

    return {
      providerMessageId: body.id,
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
