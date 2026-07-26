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
    MockEmailProvider.sentMessages.push({
      ...request,
      to: request.to,
    });

    const previewUrl = `mock://email/${encodeURIComponent(request.template)}/${encodeURIComponent(request.to)}`;

    console.info(
      `[email:mock] ${request.template} → ${request.to} | subject: ${request.subject} | preview: ${previewUrl}`,
    );

    return { previewUrl, providerMessageId: `mock-${Date.now()}` };
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
