/**
 * Pack 21A — Blog subscription email normalization (canonical uniqueness).
 * Trim + lowercase only — no provider-specific alias collapsing.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeBlogSubscriptionEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidBlogSubscriptionEmail(email: string): boolean {
  const normalized = normalizeBlogSubscriptionEmail(email);
  if (normalized.length < 5 || normalized.length > 254) {
    return false;
  }
  if (/<|>|script/i.test(normalized)) {
    return false;
  }
  return EMAIL_PATTERN.test(normalized);
}

export function toBlogSubscriptionEmailDisplay(email: string): string {
  return email.trim();
}
