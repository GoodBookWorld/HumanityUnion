/**
 * One-shot browser completion for an Integrity Media SSO grant.
 * The shared API client retries after a 401 refresh, so this request
 * does not use it. A grant is kept only in memory for this page load.
 */

export const SSO_GRANT_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const SSO_COMPLETE_PATH = "/api/v1/integrity-media/account/sso/complete";
export const VERIFIED_SSO_DESTINATION = "/workspace";
export const PENDING_SSO_DESTINATION = "/confirm-email";

const MISSING_GRANT_MESSAGE =
  "This sign-in link is incomplete. Start again from Integrity Media.";
const INVALID_GRANT_MESSAGE =
  "This sign-in link is not valid. Start again from Integrity Media.";
const EXPIRED_GRANT_MESSAGE =
  "This sign-in link has expired. Start again from Integrity Media.";
const CONSUMED_GRANT_MESSAGE =
  "This sign-in link was already used. Start again from Integrity Media.";
const FAILED_COMPLETION_MESSAGE =
  "Humanity Union could not complete sign-in. Start again from Integrity Media.";
const UNSAFE_DESTINATION_MESSAGE = "Humanity Union could not open the requested page.";

export type SsoGrantAssessment =
  | { readonly ok: true; readonly grant: string }
  | { readonly ok: false; readonly reason: "missing" | "malformed" };

export type SsoCompletionResult =
  | { readonly kind: "verified"; readonly destination: typeof VERIFIED_SSO_DESTINATION }
  | { readonly kind: "pending"; readonly destination: typeof PENDING_SSO_DESTINATION }
  | { readonly kind: "error"; readonly message: string };

interface SsoCompletionData {
  authenticationComplete?: unknown;
  emailConfirmationRequired?: unknown;
  destination?: unknown;
}

interface SsoCompletionEnvelope {
  success?: unknown;
  data?: SsoCompletionData | null;
  meta?: { code?: unknown };
}

let heldGrant: string | null = null;
const completions = new Map<string, Promise<SsoCompletionResult>>();

export function assessSsoGrant(value: string | null | undefined): SsoGrantAssessment {
  if (value === null || value === undefined || value.trim() === "") {
    return { ok: false, reason: "missing" };
  }

  if (!SSO_GRANT_PATTERN.test(value)) {
    return { ok: false, reason: "malformed" };
  }

  return { ok: true, grant: value };
}

/**
 * Remember a valid grant from the URL. After the query is removed, an empty
 * read returns that same grant. An explicit malformed value is not replaced
 * by an older grant.
 */
export function holdSsoGrant(value: string | null | undefined): SsoGrantAssessment {
  if (value === null || value === undefined || value.trim() === "") {
    if (heldGrant) {
      return { ok: true, grant: heldGrant };
    }

    return { ok: false, reason: "missing" };
  }

  const assessment = assessSsoGrant(value);
  if (assessment.ok) {
    heldGrant = assessment.grant;
  }

  return assessment;
}

export function ssoGrantMessage(reason: "missing" | "malformed"): string {
  return reason === "missing" ? MISSING_GRANT_MESSAGE : INVALID_GRANT_MESSAGE;
}

export function browserUrlWithoutGrant(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("grant");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function stripSsoGrantFromBrowserUrl(): void {
  if (typeof window === "undefined" || !window.location.search.includes("grant=")) {
    return;
  }

  const next = browserUrlWithoutGrant(window.location.href);
  window.history.replaceState(null, "", next);
}

export function interpretSsoCompletion(body: unknown): SsoCompletionResult {
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) {
    return { kind: "error", message: messageForFailure(body) };
  }

  const data = body.data;
  const verified = data.authenticationComplete === true;
  const pending = data.emailConfirmationRequired === true;

  if (verified === pending) {
    return { kind: "error", message: FAILED_COMPLETION_MESSAGE };
  }

  if (verified) {
    if (data.destination !== VERIFIED_SSO_DESTINATION) {
      return { kind: "error", message: UNSAFE_DESTINATION_MESSAGE };
    }

    return { kind: "verified", destination: VERIFIED_SSO_DESTINATION };
  }

  if (data.destination !== PENDING_SSO_DESTINATION) {
    return { kind: "error", message: UNSAFE_DESTINATION_MESSAGE };
  }

  return { kind: "pending", destination: PENDING_SSO_DESTINATION };
}

export function completeSsoGrantOnce(
  grant: string,
  options: { apiBaseUrl: string; fetchImpl?: typeof fetch },
): Promise<SsoCompletionResult> {
  const existing = completions.get(grant);
  if (existing) {
    return existing;
  }

  const pending = postSsoCompletion(grant, options);
  completions.set(grant, pending);
  return pending;
}

export function resetSsoCompletionForTests(): void {
  heldGrant = null;
  completions.clear();
}

async function postSsoCompletion(
  grant: string,
  options: { apiBaseUrl: string; fetchImpl?: typeof fetch },
): Promise<SsoCompletionResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${options.apiBaseUrl.replace(/\/+$/, "")}${SSO_COMPLETE_PATH}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ grant }),
    });
  } catch {
    return { kind: "error", message: FAILED_COMPLETION_MESSAGE };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "error", message: FAILED_COMPLETION_MESSAGE };
  }

  if (!response.ok) {
    return { kind: "error", message: messageForFailure(body) };
  }

  return interpretSsoCompletion(body);
}

function messageForFailure(body: unknown): string {
  const code = isRecord(body) && isRecord(body.meta) && typeof body.meta.code === "string"
    ? body.meta.code
    : "";

  switch (code) {
    case "grant_expired":
      return EXPIRED_GRANT_MESSAGE;
    case "grant_consumed":
      return CONSUMED_GRANT_MESSAGE;
    case "grant_not_found":
    case "invalid_request":
      return INVALID_GRANT_MESSAGE;
    default:
      return FAILED_COMPLETION_MESSAGE;
  }
}

function isRecord(value: unknown): value is SsoCompletionEnvelope & Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
