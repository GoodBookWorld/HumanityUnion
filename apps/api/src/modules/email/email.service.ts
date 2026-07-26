import type { EmailProviderHealth, EmailTemplateId } from "@hu/types";

import { createEmailAuditRecord, markEmailAuditFailed, markEmailAuditSent } from "./email.audit.js";
import { resolveEmailConfig } from "./email.config.js";
import { enqueueEmailDelivery } from "./email.queue.js";
import { resolveEmailProvider } from "./email.provider.js";
import {
  assertSafeRecipientForVerificationMode,
  maskRecipientEmail,
} from "./email-verification-guards.js";
import { renderEmailTemplate } from "./email.templates.js";
import type { EmailSendRequest } from "./email.types.js";

export { drainEmailQueueForTests } from "./email.queue.js";
export {
  disposeEmailWorkersForTests,
  getMockEmailSendCount,
  resetMockEmailOutboxForTests,
} from "./email-test-helpers.js";

export interface SendTransactionalEmailInput {
  to: string;
  template: EmailTemplateId;
  templateInput: Record<string, string | number | undefined>;
}

export interface EmailDeliveryResult {
  emailId: string;
  emailSent: boolean;
  emailDeliveryError?: string;
}

async function deliverEmail(request: EmailSendRequest, emailId: string): Promise<void> {
  const provider = resolveEmailProvider();
  assertSafeRecipientForVerificationMode(request.to, provider.providerId);

  try {
    await provider.sendEmail(request);
    await markEmailAuditSent(emailId, new Date().toISOString());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed.";
    await markEmailAuditFailed(emailId, message);
  }
}

export async function sendTransactionalEmailAndAwait(
  input: SendTransactionalEmailInput,
): Promise<EmailDeliveryResult> {
  const config = resolveEmailConfig();
  const provider = resolveEmailProvider();
  assertSafeRecipientForVerificationMode(input.to, provider.providerId);
  const content = renderEmailTemplate(input.template, input.templateInput);

  const auditRecord = await createEmailAuditRecord({
    template: input.template,
    provider: provider.providerId,
    recipientEmail: input.to,
  });

  const request: EmailSendRequest = {
    to: input.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    template: input.template,
    replyTo: config.replyTo,
  };

  try {
    await provider.sendEmail(request);
    await markEmailAuditSent(auditRecord.emailId, new Date().toISOString());
    return { emailId: auditRecord.emailId, emailSent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed.";
    await markEmailAuditFailed(auditRecord.emailId, message);
    console.error(
      `[email:delivery] ${input.template} failed for recipient ${maskRecipientEmail(input.to)}: ${message}`,
    );
    return {
      emailId: auditRecord.emailId,
      emailSent: false,
      emailDeliveryError: message,
    };
  }
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<string> {
  const config = resolveEmailConfig();
  const provider = resolveEmailProvider();
  assertSafeRecipientForVerificationMode(input.to, provider.providerId);
  const content = renderEmailTemplate(input.template, input.templateInput);

  const auditRecord = await createEmailAuditRecord({
    template: input.template,
    provider: provider.providerId,
    recipientEmail: input.to,
  });

  const request: EmailSendRequest = {
    to: input.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    template: input.template,
    replyTo: config.replyTo,
  };

  enqueueEmailDelivery(() => deliverEmail(request, auditRecord.emailId));

  return auditRecord.emailId;
}

export async function sendRegistrationVerificationEmail(input: {
  to: string;
  displayName: string;
  verificationToken: string;
}): Promise<string> {
  const config = resolveEmailConfig();
  const verificationUrl = `${config.publicSiteUrl}/verify-email?token=${encodeURIComponent(input.verificationToken)}`;

  return sendTransactionalEmail({
    to: input.to,
    template: "registration_verification",
    templateInput: {
      displayName: input.displayName,
      verificationUrl,
    },
  });
}

export async function sendRegistrationConfirmationCodeEmail(input: {
  to: string;
  displayName: string;
  confirmationCode: string;
  expiresMinutes: number;
}): Promise<EmailDeliveryResult> {
  return sendTransactionalEmailAndAwait({
    to: input.to,
    template: "registration_confirmation_code",
    templateInput: {
      displayName: input.displayName,
      confirmationCode: input.confirmationCode,
      expiresMinutes: input.expiresMinutes,
    },
  });
}

export async function sendRegistrationWelcomeEmail(input: {
  to: string;
  displayName: string;
}): Promise<string> {
  const config = resolveEmailConfig();

  return sendTransactionalEmail({
    to: input.to,
    template: "registration_welcome",
    templateInput: {
      displayName: input.displayName,
      profileUrl: `${config.publicSiteUrl}/profile`,
      exploreUrl: `${config.publicSiteUrl}/initiatives`,
      createInitiativeUrl: `${config.publicSiteUrl}/initiatives`,
    },
  });
}

export async function sendLoginTwoStepCodeEmail(input: {
  to: string;
  displayName: string;
  loginCode: string;
  expiresMinutes: number;
}): Promise<EmailDeliveryResult> {
  return sendTransactionalEmailAndAwait({
    to: input.to,
    template: "login_two_step_code",
    templateInput: {
      displayName: input.displayName,
      loginCode: input.loginCode,
      expiresMinutes: input.expiresMinutes,
    },
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  displayName: string;
  resetToken: string;
}): Promise<string> {
  const config = resolveEmailConfig();
  const resetUrl = `${config.publicSiteUrl}/password-reset/confirm?token=${encodeURIComponent(input.resetToken)}`;

  return sendTransactionalEmail({
    to: input.to,
    template: "password_reset",
    templateInput: {
      displayName: input.displayName,
      resetUrl,
      expiresMinutes: config.passwordResetTokenExpiresMinutes,
    },
  });
}

export async function sendEmailChangeVerificationEmail(input: {
  displayName: string;
  newEmail: string;
  verificationToken: string;
}): Promise<string> {
  const config = resolveEmailConfig();
  const verificationUrl = `${config.publicSiteUrl}/confirm-email-change?token=${encodeURIComponent(input.verificationToken)}`;

  return sendTransactionalEmail({
    to: input.newEmail,
    template: "email_change_verification",
    templateInput: {
      displayName: input.displayName,
      newEmail: input.newEmail,
      verificationUrl,
    },
  });
}

export async function sendSecurityAlertEmail(input: {
  to: string;
  displayName: string;
  alertTitle: string;
  alertBody: string;
  actionUrl?: string;
}): Promise<string> {
  return sendTransactionalEmail({
    to: input.to,
    template: "security_alert",
    templateInput: {
      displayName: input.displayName,
      alertTitle: input.alertTitle,
      alertBody: input.alertBody,
      actionUrl: input.actionUrl,
    },
  });
}

export async function sendLoginNotificationEmail(input: {
  to: string;
  displayName: string;
  loginTime: string;
  userAgent?: string;
}): Promise<string> {
  return sendTransactionalEmail({
    to: input.to,
    template: "login_notification",
    templateInput: {
      displayName: input.displayName,
      loginTime: input.loginTime,
      userAgent: input.userAgent,
    },
  });
}

export async function getEmailProviderHealth(): Promise<EmailProviderHealth> {
  const provider = resolveEmailProvider();
  const health = await provider.health();

  return {
    provider: provider.providerId,
    healthy: health.healthy,
    configured: health.configured,
    message: health.message,
  };
}
