import { maskEmailAddress } from "../email/email-confirmation.config.js";
import { deleteAuthCodeSendLogsForAccount } from "../email/email-confirmation-code.repository.js";
import { findAuthUserByEmail } from "./auth-user.repository.js";

export async function resetAuthCodeRateLimitsForAccount(input: {
  email: string;
}): Promise<{ maskedEmail: string; categories: string[] }> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Auth rate-limit reset is disabled in production.");
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const user = await findAuthUserByEmail(normalizedEmail);

  if (!user) {
    throw new Error("No account found for the provided email.");
  }

  const deleted = await deleteAuthCodeSendLogsForAccount({
    userId: user.userId,
    email: normalizedEmail,
  });

  return {
    maskedEmail: maskEmailAddress(normalizedEmail),
    categories: deleted > 0 ? ["account_send_log"] : ["account_send_log (already clear)"],
  };
}
