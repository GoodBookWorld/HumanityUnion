/**
 * Blog migration report redaction — never emit emails, token material, content, or credentials.
 */

const FORBIDDEN_REPORT_KEYS = [
  "email",
  "emailNormalized",
  "emailDisplay",
  "confirmTokenHash",
  "confirmTokenExpiresAt",
  "unsubscribeTokenHash",
  "rawToken",
  "content",
  "passwordHash",
  "shippingAddress",
] as const;

export function assertNoSecretLeak(text: string): void {
  if (/mongodb(\+srv)?:\/\//i.test(text)) {
    throw new Error("Refusing to emit Mongo connection string material.");
  }
  if (/\$2[aby]\$\d{2}\$/i.test(text)) {
    throw new Error("Refusing to emit bcrypt hash material.");
  }
  if (/\bsk_(live|test)_/i.test(text) || /\bwhsec_/i.test(text)) {
    throw new Error("Refusing to emit Stripe secret material.");
  }
  if (
    /R2_SECRET_ACCESS_KEY\s*[:=]/i.test(text) ||
    /"secretAccessKey"\s*:\s*"[^"]+"/i.test(text) ||
    /"accessKeyId"\s*:\s*"[^"]+"/i.test(text) ||
    /SECRET_ACCESS_KEY"\s*:\s*"[^"]+"/i.test(text)
  ) {
    throw new Error("Refusing to emit R2 credential material.");
  }
  if (/"confirmTokenHash"\s*:/i.test(text) || /"unsubscribeTokenHash"\s*:/i.test(text)) {
    throw new Error("Refusing to emit Blog subscription token hash material.");
  }
  if (/"emailNormalized"\s*:/i.test(text) || /"emailDisplay"\s*:/i.test(text)) {
    throw new Error("Refusing to emit subscriber email material.");
  }
  // Common email pattern in JSON string values (avoid matching media URLs).
  if (/"[^"]*@[^"]+\.[a-z]{2,}"/i.test(text) && !/media\.huws\.org/i.test(text)) {
    // Only fail when the quoted string looks like an email address value.
    const matches = text.match(/"([^"]+@[^"]+)"/g) ?? [];
    for (const m of matches) {
      const inner = m.slice(1, -1);
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inner)) {
        throw new Error("Refusing to emit email address material.");
      }
    }
  }
}

/** Deep-strip forbidden keys from objects before serialization (defensive). */
export function stripForbiddenReportFields<T>(value: T): T {
  return stripInner(value) as T;
}

function stripInner(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripInner);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if ((FORBIDDEN_REPORT_KEYS as readonly string[]).includes(key)) {
        continue;
      }
      out[key] = stripInner(child);
    }
    return out;
  }
  return value;
}
