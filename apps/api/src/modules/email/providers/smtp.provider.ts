import { resolveEmailConfig } from "../email.config.js";
import {
  assertSafeRecipientForVerificationMode,
  maskRecipientEmail,
} from "../email-verification-guards.js";
import { createSmtpTransport } from "../smtp-transport.js";
import type {
  EmailProvider,
  EmailProviderHealthResult,
  EmailSendRequest,
  EmailSendResult,
} from "../email.types.js";

export class SmtpEmailProvider implements EmailProvider {
  readonly providerId = "smtp" as const;

  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    assertSafeRecipientForVerificationMode(request.to, this.providerId);

    const config = resolveEmailConfig();
    const transport = createSmtpTransport();

    try {
      const result = await transport.sendMail({
        from: `"${config.fromName}" <${config.fromAddress}>`,
        to: request.to,
        replyTo: request.replyTo ?? config.replyTo,
        subject: request.subject,
        html: request.html,
        text: request.text,
      });

      console.info(
        `[email:smtp] ${request.template} accepted for delivery to ${maskRecipientEmail(request.to)}`,
      );

      return {
        providerMessageId: result.messageId,
      };
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code ?? "UNKNOWN")
          : "UNKNOWN";
      console.error(`[email:smtp] delivery failed | code=${code}`);
      throw error;
    }
  }

  async verifyConfiguration(): Promise<EmailProviderHealthResult> {
    const config = resolveEmailConfig();

    if (!config.smtpHost || !config.fromAddress) {
      return {
        healthy: false,
        configured: false,
        message: "SMTP provider requires SMTP_HOST and SMTP_FROM.",
      };
    }

    if (!config.smtpUsername || !config.smtpPassword) {
      return {
        healthy: false,
        configured: false,
        message: "SMTP provider requires SMTP_USERNAME and SMTP_PASSWORD.",
      };
    }

    try {
      const transport = createSmtpTransport();
      await transport.verify();

      return {
        healthy: true,
        configured: true,
        message: "SMTP provider configuration verified.",
      };
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code ?? "UNKNOWN")
          : "UNKNOWN";
      const message = error instanceof Error ? error.message : "SMTP verification failed.";

      return {
        healthy: false,
        configured: true,
        message: `${message} (code=${code})`,
      };
    }
  }

  async health(): Promise<EmailProviderHealthResult> {
    return this.verifyConfiguration();
  }
}
