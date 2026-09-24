import { resolveEmailConfig } from "./email.config.js";

/** Allowlisted custom headers for RFC 8058 list mail only. */
export const EMAIL_LIST_UNSUBSCRIBE_HEADER = "List-Unsubscribe" as const;
export const EMAIL_LIST_UNSUBSCRIBE_POST_HEADER = "List-Unsubscribe-Post" as const;
export const EMAIL_LIST_UNSUBSCRIBE_POST_VALUE = "List-Unsubscribe=One-Click" as const;

export type EmailListUnsubscribeHeaders = {
  readonly [EMAIL_LIST_UNSUBSCRIBE_HEADER]: string;
  readonly [EMAIL_LIST_UNSUBSCRIBE_POST_HEADER]: typeof EMAIL_LIST_UNSUBSCRIBE_POST_VALUE;
};

const ALLOWED_HEADER_NAMES = new Set<string>([
  EMAIL_LIST_UNSUBSCRIBE_HEADER,
  EMAIL_LIST_UNSUBSCRIBE_POST_HEADER,
]);

/** Identity / transport headers that must never be set via this channel. */
const PROHIBITED_HEADER_NAMES = new Set(
  [
    "from",
    "to",
    "subject",
    "message-id",
    "return-path",
    "dkim",
    "dkim-signature",
    "reply-to",
    "sender",
    "cc",
    "bcc",
  ].map((name) => name.toLowerCase()),
);

export class EmailListHeaderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailListHeaderValidationError";
  }
}

function assertNoCrLf(value: string, label: string): void {
  if (/[\r\n]/.test(value)) {
    throw new EmailListHeaderValidationError(`${label} must not contain CR or LF.`);
  }
}

/**
 * Narrow allowlist for List-Unsubscribe headers.
 * Rejects prohibited overrides and CR/LF injection.
 */
export function sanitizeEmailListUnsubscribeHeaders(
  input: Record<string, string> | EmailListUnsubscribeHeaders | undefined,
): EmailListUnsubscribeHeaders | undefined {
  if (input === undefined) {
    return undefined;
  }

  const entries = Object.entries(input);
  if (entries.length === 0) {
    return undefined;
  }

  for (const [rawName, rawValue] of entries) {
    const name = rawName.trim();
    assertNoCrLf(name, "Header name");
    assertNoCrLf(rawValue, "Header value");

    if (PROHIBITED_HEADER_NAMES.has(name.toLowerCase())) {
      throw new EmailListHeaderValidationError(
        `Header "${name}" cannot be set via list-header channel.`,
      );
    }

    if (!ALLOWED_HEADER_NAMES.has(name)) {
      throw new EmailListHeaderValidationError(
        `Header "${name}" is not allowlisted for list unsubscribe.`,
      );
    }
  }

  const listUnsubscribe = input[EMAIL_LIST_UNSUBSCRIBE_HEADER];
  const listUnsubscribePost = input[EMAIL_LIST_UNSUBSCRIBE_POST_HEADER];

  if (typeof listUnsubscribe !== "string" || !listUnsubscribe.trim()) {
    throw new EmailListHeaderValidationError("List-Unsubscribe is required when list headers are set.");
  }
  if (listUnsubscribePost !== EMAIL_LIST_UNSUBSCRIBE_POST_VALUE) {
    throw new EmailListHeaderValidationError(
      "List-Unsubscribe-Post must be exactly List-Unsubscribe=One-Click.",
    );
  }

  return {
    [EMAIL_LIST_UNSUBSCRIBE_HEADER]: listUnsubscribe.trim(),
    [EMAIL_LIST_UNSUBSCRIBE_POST_HEADER]: EMAIL_LIST_UNSUBSCRIBE_POST_VALUE,
  };
}

/** Build RFC 8058 headers for a raw unsubscribe token (never log the result). */
export function buildBlogListUnsubscribeHeaders(
  rawUnsubscribeToken: string,
): EmailListUnsubscribeHeaders {
  const token = rawUnsubscribeToken.trim();
  if (!token) {
    throw new EmailListHeaderValidationError("Unsubscribe token is required for list headers.");
  }
  assertNoCrLf(token, "Unsubscribe token");

  const base = resolveEmailConfig().publicSiteUrl.replace(/\/$/, "");
  assertNoCrLf(base, "publicSiteUrl");

  const listUnsubscribe = `<${base}/blog/subscribe/unsubscribe?token=${encodeURIComponent(token)}>`;

  return sanitizeEmailListUnsubscribeHeaders({
    [EMAIL_LIST_UNSUBSCRIBE_HEADER]: listUnsubscribe,
    [EMAIL_LIST_UNSUBSCRIBE_POST_HEADER]: EMAIL_LIST_UNSUBSCRIBE_POST_VALUE,
  })!;
}
