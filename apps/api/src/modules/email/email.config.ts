import type { EmailProviderMode } from "./email.types.js";
import {
  isSafePublicHttpsLogoUrl,
  mustForceMockEmailProvider,
} from "./email-safety-guards.js";

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
  /** Nodemailer connection timeout (ms). */
  smtpConnectionTimeoutMs: number;
  /** Nodemailer greeting timeout (ms). */
  smtpGreetingTimeoutMs: number;
  /** Nodemailer socket timeout (ms). */
  smtpSocketTimeoutMs: number;
  /** Bounded retries for temporary SMTP failures. */
  smtpMaxAttempts: number;
  resendApiKey?: string;
  sendLoginNotifications: boolean;
  verificationTokenExpiresMinutes: number;
  passwordResetTokenExpiresMinutes: number;
  emailChangeTokenExpiresMinutes: number;
  publicSiteUrl: string;
  /**
   * Absolute HTTPS logo URL when safe for email clients.
   * Null when only localhost/relative fallback would be available — templates
   * omit the <img> and keep text branding.
   */
  logoUrl: string | null;
}

/**
 * Canonical provider resolution.
 * Automated test/verification environments always resolve to `mock` unless
 * ALLOW_REAL_EMAIL_IN_TESTS=true (manual smoke only). Valid SMTP credentials
 * in apps/api/.env must never override this isolation.
 */
export function resolveEmailProviderMode(): EmailProviderMode {
  if (mustForceMockEmailProvider()) {
    return "mock";
  }

  const mode = process.env.EMAIL_PROVIDER?.trim() ?? "mock";

  if (mode === "smtp" || mode === "resend" || mode === "mock") {
    return mode;
  }

  return "mock";
}

/**
 * Prefer EMAIL_LOGO_URL (absolute HTTPS). Never embed localhost/relative URLs
 * in transactional HTML — Gmail cannot fetch them and shows a broken image.
 */
export function resolveEmailLogoUrl(publicSiteUrl: string): string | null {
  const configured = process.env.EMAIL_LOGO_URL?.trim();

  if (configured) {
    if (isSafePublicHttpsLogoUrl(configured)) {
      return configured;
    }

    console.warn(
      "[email:config] EMAIL_LOGO_URL is not a safe public HTTPS URL; omitting logo image from templates.",
    );
    return null;
  }

  const fallback = `${publicSiteUrl.replace(/\/$/u, "")}/brand/humanity-union-logo-white-email.png`;

  if (isSafePublicHttpsLogoUrl(fallback)) {
    return fallback;
  }

  return null;
}

export function resolveEmailConfig(): EmailConfig {
  const provider = resolveEmailProviderMode();
  const publicSiteUrl =
    process.env.WEB_ORIGIN?.trim() ||
    process.env.CORS_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";

  const smtpUsername =
    process.env.SMTP_USERNAME?.trim() || process.env.SMTP_USER?.trim() || undefined;

  return {
    provider,
    fromAddress:
      process.env.SMTP_FROM_EMAIL?.trim() ||
      process.env.SMTP_FROM?.trim() ||
      process.env.EMAIL_FROM?.trim() ||
      "noreply@humanityunion.local",
    fromName: process.env.EMAIL_FROM_NAME?.trim() || process.env.SMTP_FROM_NAME?.trim() || "Humanity Union",
    replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
    smtpHost: process.env.SMTP_HOST?.trim(),
    smtpPort: Number.parseInt(process.env.SMTP_PORT ?? "587", 10),
    smtpUsername,
    smtpPassword: process.env.SMTP_PASSWORD,
    smtpSecure: parseBoolean(process.env.SMTP_SECURE, false),
    smtpConnectionTimeoutMs: Number.parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? "15000", 10),
    smtpGreetingTimeoutMs: Number.parseInt(process.env.SMTP_GREETING_TIMEOUT_MS ?? "15000", 10),
    smtpSocketTimeoutMs: Number.parseInt(process.env.SMTP_SOCKET_TIMEOUT_MS ?? "30000", 10),
    smtpMaxAttempts: Number.parseInt(process.env.SMTP_MAX_ATTEMPTS ?? "3", 10),
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

/** Canonical Flockmail outbound host (Titan/Hostinger family). */
export const CANONICAL_FLOCKMAIL_SMTP_HOST = "smtp-out.flockmail.com" as const;
