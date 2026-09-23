/**
 * EMAIL SECURITY 02B — shared Blog subscription test seams (Turnstile fake + abuse reset).
 * Must never contact real Turnstile or Titan.
 */
import {
  resetBlogSubscriptionAbuseForTests,
  setBlogSubscriptionAbuseNowMsForTests,
} from "../../../src/modules/blog/persistence/blog-subscription-abuse.repository.js";
import { resetBlogSubscriptionSecurityEventsForTests } from "../../../src/modules/blog/persistence/blog-subscription-security-event.repository.js";
import {
  resetBlogTurnstileVerifierForTests,
  setBlogTurnstileVerifierForTests,
  type BlogTurnstileVerifyResult,
  type BlogTurnstileVerifier,
} from "../../../src/modules/blog/blog-subscription-turnstile.js";

let turnstileMode: "ok" | "invalid" | "unavailable" | "missing" = "ok";
let turnstileCallCount = 0;

export function setBlogTurnstileTestMode(
  mode: "ok" | "invalid" | "unavailable" | "missing",
): void {
  turnstileMode = mode;
}

export function getBlogTurnstileTestCallCount(): number {
  return turnstileCallCount;
}

export function resetBlogTurnstileTestCallCount(): void {
  turnstileCallCount = 0;
}

const fakeVerifier: BlogTurnstileVerifier = async (input) => {
  turnstileCallCount += 1;
  if (turnstileMode === "missing" || !input.token.trim()) {
    return { ok: false, reason: "turnstile_missing" };
  }
  if (turnstileMode === "unavailable") {
    return { ok: false, reason: "turnstile_unavailable" };
  }
  if (turnstileMode === "invalid" || input.token === "invalid-token") {
    return { ok: false, reason: "turnstile_invalid" };
  }
  return { ok: true } satisfies BlogTurnstileVerifyResult;
};

/** Install fake Turnstile verifier + clear abuse/security state. */
export function installBlogSubscriptionSecurityTestSeams(): void {
  process.env.NODE_ENV = "test";
  process.env.NODE_TEST_ENV = "true";
  turnstileMode = "ok";
  turnstileCallCount = 0;
  setBlogTurnstileVerifierForTests(fakeVerifier);
  resetBlogSubscriptionAbuseForTests();
  setBlogSubscriptionAbuseNowMsForTests(null);
  resetBlogSubscriptionSecurityEventsForTests();
}

export function uninstallBlogSubscriptionSecurityTestSeams(): void {
  resetBlogTurnstileVerifierForTests();
  resetBlogSubscriptionAbuseForTests();
  setBlogSubscriptionAbuseNowMsForTests(null);
  resetBlogSubscriptionSecurityEventsForTests();
  turnstileMode = "ok";
  turnstileCallCount = 0;
}

export function validTurnstileTokenForTests(label = "ok"): string {
  return `test-turnstile-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
