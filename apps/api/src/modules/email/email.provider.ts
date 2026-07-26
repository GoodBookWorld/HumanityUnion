import { resolveEmailProviderMode } from "./email.config.js";
import { assertSafeEmailProviderForCurrentMode } from "./email-verification-guards.js";
import { MockEmailProvider } from "./providers/mock.provider.js";
import { ResendEmailProvider } from "./providers/resend.provider.js";
import { SmtpEmailProvider } from "./providers/smtp.provider.js";
import type { EmailProvider } from "./email.types.js";

export function resolveEmailProvider(): EmailProvider {
  const mode = resolveEmailProviderMode();
  assertSafeEmailProviderForCurrentMode(mode);

  switch (mode) {
    case "smtp":
      return new SmtpEmailProvider();
    case "resend":
      return new ResendEmailProvider();
    case "mock":
    default:
      return new MockEmailProvider();
  }
}

export type { EmailProvider } from "./email.types.js";
