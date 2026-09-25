/**
 * EMAIL SECURITY 02B — Blog subscription Turnstile facade.
 * Delegates to the shared verifier; preserves Blog import paths and test seams.
 */
export {
  verifyTurnstileToken as verifyBlogSubscriptionTurnstile,
  setTurnstileVerifierForTests as setBlogTurnstileVerifierForTests,
  resetTurnstileVerifierForTests as resetBlogTurnstileVerifierForTests,
  type TurnstileVerifyResult as BlogTurnstileVerifyResult,
  type TurnstileVerifier as BlogTurnstileVerifier,
} from "../security/turnstile.js";
