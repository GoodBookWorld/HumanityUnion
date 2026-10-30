/** Set by the API only for a verified Binding Recovery state. Never read from the URL. */
export const BINDING_RECOVERY_PREVIEW_PURPOSE = "binding_recovery";

export const ORDINARY_CONFIRMATION_TITLE =
  "Connect your Humanity Union account to Integrity Media?";

export const RECOVERY_CONFIRMATION_TITLE =
  "Replace the Humanity Union account connected to Integrity Media?";

export const RECOVERY_WARNING =
  "The previous Humanity Union connection for this Integrity Media author will be replaced. Existing posts and messages stay with the previous account.";

export const RECOVERY_ACKNOWLEDGEMENT =
  "I understand that this account replaces the previous Humanity Union connection.";

export interface IntegrityMediaLinkPreview {
  displayName: string;
  source: string;
  purpose?: string;
  email?: string;
}

export function isBindingRecoveryPreview(preview: IntegrityMediaLinkPreview): boolean {
  return preview.purpose === BINDING_RECOVERY_PREVIEW_PURPOSE;
}

export const EXISTING_ACCOUNT_TITLE = "Connect your existing Humanity Union account";

export const EXISTING_ACCOUNT_SENTENCE =
  "A Humanity Union account already uses your Integrity Media email. Enter that email address to receive a verification code.";

export const EXISTING_ACCOUNT_CODE_SENT =
  "If this email belongs to a Humanity Union account that can be connected, a verification code was sent.";

export const EXISTING_ACCOUNT_AUTHORIZATION =
  "I authorize connecting this Humanity Union account to my Integrity Media author account.";

/** API codes after which this confirmation link cannot connect an existing account. */
export const EXISTING_ACCOUNT_TERMINAL_CODES: ReadonlySet<string> = new Set([
  "author_deletion_pending",
  "author_already_linked",
  "attempt_already_bound",
  "account_not_linkable",
  "attempt_expired",
  "attempt_not_found",
  "code_send_limit",
]);

export function canSendExistingAccountCode(input: { phase: string; email: string }): boolean {
  return input.phase === "existing-account" && /^[^\s@]+@[^\s@]+$/.test(input.email.trim());
}

/** The code and an explicit authorization are both required. */
export function canVerifyExistingAccount(input: {
  phase: string;
  code: string;
  authorized: boolean;
}): boolean {
  return input.phase === "existing-code" && /^\d{6}$/.test(input.code.trim()) && input.authorized;
}

/** Recovery requires an explicit acknowledgement before Confirm is enabled. */
export function canSubmitIntegrityMediaConfirmation(input: {
  phase: string;
  recovery: boolean;
  acknowledged: boolean;
}): boolean {
  return input.phase === "ready" && (!input.recovery || input.acknowledged);
}
