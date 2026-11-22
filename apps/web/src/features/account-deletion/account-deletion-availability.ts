/**
 * Web mirror of the API gate. Both must be enabled together.
 * Unset stays off, so Production does not offer deletion before the
 * Privacy Policy amendment is published.
 */
export function isAccountDeletionUiEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = env.NEXT_PUBLIC_ACCOUNT_DELETION_ENABLED?.trim();
  return value === "true" || value === "1";
}
