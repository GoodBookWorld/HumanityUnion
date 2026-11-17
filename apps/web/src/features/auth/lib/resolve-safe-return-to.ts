const AUTH_COMPLETION_PATHS = [
  "/login",
  "/login/verify",
  "/register",
  "/confirm-email",
  "/password-reset",
  "/verify-email",
] as const;

export function resolveSafeReturnTo(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  // Reject control characters and backslash escapes that could confuse parsers.
  if (/[\u0000-\u001f\\]/.test(value)) {
    return fallback;
  }

  const pathOnly = value.split("?")[0]?.split("#")[0] ?? value;

  if (!pathOnly.startsWith("/") || pathOnly.startsWith("//")) {
    return fallback;
  }

  if (
    AUTH_COMPLETION_PATHS.some(
      (blockedPath) => pathOnly === blockedPath || pathOnly.startsWith(`${blockedPath}/`),
    )
  ) {
    return fallback;
  }

  return value;
}
