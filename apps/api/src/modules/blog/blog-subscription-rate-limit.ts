/**
 * EMAIL SECURITY 02B — Blog subscription rate-limit error helpers.
 *
 * Durable IP/email gates live in blog-subscription-abuse.repository.ts.
 * This module retains the public error name used by blog.routes.ts.
 */

export function createBlogSubscriptionRateLimitError(
  message = "Too many subscription requests. Please try again later.",
): Error {
  const error = new Error(message);
  error.name = "BlogSubscriptionRateLimitError";
  return error;
}

export function isBlogSubscriptionRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.name === "BlogSubscriptionRateLimitError";
}

/** @deprecated EMAIL SECURITY 02B — in-process Maps removed; no-op for older tests. */
export function resetBlogSubscriptionRateLimitsForTests(): void {
  // Durable limiter reset is resetBlogSubscriptionAbuseForTests().
}

/** @deprecated EMAIL SECURITY 02B — clock control moved to abuse repository. */
export function setBlogSubscriptionRateLimitNowMsForTests(_value: number | null): void {
  // Use setBlogSubscriptionAbuseNowMsForTests instead.
}

/**
 * @deprecated EMAIL SECURITY 02B — replaced by durable consumeBlogSubscriptionIpBudget
 * + authorizeBlogSubscriptionConfirmationSend. Kept only so accidental imports fail loudly.
 */
export function assertBlogSubscriptionSubscribeAllowed(_input: {
  emailNormalized: string;
  ipKey: string;
}): void {
  throw new Error(
    "assertBlogSubscriptionSubscribeAllowed was removed in EMAIL SECURITY 02B. Use durable Blog abuse limiter.",
  );
}
