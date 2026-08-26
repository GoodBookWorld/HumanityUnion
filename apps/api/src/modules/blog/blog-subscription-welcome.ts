/**
 * Pack 21B — default Welcome Message + validation for Blog subscription settings.
 */

export const DEFAULT_BLOG_SUBSCRIPTION_WELCOME_MESSAGE =
  "Welcome to Humanity Union Blog updates. You will receive an email when new publications become available. Thank you for following our work.";

export const BLOG_SUBSCRIPTION_WELCOME_MESSAGE_MAX_LENGTH = 2000;

export function sanitizeBlogSubscriptionWelcomeMessage(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("welcomeMessage must be a string.");
  }
  if (/<|>|script/i.test(value)) {
    throw new Error("welcomeMessage must not contain HTML.");
  }
  const cleaned = value.replace(/\r\n/g, "\n").trim();
  if (cleaned.length < 1) {
    throw new Error("welcomeMessage must not be empty.");
  }
  if (cleaned.length > BLOG_SUBSCRIPTION_WELCOME_MESSAGE_MAX_LENGTH) {
    throw new Error(
      `welcomeMessage must be at most ${BLOG_SUBSCRIPTION_WELCOME_MESSAGE_MAX_LENGTH} characters.`,
    );
  }
  return cleaned;
}

export function escapeWelcomeMessageForEmailHtml(message: string): string {
  return message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br />");
}
