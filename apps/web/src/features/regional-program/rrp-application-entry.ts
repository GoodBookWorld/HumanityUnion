/**
 * HU-RRP-02A — Regional Representative application entry (navigation only).
 * Default OFF: Join CTA stays mailto until the application form ships.
 */

import { resolveSafeReturnTo } from "../auth/lib/resolve-safe-return-to";

/** Query flag on Workspace that reserves application-entry intent. */
export const RRP_APPLICATION_ENTRY_QUERY = "rrp";
export const RRP_APPLICATION_ENTRY_VALUE = "apply";

/** Canonical post-auth destination (path + query). */
export const RRP_APPLICATION_ENTRY_HREF = `/workspace?${RRP_APPLICATION_ENTRY_QUERY}=${RRP_APPLICATION_ENTRY_VALUE}`;

/**
 * Public WEB flag. Enabled only when the env value is exactly `"true"`.
 * Defaults disabled in every environment.
 */
export const RRP_APPLICATION_ENTRY_FLAG_ENV = "NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED";

/**
 * Returns true only when the public flag is exactly `"true"`.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` only for direct property access.
 * Passing `process.env` as a default argument prevents client-bundle inlining,
 * so flag-ON builds would still hide client UI (widget/modal). Optional `env`
 * remains for unit tests.
 */
export function isRrpApplicationEntryEnabled(
  env?: Readonly<Record<string, string | undefined>>,
): boolean {
  if (env) {
    return env[RRP_APPLICATION_ENTRY_FLAG_ENV] === "true";
  }
  return process.env.NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED === "true";
}

/** True when the Workspace URL carries the reserved apply intent. */
export function hasRrpApplicationEntryIntent(
  searchParams: URLSearchParams | { get(name: string): string | null },
): boolean {
  return searchParams.get(RRP_APPLICATION_ENTRY_QUERY) === RRP_APPLICATION_ENTRY_VALUE;
}

/**
 * Build an auth path that preserves a safe internal returnTo (including query).
 * When returnTo is absent or unsafe, returns `path` unchanged.
 */
export function withSafeReturnTo(path: string, returnTo: string | null | undefined): string {
  const safe = resolveSafeReturnTo(returnTo, "");
  if (!safe) {
    return path;
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}returnTo=${encodeURIComponent(safe)}`;
}

/** Login entry that resumes at the canonical RRP application destination. */
export function buildRrpApplicationLoginHref(): string {
  return withSafeReturnTo("/login", RRP_APPLICATION_ENTRY_HREF);
}

/** Confirm-email entry that resumes at the canonical RRP application destination. */
export function buildRrpApplicationConfirmEmailHref(): string {
  return withSafeReturnTo("/confirm-email", RRP_APPLICATION_ENTRY_HREF);
}
