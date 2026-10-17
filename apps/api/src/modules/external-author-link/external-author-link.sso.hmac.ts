import { INTEGRITY_MEDIA_ACCOUNT_SSO_PURPOSE } from "./external-author-link.constants.js";

export interface SsoCanonicalFields {
  timestamp: string;
  requestId: string;
  externalAuthorId: string;
  memberId: string;
  linkRevision: string;
  target: string;
}

/** Seven lines, UTF-8, joined by newline, no trailing newline. */
export function buildSsoGrantPayload(input: SsoCanonicalFields): string {
  return [
    INTEGRITY_MEDIA_ACCOUNT_SSO_PURPOSE,
    input.timestamp,
    input.requestId,
    input.externalAuthorId,
    input.memberId,
    input.linkRevision,
    input.target,
  ].join("\n");
}
