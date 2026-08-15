/**
 * Classifies SMTP/Nodemailer errors for bounded retry.
 * Temporary failures may retry; permanent failures must not loop.
 */

const TEMPORARY_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ESOCKET",
  "ECONNECTION",
  "ETLS",
]);

const PERMANENT_MESSAGE_PATTERNS = [
  /invalid login/i,
  /authentication failed/i,
  /sender address rejected/i,
  /recipient address rejected/i,
  /mailbox unavailable/i,
  /user unknown/i,
  /relay access denied/i,
  /550\b/,
  /553\b/,
  /554\b/,
];

export function extractSmtpErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: string }).code ?? "UNKNOWN");
  }
  return "UNKNOWN";
}

export function extractSmtpErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "SMTP delivery failed.";
}

export function isTemporarySmtpFailure(error: unknown): boolean {
  const code = extractSmtpErrorCode(error);
  const message = extractSmtpErrorMessage(error);

  if (code === "EAUTH") {
    return false;
  }

  if (PERMANENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return false;
  }

  if (TEMPORARY_CODES.has(code)) {
    return true;
  }

  // SMTP response codes 4xx are temporary.
  if (/\b4\d\d\b/.test(message)) {
    return true;
  }

  if (/timeout|temporarily|try again|connection reset|greet/i.test(message)) {
    return true;
  }

  return false;
}

export function classifySmtpFailure(error: unknown): string {
  const code = extractSmtpErrorCode(error);
  const message = extractSmtpErrorMessage(error);

  if (/authentication|invalid login|EAUTH/i.test(`${code} ${message}`)) {
    return "auth_failure";
  }
  if (/timeout|ETIMEDOUT|greeting/i.test(`${code} ${message}`)) {
    return "timeout";
  }
  if (/ECONNRESET|ECONNECTION|ESOCKET|connection/i.test(`${code} ${message}`)) {
    return "connection";
  }
  if (/ENOTFOUND|EAI_AGAIN|dns/i.test(`${code} ${message}`)) {
    return "dns";
  }
  if (/recipient|mailbox|user unknown|550|553/i.test(message)) {
    return "recipient_rejected";
  }
  if (/sender|from|554/i.test(message)) {
    return "sender_rejected";
  }
  if (isTemporarySmtpFailure(error)) {
    return "temporary_provider";
  }
  return "permanent_or_unknown";
}

export function smtpRetryDelayMs(attemptIndexZeroBased: number): number {
  return Math.min(250 * 3 ** attemptIndexZeroBased, 1500);
}
