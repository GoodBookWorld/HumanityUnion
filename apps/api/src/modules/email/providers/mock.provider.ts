import { maskRecipientEmail, recipientDomainForLogs } from "../email-safety-guards.js";
import type {
  EmailProvider,
  EmailProviderHealthResult,
  EmailSendRequest,
  EmailSendResult,
} from "../email.types.js";

export class MockEmailProvider implements EmailProvider {
  readonly providerId = "mock" as const;

  static readonly sentMessages: EmailSendRequest[] = [];

  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    const started = Date.now();
    MockEmailProvider.sentMessages.push({
      ...request,
      to: request.to,
    });

    const previewUrl = `mock://email/${encodeURIComponent(request.template)}/${encodeURIComponent(maskRecipientEmail(request.to))}`;

    console.info(
      `[email:mock] ${request.template} → domain=${recipientDomainForLogs(request.to)} | subject: ${request.subject} | preview: ${previewUrl}`,
    );

    return {
      status: "sent",
      previewUrl,
      providerMessageId: `mock-${Date.now()}`,
      attemptCount: 1,
      provider: "mock",
      durationMs: Date.now() - started,
    };
  }

  async verifyConfiguration(): Promise<EmailProviderHealthResult> {
    return {
      healthy: true,
      configured: true,
      message: "Mock email provider is active. No outbound email is sent.",
    };
  }

  async health(): Promise<EmailProviderHealthResult> {
    return this.verifyConfiguration();
  }

  static clearForTests(): void {
    MockEmailProvider.sentMessages.length = 0;
  }
}
