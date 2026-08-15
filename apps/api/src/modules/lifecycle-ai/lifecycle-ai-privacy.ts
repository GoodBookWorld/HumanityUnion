/**
 * Part 6 — private chats, private documents, credentials, and personal
 * messages must never be sent automatically to a Lifecycle AI provider.
 */

const FORBIDDEN_PAYLOAD_KEYS = [
  "password",
  "passwordhash",
  "refreshtoken",
  "refreshtokenhash",
  "accesstoken",
  "sessionid",
  "jwt",
  "authorization",
  "email",
  "phonenumber",
  "directmessage",
  "privatemessage",
  "messagebody",
  "conversationid",
  "sharedDocumentContent",
  "shareddocumentcontent",
  "credential",
  "apikey",
  "secret",
] as const;

export function assertLifecycleAiPayloadIsPrivateFree(payload: unknown, label: string): void {
  const serialized = JSON.stringify(payload ?? {}).toLowerCase();

  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    if (serialized.includes(`"${key}"`)) {
      throw new Error(`${label} must not include private field: ${key}`);
    }
  }

  if (
    /-----begin [a-z0-9 ]+private key-----/.test(serialized) ||
    /sk-[a-z0-9]{20,}/i.test(serialized) ||
    /aiza[sy][0-9a-z_-]{20,}/i.test(serialized)
  ) {
    throw new Error(`${label} must not include credential material.`);
  }
}

export function sanitizePublicDraftExcerpt(excerpt: string | undefined): string | undefined {
  if (!excerpt) {
    return undefined;
  }

  const trimmed = excerpt.trim().slice(0, 8000);
  assertLifecycleAiPayloadIsPrivateFree({ draftExcerpt: trimmed }, "currentDraftExcerpt");
  return trimmed;
}
