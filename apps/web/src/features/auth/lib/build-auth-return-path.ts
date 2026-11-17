/**
 * Append a safe internal returnTo query to an auth path.
 * Uses {@link resolveSafeReturnTo} — no independent validation.
 */

import { resolveSafeReturnTo } from "./resolve-safe-return-to";

export function buildAuthPathWithReturnTo(
  path: string,
  returnTo: string | null | undefined,
  fallback = "/workspace",
): string {
  const safe = resolveSafeReturnTo(returnTo, fallback);
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}returnTo=${encodeURIComponent(safe)}`;
}
