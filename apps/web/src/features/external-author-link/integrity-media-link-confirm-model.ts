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

/** Recovery requires an explicit acknowledgement before Confirm is enabled. */
export function canSubmitIntegrityMediaConfirmation(input: {
  phase: string;
  recovery: boolean;
  acknowledged: boolean;
}): boolean {
  return input.phase === "ready" && (!input.recovery || input.acknowledged);
}
