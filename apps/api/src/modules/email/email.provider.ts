import { resolveEmailProviderMode } from "./email.config.js";
import { assertSafeEmailProviderForCurrentMode } from "./email-verification-guards.js";
import { MockEmailProvider } from "./providers/mock.provider.js";
import { ResendEmailProvider } from "./providers/resend.provider.js";
import { SmtpEmailProvider } from "./providers/smtp.provider.js";
import type { EmailProvider } from "./email.types.js";

let cachedProvider: EmailProvider | null = null;
let cachedMode: string | null = null;

export function resolveEmailProvider(): EmailProvider {
  const mode = resolveEmailProviderMode();
  assertSafeEmailProviderForCurrentMode(mode);

  if (cachedProvider && cachedMode === mode) {
    return cachedProvider;
  }

  switch (mode) {
    case "smtp":
      cachedProvider = new SmtpEmailProvider();
      break;
    case "resend":
      cachedProvider = new ResendEmailProvider();
      break;
    case "mock":
    default:
      cachedProvider = new MockEmailProvider();
      break;
  }

  cachedMode = mode;
  return cachedProvider;
}

export function resetEmailProviderCacheForTests(): void {
  cachedProvider = null;
  cachedMode = null;
}

export type { EmailProvider } from "./email.types.js";
