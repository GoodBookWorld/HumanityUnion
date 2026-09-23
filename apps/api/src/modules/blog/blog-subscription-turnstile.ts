/**
 * EMAIL SECURITY 02B — server-side Cloudflare Turnstile verification (Blog only).
 *
 * No environment flag may disable verification on deployed staging/production.
 * Automated tests inject a fake verifier via setBlogTurnstileVerifierForTests.
 */
import { isDeployedPlatformRequiringRealEmail } from "../email/email-safety-guards.js";

export type BlogTurnstileVerifyResult =
  | { ok: true }
  | {
      ok: false;
      reason: "turnstile_missing" | "turnstile_invalid" | "turnstile_unavailable";
    };

export type BlogTurnstileVerifier = (input: {
  token: string;
  remoteIp?: string;
}) => Promise<BlogTurnstileVerifyResult>;

let injectedVerifier: BlogTurnstileVerifier | null = null;

/**
 * Test-only seam. Structurally refused when NODE_ENV=production or PLATFORM_MODE
 * is staging/beta/production — a mistaken env var cannot enable this path.
 */
export function setBlogTurnstileVerifierForTests(verifier: BlogTurnstileVerifier | null): void {
  if (isDeployedPlatformRequiringRealEmail()) {
    throw new Error(
      "setBlogTurnstileVerifierForTests is refused on deployed staging/beta/production platforms.",
    );
  }
  if (process.env.NODE_ENV === "production" && process.env.NODE_TEST_ENV !== "true") {
    throw new Error("setBlogTurnstileVerifierForTests is refused when NODE_ENV=production.");
  }
  injectedVerifier = verifier;
}

export function resetBlogTurnstileVerifierForTests(): void {
  injectedVerifier = null;
}

function resolveTurnstileSecretKey(): string | null {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  return secret || null;
}

const defaultVerifier: BlogTurnstileVerifier = async (input) => {
  const token = input.token?.trim() ?? "";
  if (!token) {
    return { ok: false, reason: "turnstile_missing" };
  }

  const secret = resolveTurnstileSecretKey();
  if (!secret) {
    return { ok: false, reason: "turnstile_unavailable" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (input.remoteIp?.trim()) {
    body.set("remoteip", input.remoteIp.trim());
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    let response: Response;
    try {
      response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return { ok: false, reason: "turnstile_unavailable" };
    }

    const payload = (await response.json()) as { success?: boolean };
    if (payload.success === true) {
      return { ok: true };
    }
    return { ok: false, reason: "turnstile_invalid" };
  } catch {
    return { ok: false, reason: "turnstile_unavailable" };
  }
};

export async function verifyBlogSubscriptionTurnstile(input: {
  token: unknown;
  remoteIp?: string;
}): Promise<BlogTurnstileVerifyResult> {
  if (typeof input.token !== "string" || !input.token.trim()) {
    return { ok: false, reason: "turnstile_missing" };
  }

  const verifier = injectedVerifier ?? defaultVerifier;
  return verifier({
    token: input.token.trim(),
    remoteIp: input.remoteIp,
  });
}
