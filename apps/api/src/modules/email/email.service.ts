import type { EmailProviderHealth, EmailTemplateId } from "@hu/types";

import { findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { findPreferencesByMemberId } from "../preferences/preferences.repository.js";
import { createEmailAuditRecord, markEmailAuditFailed, markEmailAuditSent } from "./email.audit.js";
import { resolveEmailConfig } from "./email.config.js";
import { enqueueEmailDelivery } from "./email.queue.js";
import { resolveEmailProvider } from "./email.provider.js";
import {
  assertRecipientAllowedForExternalDelivery,
  maskRecipientEmail,
  recipientDomainForLogs,
  TestRecipientBlockedError,
} from "./email-safety-guards.js";
import { renderEmailTemplate } from "./email.templates.js";
import type { EmailSendRequest, EmailSendResult, MailDeliveryStatus } from "./email.types.js";

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
  status: MailDeliveryStatus;
  emailDeliveryError?: string;
  attemptCount?: number;
  durationMs?: number;
  providerMessageId?: string;
}

async function applyDeliveryAudit(
  emailId: string,
  result: EmailSendResult,
): Promise<void> {
  if (result.status === "sent") {
    await markEmailAuditSent(emailId, new Date().toISOString());
    return;
  }

  const summary = result.failureCategory ?? result.status;
  const auditStatus =
    result.status === "deferred" || result.status === "blocked" ? result.status : "failed";
  await markEmailAuditFailed(emailId, summary, auditStatus);
}

function toDeliveryResult(emailId: string, result: EmailSendResult): EmailDeliveryResult {
  return {
    emailId,
    emailSent: result.status === "sent",
    status: result.status,
    emailDeliveryError:
      result.status === "sent" ? undefined : (result.failureCategory ?? result.status),
    attemptCount: result.attemptCount,
    durationMs: result.durationMs,
    providerMessageId: result.providerMessageId,
  };
}

async function deliverEmail(request: EmailSendRequest, emailId: string): Promise<void> {
  const provider = resolveEmailProvider();

  try {
    assertRecipientAllowedForExternalDelivery(request.to, provider.providerId);
  } catch (error) {
    if (error instanceof TestRecipientBlockedError) {
      console.warn(
        `[email:delivery] test-recipient-blocked | template=${request.template} domain=${recipientDomainForLogs(request.to)}`,
      );
      await markEmailAuditFailed(emailId, "test_recipient_blocked", "blocked");
      return;
    }
    throw error;
  }

  try {
    const result = await provider.sendEmail(request);
    await applyDeliveryAudit(emailId, result);
    if (result.status !== "sent") {
      console.error(
        `[email:delivery] ${request.template} ${result.status} | domain=${recipientDomainForLogs(request.to)} category=${result.failureCategory ?? "n/a"} attempts=${result.attemptCount}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed.";
    await markEmailAuditFailed(emailId, message);
  }
}

/**
 * Canonical outbound mail boundary (MailDeliveryService).
 * All platform email should route through these helpers — never construct
 * a second SMTP transport in feature modules.
 */
export async function sendTransactionalEmailAndAwait(
  input: SendTransactionalEmailInput,
): Promise<EmailDeliveryResult> {
  const config = resolveEmailConfig();
  const provider = resolveEmailProvider();
  const content = renderEmailTemplate(input.template, input.templateInput);

  const auditRecord = await createEmailAuditRecord({
    template: input.template,
    provider: provider.providerId,
    recipientEmail: input.to,
  });

  try {
    assertRecipientAllowedForExternalDelivery(input.to, provider.providerId);
  } catch (error) {
    if (error instanceof TestRecipientBlockedError) {
      console.warn(
        `[email:delivery] test-recipient-blocked | template=${input.template} domain=${recipientDomainForLogs(input.to)}`,
      );
      await markEmailAuditFailed(auditRecord.emailId, "test_recipient_blocked", "blocked");
      return {
        emailId: auditRecord.emailId,
        emailSent: false,
        status: "blocked",
        emailDeliveryError: "test_recipient_blocked",
        attemptCount: 0,
      };
    }
    throw error;
  }

  const request: EmailSendRequest = {
    to: input.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    template: input.template,
    replyTo: config.replyTo,
  };

  try {
    const result = await provider.sendEmail(request);
    await applyDeliveryAudit(auditRecord.emailId, result);

    if (result.status !== "sent") {
      console.error(
        `[email:delivery] ${input.template} ${result.status} for recipient ${maskRecipientEmail(input.to)}: ${result.failureCategory ?? result.status}`,
      );
    }

    return toDeliveryResult(auditRecord.emailId, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed.";
    await markEmailAuditFailed(auditRecord.emailId, message);
    console.error(
      `[email:delivery] ${input.template} failed for recipient ${maskRecipientEmail(input.to)}: ${message}`,
    );
    return {
      emailId: auditRecord.emailId,
      emailSent: false,
      status: "failed",
      emailDeliveryError: message,
    };
  }
}

export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<string> {
  const config = resolveEmailConfig();
  const provider = resolveEmailProvider();
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

/** Preference gate: default true when preferences are absent (matches defaults). */
export async function isParticipantEmailNotificationsEnabled(
  participantId: string,
): Promise<boolean> {
  try {
    const preferences = await findPreferencesByMemberId(participantId);
    if (!preferences) {
      return true;
    }
    return preferences.communicationPreferences.emailNotificationsEnabled !== false;
  } catch {
    return true;
  }
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

export async function sendWorkspaceNotificationSummaryEmail(input: {
  to: string;
  displayName: string;
  unreadCount: number;
}): Promise<EmailDeliveryResult> {
  const config = resolveEmailConfig();

  return sendTransactionalEmailAndAwait({
    to: input.to,
    template: "workspace_notification_summary",
    templateInput: {
      displayName: input.displayName,
      unreadCount: input.unreadCount,
      notificationsUrl: `${config.publicSiteUrl}/workspace/notifications`,
    },
  });
}

/**
 * Private-content-safe DM/Collaboration alert.
 * Callers must never pass message bodies — template only accepts a messages URL.
 */
export async function sendWorkspaceMessageAlertEmail(input: {
  to: string;
  displayName: string;
}): Promise<EmailDeliveryResult> {
  const config = resolveEmailConfig();

  return sendTransactionalEmailAndAwait({
    to: input.to,
    template: "workspace_message_alert",
    templateInput: {
      displayName: input.displayName,
      messagesUrl: `${config.publicSiteUrl}/workspace/messages`,
    },
  });
}

export type BlogAuthorApplicationEmailStatus =
  | "approved"
  | "changes_requested"
  | "declined";

const AUTHOR_STATUS_COPY: Record<
  BlogAuthorApplicationEmailStatus,
  { statusLabel: string; statusMessage: string }
> = {
  approved: {
    statusLabel: "Blog Author application approved",
    statusMessage:
      "Your Blog Author application has been approved. You can open Authoring to begin drafting.",
  },
  changes_requested: {
    statusLabel: "Blog Author application needs changes",
    statusMessage:
      "An Editor requested changes on your Blog Author application. Open Authoring to review and resubmit.",
  },
  declined: {
    statusLabel: "Blog Author application update",
    statusMessage:
      "Your Blog Author application was declined. Open Authoring for details.",
  },
};

/**
 * Preference-gated Author Access status email via the canonical mail service.
 * Never creates a Blog-specific SMTP transport.
 */
export async function sendBlogAuthorApplicationStatusEmail(input: {
  participantId: string;
  status: BlogAuthorApplicationEmailStatus;
}): Promise<EmailDeliveryResult | null> {
  const enabled = await isParticipantEmailNotificationsEnabled(input.participantId);
  if (!enabled) {
    return null;
  }

  const authUser = await findAuthUserByMemberId(input.participantId).catch(() => null);
  if (!authUser?.email) {
    return null;
  }

  const config = resolveEmailConfig();
  const copy = AUTHOR_STATUS_COPY[input.status];

  return sendTransactionalEmailAndAwait({
    to: authUser.email,
    template: "blog_author_application_status",
    templateInput: {
      displayName: authUser.displayName || "Participant",
      statusLabel: copy.statusLabel,
      statusMessage: copy.statusMessage,
      authoringUrl: `${config.publicSiteUrl}/workspace/authoring`,
    },
  });
}

export type BlogPublicationEmailStatus = "changes_requested" | "published" | "declined";

const PUBLICATION_STATUS_COPY: Record<
  BlogPublicationEmailStatus,
  { statusLabel: string; statusMessage: string }
> = {
  changes_requested: {
    statusLabel: "Changes requested on your Blog publication",
    statusMessage:
      "Changes were requested for your Blog publication. Open Publishing to review the Editor note and resubmit.",
  },
  published: {
    statusLabel: "Your Blog publication has been published",
    statusMessage: "Your Blog publication has been published. Open Publishing for the record.",
  },
  declined: {
    statusLabel: "Blog publication update",
    statusMessage:
      "Your Blog publication was declined. Open Publishing for details.",
  },
};

/**
 * Preference-gated Blog publication status email via MailDeliveryService.
 * Summary + authenticated Publishing link only — not full article or review notes.
 */
export async function sendBlogPublicationStatusEmail(input: {
  participantId: string;
  status: BlogPublicationEmailStatus;
  postId: string;
}): Promise<EmailDeliveryResult | null> {
  const enabled = await isParticipantEmailNotificationsEnabled(input.participantId);
  if (!enabled) {
    return null;
  }

  const authUser = await findAuthUserByMemberId(input.participantId).catch(() => null);
  if (!authUser?.email) {
    return null;
  }

  const config = resolveEmailConfig();
  const copy = PUBLICATION_STATUS_COPY[input.status];

  return sendTransactionalEmailAndAwait({
    to: authUser.email,
    template: "blog_publication_status",
    templateInput: {
      displayName: authUser.displayName || "Participant",
      statusLabel: copy.statusLabel,
      statusMessage: copy.statusMessage,
      publishingUrl: `${config.publicSiteUrl}/workspace/publishing/${encodeURIComponent(input.postId)}`,
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
    lastSuccessAt: health.lastSuccessAt,
    lastFailureCategory: health.lastFailureCategory,
  };
}

/** Canonical facade name used by Mail Delivery Reliability Pack 01 docs/tests. */
export const MailDeliveryService = {
  sendTransactionalEmail,
  sendTransactionalEmailAndAwait,
  sendRegistrationVerificationEmail,
  sendRegistrationConfirmationCodeEmail,
  sendRegistrationWelcomeEmail,
  sendLoginTwoStepCodeEmail,
  sendPasswordResetEmail,
  sendEmailChangeVerificationEmail,
  sendSecurityAlertEmail,
  sendLoginNotificationEmail,
  sendWorkspaceNotificationSummaryEmail,
  sendWorkspaceMessageAlertEmail,
  sendBlogAuthorApplicationStatusEmail,
  sendBlogPublicationStatusEmail,
  isParticipantEmailNotificationsEnabled,
  getEmailProviderHealth,
} as const;
