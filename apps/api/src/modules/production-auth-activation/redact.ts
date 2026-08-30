const FORBIDDEN_REPORT_PATTERNS = [
  /"passwordHash"\s*:/i,
  /\$2[aby]\$/i,
  /SECRET|ACCESS_KEY/i,
  /"token"\s*:/i,
  /tokenHash/i,
  /resetToken/i,
  /@[a-z0-9.-]+\.[a-z]{2,}/i,
];

export function assertNoSecretLeak(text: string): void {
  for (const pattern of FORBIDDEN_REPORT_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error("Activation report must not contain emails, tokens, or secrets.");
    }
  }
}

export function stripForbiddenReportFields<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
