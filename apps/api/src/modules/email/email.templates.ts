import { createHash } from "node:crypto";

import type { EmailTemplateId } from "@hu/types";

import { resolveEmailConfig } from "./email.config.js";

const PRIMARY_COLOR = "#0174B0";
const EMAIL_FOOTER_COPYRIGHT = "© 2024 Humanity Union. All rights reserved.";

function resolveBrandedLogoMarkup(): string {
  const config = resolveEmailConfig();
  const logoUrl = config.logoUrl;

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td style="background:${PRIMARY_COLOR};padding:24px 32px;text-align:center;">
      <img src="${logoUrl}" alt="Humanity Union" width="160" style="display:block;margin:0 auto;max-width:160px;height:auto;border:0;" />
      <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">Humanity Union</p>
    </td>
  </tr>
</table>`;
}

function wrapEmailLayout(content: string): string {
  const config = resolveEmailConfig();
  const supportUrl = `${config.publicSiteUrl}/support`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Humanity Union</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fa;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:0;">
              ${resolveBrandedLogoMarkup()}
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.6;">
              <p style="margin:0 0 8px;">Humanity Union — civic technology for collective decision-making.</p>
              <p style="margin:0 0 8px;">This is a transactional message related to your account. Marketing emails are not sent through this channel.</p>
              <p style="margin:0 0 8px;">Need help? <a href="${supportUrl}" style="color:${PRIMARY_COLOR};">Contact support</a></p>
              <p style="margin:0;">${EMAIL_FOOTER_COPYRIGHT}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface EmailTemplateContent {
  subject: string;
  html: string;
  text: string;
}

export interface RegistrationVerificationTemplateInput {
  displayName: string;
  verificationUrl: string;
}

export interface RegistrationConfirmationCodeTemplateInput {
  displayName: string;
  confirmationCode: string;
  expiresMinutes: number;
}

export interface RegistrationWelcomeTemplateInput {
  displayName: string;
  profileUrl: string;
  exploreUrl: string;
  createInitiativeUrl: string;
}

export interface LoginTwoStepCodeTemplateInput {
  displayName: string;
  loginCode: string;
  expiresMinutes: number;
}

export interface PasswordResetTemplateInput {
  displayName: string;
  resetUrl: string;
  expiresMinutes: number;
}

export interface EmailChangeVerificationTemplateInput {
  displayName: string;
  verificationUrl: string;
  newEmail: string;
}

export interface SecurityAlertTemplateInput {
  displayName: string;
  alertTitle: string;
  alertBody: string;
  actionUrl?: string;
}

export interface LoginNotificationTemplateInput {
  displayName: string;
  loginTime: string;
  userAgent?: string;
}

export interface MemberBadgeContributionConfirmedTemplateInput {
  badgeRequestNumber: string;
  contributionAmount: string;
  shippingAmount: string;
  totalProcessedAmount: string;
  fulfillmentStatus: string;
  requestDetailsUrl: string;
}

function primaryButton(label: string, href: string): string {
  return `<p style="margin:24px 0;">
    <a href="${href}" style="display:inline-block;background:${PRIMARY_COLOR};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">${label}</a>
  </p>`;
}

export function renderRegistrationVerificationEmail(
  input: RegistrationVerificationTemplateInput,
): EmailTemplateContent {
  const htmlBody = `
    <h1 style="margin:0 0 16px;font-size:22px;color:${PRIMARY_COLOR};">Verify your email</h1>
    <p style="margin:0 0 16px;line-height:1.6;">Hello ${input.displayName},</p>
    <p style="margin:0 0 16px;line-height:1.6;">Welcome to Humanity Union. Please verify your email address to secure your account.</p>
    ${primaryButton("Verify email address", input.verificationUrl)}
    <p style="margin:0;line-height:1.6;font-size:13px;color:#64748b;">If you did not create this account, you can ignore this message.</p>
  `;

  return {
    subject: "Verify your Humanity Union email address",
    html: wrapEmailLayout(htmlBody),
    text: `Hello ${input.displayName},\n\nVerify your Humanity Union email address:\n${input.verificationUrl}\n\nIf you did not create this account, ignore this message.`,
  };
}

export function renderRegistrationConfirmationCodeEmail(
  input: RegistrationConfirmationCodeTemplateInput,
): EmailTemplateContent {
  const htmlBody = `
    <h1 style="margin:0 0 16px;font-size:22px;color:${PRIMARY_COLOR};">Confirm your Humanity Union email</h1>
    <p style="margin:0 0 16px;line-height:1.6;">Welcome to Humanity Union.</p>
    <p style="margin:0 0 16px;line-height:1.6;">Use the following code to confirm your email address:</p>
    <p style="margin:0 0 16px;font-size:28px;font-weight:700;letter-spacing:0.25em;color:${PRIMARY_COLOR};">${input.confirmationCode}</p>
    <p style="margin:0 0 16px;line-height:1.6;">This code expires in ${input.expiresMinutes} minutes.</p>
    <p style="margin:0 0 16px;line-height:1.6;">Do not share this code with anyone. Humanity Union will never ask you to send this code by email or message.</p>
    <p style="margin:0;line-height:1.6;font-size:13px;color:#64748b;">If you did not create an account, you can ignore this email.</p>
  `;

  return {
    subject: "Confirm your Humanity Union email",
    html: wrapEmailLayout(htmlBody),
    text: `Welcome to Humanity Union.\n\nUse the following code to confirm your email address:\n\n${input.confirmationCode}\n\nThis code expires in ${input.expiresMinutes} minutes.\n\nDo not share this code with anyone. Humanity Union will never ask you to send this code by email or message.\n\nIf you did not create an account, you can ignore this email.`,
  };
}

export function renderRegistrationWelcomeEmail(
  input: RegistrationWelcomeTemplateInput,
): EmailTemplateContent {
  const htmlBody = `
    <h1 style="margin:0 0 16px;font-size:22px;color:${PRIMARY_COLOR};">Welcome to Humanity Union</h1>
    <p style="margin:0 0 16px;line-height:1.6;">Hello ${input.displayName},</p>
    <p style="margin:0 0 16px;line-height:1.6;">Your email address has been confirmed and your Participant account is now active.</p>
    <p style="margin:0 0 16px;line-height:1.6;">You can now:</p>
    <ul style="margin:0 0 16px;padding-left:20px;line-height:1.8;">
      <li>complete your Member Profile</li>
      <li>select your Participation Area</li>
      <li>choose your interests and communication preferences</li>
      <li>explore civic initiatives</li>
      <li>create and develop an initiative</li>
    </ul>
    ${primaryButton("Complete Your Profile", input.profileUrl)}
    ${primaryButton("Explore the Platform", input.exploreUrl)}
    ${primaryButton("Create an Initiative", input.createInitiativeUrl)}
    <p style="margin:16px 0 0;line-height:1.6;font-size:13px;color:#64748b;">Membership in Humanity Union is a separate optional status that will be introduced through a dedicated process.</p>
  `;

  return {
    subject: "Welcome to Humanity Union",
    html: wrapEmailLayout(htmlBody),
    text: `Hello ${input.displayName},\n\nYour email address has been confirmed and your Participant account is now active.\n\nComplete your profile: ${input.profileUrl}\nExplore the platform: ${input.exploreUrl}\nCreate an initiative: ${input.createInitiativeUrl}`,
  };
}

export function renderLoginTwoStepCodeEmail(
  input: LoginTwoStepCodeTemplateInput,
): EmailTemplateContent {
  const htmlBody = `
    <h1 style="margin:0 0 16px;font-size:22px;color:${PRIMARY_COLOR};">Your Humanity Union login code</h1>
    <p style="margin:0 0 16px;line-height:1.6;">Hello ${input.displayName},</p>
    <p style="margin:0 0 16px;line-height:1.6;">Use this code to complete your Humanity Union login:</p>
    <p style="margin:0 0 16px;font-size:28px;font-weight:700;letter-spacing:0.25em;color:${PRIMARY_COLOR};">${input.loginCode}</p>
    <p style="margin:0 0 16px;line-height:1.6;">This code expires in ${input.expiresMinutes} minutes.</p>
    <p style="margin:0;line-height:1.6;font-size:13px;color:#64748b;">If you did not attempt to sign in, change your password and review your account security.</p>
  `;

  return {
    subject: "Your Humanity Union login code",
    html: wrapEmailLayout(htmlBody),
    text: `Use this code to complete your Humanity Union login:\n\n${input.loginCode}\n\nThis code expires in ${input.expiresMinutes} minutes.\n\nIf you did not attempt to sign in, change your password and review your account security.`,
  };
}

export function renderPasswordResetEmail(input: PasswordResetTemplateInput): EmailTemplateContent {
  const htmlBody = `
    <h1 style="margin:0 0 16px;font-size:22px;color:${PRIMARY_COLOR};">Reset your password</h1>
    <p style="margin:0 0 16px;line-height:1.6;">Hello ${input.displayName},</p>
    <p style="margin:0 0 16px;line-height:1.6;">We received a request to reset your password. This link expires in ${input.expiresMinutes} minutes.</p>
    ${primaryButton("Reset password", input.resetUrl)}
    <p style="margin:0;line-height:1.6;font-size:13px;color:#64748b;">If you did not request a reset, no action is required.</p>
  `;

  return {
    subject: "Reset your Humanity Union password",
    html: wrapEmailLayout(htmlBody),
    text: `Hello ${input.displayName},\n\nReset your password (expires in ${input.expiresMinutes} minutes):\n${input.resetUrl}`,
  };
}

export function renderEmailChangeVerificationEmail(
  input: EmailChangeVerificationTemplateInput,
): EmailTemplateContent {
  const htmlBody = `
    <h1 style="margin:0 0 16px;font-size:22px;color:${PRIMARY_COLOR};">Confirm your new email</h1>
    <p style="margin:0 0 16px;line-height:1.6;">Hello ${input.displayName},</p>
    <p style="margin:0 0 16px;line-height:1.6;">Confirm changing your account email to <strong>${input.newEmail}</strong>.</p>
    ${primaryButton("Confirm email change", input.verificationUrl)}
    <p style="margin:0;line-height:1.6;font-size:13px;color:#64748b;">If you did not request this change, secure your account immediately.</p>
  `;

  return {
    subject: "Confirm your Humanity Union email change",
    html: wrapEmailLayout(htmlBody),
    text: `Hello ${input.displayName},\n\nConfirm email change to ${input.newEmail}:\n${input.verificationUrl}`,
  };
}

export function renderSecurityAlertEmail(input: SecurityAlertTemplateInput): EmailTemplateContent {
  const actionBlock = input.actionUrl
    ? primaryButton("Review account activity", input.actionUrl)
    : "";

  const htmlBody = `
    <h1 style="margin:0 0 16px;font-size:22px;color:${PRIMARY_COLOR};">${input.alertTitle}</h1>
    <p style="margin:0 0 16px;line-height:1.6;">Hello ${input.displayName},</p>
    <p style="margin:0 0 16px;line-height:1.6;">${input.alertBody}</p>
    ${actionBlock}
  `;

  return {
    subject: `Security alert: ${input.alertTitle}`,
    html: wrapEmailLayout(htmlBody),
    text: `Hello ${input.displayName},\n\n${input.alertTitle}\n\n${input.alertBody}`,
  };
}

export function renderLoginNotificationEmail(
  input: LoginNotificationTemplateInput,
): EmailTemplateContent {
  const agentLine = input.userAgent
    ? `<p style="margin:0 0 8px;line-height:1.6;">Device: ${input.userAgent}</p>`
    : "";

  const htmlBody = `
    <h1 style="margin:0 0 16px;font-size:22px;color:${PRIMARY_COLOR};">New sign-in detected</h1>
    <p style="margin:0 0 16px;line-height:1.6;">Hello ${input.displayName},</p>
    <p style="margin:0 0 8px;line-height:1.6;">Your Humanity Union account was signed in at ${input.loginTime}.</p>
    ${agentLine}
    <p style="margin:16px 0 0;line-height:1.6;font-size:13px;color:#64748b;">If this was not you, reset your password immediately.</p>
  `;

  return {
    subject: "New sign-in to your Humanity Union account",
    html: wrapEmailLayout(htmlBody),
    text: `Hello ${input.displayName},\n\nNew sign-in at ${input.loginTime}.${input.userAgent ? `\nDevice: ${input.userAgent}` : ""}`,
  };
}

export function renderMemberBadgeContributionConfirmedEmail(
  input: MemberBadgeContributionConfirmedTemplateInput,
): EmailTemplateContent {
  const htmlBody = `
    <h1 style="margin:0 0 16px;font-size:22px;color:${PRIMARY_COLOR};">Member Badge request confirmed</h1>
    <p style="margin:0 0 16px;line-height:1.6;">Thank you for your additional Membership Contribution.</p>
    <p style="margin:0 0 16px;line-height:1.6;">Your request for the official Humanity Union Member Badge has been confirmed.</p>
    <p style="margin:0 0 8px;line-height:1.6;"><strong>Badge Request Number:</strong> ${input.badgeRequestNumber}</p>
    <p style="margin:0 0 8px;line-height:1.6;"><strong>Contribution amount:</strong> ${input.contributionAmount}</p>
    <p style="margin:0 0 8px;line-height:1.6;"><strong>Shipping amount:</strong> ${input.shippingAmount}</p>
    <p style="margin:0 0 8px;line-height:1.6;"><strong>Total processed amount:</strong> ${input.totalProcessedAmount}</p>
    <p style="margin:0 0 16px;line-height:1.6;"><strong>Fulfillment status:</strong> ${input.fulfillmentStatus}</p>
    <p style="margin:0 0 16px;line-height:1.6;"><a href="${input.requestDetailsUrl}">View your private Badge request details</a></p>
  `;

  return {
    subject: "Your Humanity Union Member Badge request",
    html: wrapEmailLayout(htmlBody),
    text: `Thank you for your additional Membership Contribution.\n\nYour request for the official Humanity Union Member Badge has been confirmed.\n\nBadge Request Number: ${input.badgeRequestNumber}\nContribution amount: ${input.contributionAmount}\nShipping amount: ${input.shippingAmount}\nTotal processed amount: ${input.totalProcessedAmount}\nFulfillment status: ${input.fulfillmentStatus}\n\nView details: ${input.requestDetailsUrl}`,
  };
}

export function renderEmailTemplate(
  template: EmailTemplateId,
  input: Record<string, string | number | undefined>,
): EmailTemplateContent {
  switch (template) {
    case "registration_verification":
      return renderRegistrationVerificationEmail(
        input as unknown as RegistrationVerificationTemplateInput,
      );
    case "registration_confirmation_code":
      return renderRegistrationConfirmationCodeEmail(
        input as unknown as RegistrationConfirmationCodeTemplateInput,
      );
    case "registration_welcome":
      return renderRegistrationWelcomeEmail(input as unknown as RegistrationWelcomeTemplateInput);
    case "login_two_step_code":
      return renderLoginTwoStepCodeEmail(input as unknown as LoginTwoStepCodeTemplateInput);
    case "password_reset":
      return renderPasswordResetEmail(input as unknown as PasswordResetTemplateInput);
    case "email_change_verification":
      return renderEmailChangeVerificationEmail(
        input as unknown as EmailChangeVerificationTemplateInput,
      );
    case "security_alert":
      return renderSecurityAlertEmail(input as unknown as SecurityAlertTemplateInput);
    case "login_notification":
      return renderLoginNotificationEmail(input as unknown as LoginNotificationTemplateInput);
    case "member_badge_contribution_confirmed":
      return renderMemberBadgeContributionConfirmedEmail(
        input as unknown as MemberBadgeContributionConfirmedTemplateInput,
      );
    default: {
      const unsupported: never = template;
      throw new Error(`Unsupported email template: ${unsupported}`);
    }
  }
}

export function hashRecipientEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
