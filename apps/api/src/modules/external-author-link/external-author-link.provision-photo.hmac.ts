import { INTEGRITY_MEDIA_PROVISION_PHOTO_PURPOSE } from "./external-author-link.constants.js";

export interface ProvisionPhotoCanonicalFields {
  timestamp: string;
  attemptId: string;
  target: string;
  digest: string;
  byteLength: number;
}

/** Six lines, UTF-8, joined by newline, no trailing newline. */
export function buildProvisionPhotoPayload(input: ProvisionPhotoCanonicalFields): string {
  return [
    INTEGRITY_MEDIA_PROVISION_PHOTO_PURPOSE,
    input.timestamp,
    input.attemptId,
    input.target,
    input.digest,
    String(input.byteLength),
  ].join("\n");
}
