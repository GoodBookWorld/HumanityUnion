import { resolveEmailConfig } from "../email.config.js";
import {
  assertRecipientAllowedForExternalDelivery,
  recipientDomainForLogs,
  TestRecipientBlockedError,
} from "../email-safety-guards.js";
import {
  classifySmtpFailure,
  extractSmtpErrorCode,
  isTemporarySmtpFailure,
  smtpRetryDelayMs,
} from "../smtp-retry.js";
import { createSmtpTransport } from "../smtp-transport.js";
import type {
  EmailProvider,
  EmailProviderHealthResult,
  EmailSendRequest,
  EmailSendResult,
} from "../email.types.js";

let lastSuccessAt: string | undefined;
let lastFailureCategory: string | undefined;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SmtpEmailProvider implements EmailProvider {
  readonly providerId = "smtp" as const;

  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    const started = Date.now();

    try {
      assertRecipientAllowedForExternalDelivery(request.to, this.providerId);
    } catch (error) {
      if (error instanceof TestRecipientBlockedError) {
        console.warn(
          `[email:smtp] test-recipient-blocked | template=${request.template} domain=${recipientDomainForLogs(request.to)}`,
        );
        return {
          status: "blocked",
          attemptCount: 0,
          provider: "smtp",
          durationMs: Date.now() - started,
          failureCategory: "test_recipient_blocked",
        };
      }
      throw error;
    }

    const config = resolveEmailConfig();
    const maxAttempts = Math.max(1, Math.min(config.smtpMaxAttempts, 5));
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const transport = createSmtpTransport();
        const result = await transport.sendMail({
          from: `"${config.fromName}" <${config.fromAddress}>`,
          to: request.to,
          replyTo: request.replyTo ?? config.replyTo,
          subject: request.subject,
          html: request.html,
          text: request.text,
        });

        lastSuccessAt = new Date().toISOString();
        console.info(
          `[email:smtp] ${request.template} accepted | domain=${recipientDomainForLogs(request.to)} attempts=${attempt} durationMs=${Date.now() - started}`,
        );

        return {
          status: "sent",
          providerMessageId: result.messageId,
          attemptCount: attempt,
          provider: "smtp",
          durationMs: Date.now() - started,
        };
      } catch (error) {
        lastError = error;
        const category = classifySmtpFailure(error);
        lastFailureCategory = category;
        const code = extractSmtpErrorCode(error);
        console.error(
          `[email:smtp] delivery failed | code=${code} category=${category} attempt=${attempt}/${maxAttempts} domain=${recipientDomainForLogs(request.to)}`,
        );

        const temporary = isTemporarySmtpFailure(error);
        if (!temporary || attempt >= maxAttempts) {
          break;
        }

        await sleep(smtpRetryDelayMs(attempt - 1));
      }
    }

    const category = classifySmtpFailure(lastError);
    const temporary = isTemporarySmtpFailure(lastError);

    return {
      status: temporary ? "deferred" : "failed",
      attemptCount: maxAttempts,
      provider: "smtp",
      durationMs: Date.now() - started,
      failureCategory: category,
    };
  }

  async verifyConfiguration(): Promise<EmailProviderHealthResult> {
    const config = resolveEmailConfig();

    if (!config.smtpHost || !config.fromAddress) {
      return {
        healthy: false,
        configured: false,
        message: "SMTP provider requires SMTP_HOST and SMTP_FROM / SMTP_FROM_EMAIL.",
        lastSuccessAt,
        lastFailureCategory,
      };
    }

    if (!config.smtpUsername || !config.smtpPassword) {
      return {
        healthy: false,
        configured: false,
        message: "SMTP provider requires SMTP_USERNAME (or SMTP_USER) and SMTP_PASSWORD.",
        lastSuccessAt,
        lastFailureCategory,
      };
    }

    try {
      const transport = createSmtpTransport();
      await transport.verify();
      lastSuccessAt = new Date().toISOString();

      return {
        healthy: true,
        configured: true,
        message: `SMTP provider configuration verified (host configured; TLS required).`,
        lastSuccessAt,
        lastFailureCategory,
      };
    } catch (error) {
      const category = classifySmtpFailure(error);
      lastFailureCategory = category;
      return {
        healthy: false,
        configured: true,
        message: `SMTP verification failed (category=${category}).`,
        lastSuccessAt,
        lastFailureCategory,
      };
    }
  }

  async health(): Promise<EmailProviderHealthResult> {
    return this.verifyConfiguration();
  }
}
