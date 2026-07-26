import type { EmailProviderMode } from "./email.types.js";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  return value === "true" || value === "1";
}

export interface EmailConfig {
  provider: EmailProviderMode;
  fromAddress: string;
  fromName: string;
  replyTo?: string;
  smtpHost?: string;
  smtpPort: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpSecure: boolean;
  resendApiKey?: string;
  sendLoginNotifications: boolean;
  verificationTokenExpiresMinutes: number;
  passwordResetTokenExpiresMinutes: number;
  emailChangeTokenExpiresMinutes: number;
  publicSiteUrl: string;
  logoUrl: string;
}

export function resolveEmailProviderMode(): EmailProviderMode {
  const mode = process.env.EMAIL_PROVIDER?.trim() ?? "mock";

  if (mode === "smtp" || mode === "resend" || mode === "mock") {
    return mode;
  }

  return "mock";
}

export function resolveEmailLogoUrl(publicSiteUrl: string): string {
  const configured = process.env.EMAIL_LOGO_URL?.trim();

  if (configured) {
    return configured;
  }

  return `${publicSiteUrl.replace(/\/$/u, "")}/brand/humanity-union-logo-white-email.png`;
}

export function resolveEmailConfig(): EmailConfig {
  const provider = resolveEmailProviderMode();
  const publicSiteUrl =
    process.env.WEB_ORIGIN?.trim() ||
    process.env.CORS_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";

  return {
    provider,
    fromAddress:
      process.env.SMTP_FROM?.trim() ||
      process.env.EMAIL_FROM?.trim() ||
      "noreply@humanityunion.local",
    fromName: process.env.EMAIL_FROM_NAME?.trim() || "Humanity Union",
    replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
    smtpHost: process.env.SMTP_HOST?.trim(),
    smtpPort: Number.parseInt(process.env.SMTP_PORT ?? "587", 10),
    smtpUsername: process.env.SMTP_USERNAME?.trim(),
    smtpPassword: process.env.SMTP_PASSWORD,
    smtpSecure: parseBoolean(process.env.SMTP_SECURE, false),
    resendApiKey: process.env.RESEND_API_KEY?.trim(),
    sendLoginNotifications: parseBoolean(process.env.EMAIL_SEND_LOGIN_NOTIFICATIONS, false),
    verificationTokenExpiresMinutes: Number.parseInt(
      process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES ??
        process.env.EMAIL_VERIFICATION_TOKEN_EXPIRES_MINUTES ??
        "1440",
      10,
    ),
    passwordResetTokenExpiresMinutes: Number.parseInt(
      process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES ??
        process.env.EMAIL_PASSWORD_RESET_TOKEN_EXPIRES_MINUTES ??
        "60",
      10,
    ),
    emailChangeTokenExpiresMinutes: Number.parseInt(
      process.env.EMAIL_CHANGE_TOKEN_TTL_MINUTES ??
        process.env.EMAIL_CHANGE_TOKEN_EXPIRES_MINUTES ??
        "60",
      10,
    ),
    publicSiteUrl,
    logoUrl: resolveEmailLogoUrl(publicSiteUrl),
  };
}

export function isAuthEmailVerificationRequired(): boolean {
  return process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true";
}
