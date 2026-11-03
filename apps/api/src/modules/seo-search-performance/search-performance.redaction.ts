/**
 * SEO-12B.1 — credential redaction for anything logged or stored.
 */

const REDACTED = "[REDACTED]";
const MAX_MESSAGE_LENGTH = 300;

const SECRET_PATTERNS: readonly [RegExp, string][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, REDACTED],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`],
  [
    /\b(access_token|refresh_token|client_secret|assertion|apikey|api_key|code|key)=[^&\s"']+/gi,
    `$1=${REDACTED}`,
  ],
  [
    /"(access_token|refresh_token|client_secret|private_key|assertion|id_token)"\s*:\s*"[^"]*"/gi,
    `"$1":"${REDACTED}"`,
  ],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, REDACTED],
];

export function redactSearchPerformanceText(
  text: string,
  secrets: readonly (string | null | undefined)[] = [],
): string {
  let output = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 6) {
      output = output.split(secret).join(REDACTED);
    }
  }
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    output = output.replace(pattern, replacement);
  }
  return output.length > MAX_MESSAGE_LENGTH ? `${output.slice(0, MAX_MESSAGE_LENGTH)}…` : output;
}
