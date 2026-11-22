import { ApiRequestError } from "../../lib/api-client";

/**
 * Participant-facing deletion errors come from catalog keys.
 * The API message is kept for logs and is not shown in the interface.
 */
export function accountDeletionErrorMessage(
  error: unknown,
  translate: (key: string) => string,
): string {
  const code = error instanceof ApiRequestError ? error.meta?.code : undefined;
  switch (code) {
    case "invalid_password":
      return translate("deleteAccountPasswordIncorrect");
    case "invalid_code":
      return translate("deleteAccountCodeInvalid");
    case "mail_failed":
      return translate("deleteAccountMailFailed");
    case "admin":
      return translate("deleteAccountAdminBlocked");
    case "disabled":
      return translate("deleteAccountSuspendedBlocked");
    case "rrp_appointment":
      return translate("deleteAccountRrpBlocked");
    case "editor_grant":
      return translate("deleteAccountEditorBlocked");
    case "conflict":
      return translate("deleteAccountConflict");
    case "unavailable":
      return translate("deleteAccountUnavailable");
    default:
      return translate("deleteAccountGenericError");
  }
}
