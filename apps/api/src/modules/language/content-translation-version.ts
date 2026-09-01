/**
 * Pack 02G Task 02 — deterministic sourceVersion for content_translations identity.
 *
 * Same eligible public fields + version stamp → same sourceVersion.
 * Eligible field change → new sourceVersion.
 * Private/irrelevant metadata must not be included in `fields` or `versionStamp`
 * unless it is already part of the publication version contract (e.g. blog publishedVersion).
 */

import { createHash } from "node:crypto";

/**
 * Hash eligible public fields + a publication/update stamp.
 * Optional `publishedVersion` prefixes the identity (blog posts).
 */
export function buildContentTranslationSourceVersion(input: {
  readonly fields: Readonly<Record<string, string>>;
  readonly versionStamp: string;
  readonly publishedVersion?: string | number;
}): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(input.fields))
    .update(input.versionStamp)
    .digest("hex")
    .slice(0, 16);
  const base = `v-${hash}`;
  if (input.publishedVersion === undefined || input.publishedVersion === null) {
    return base;
  }
  return `v-${input.publishedVersion}-${base}`;
}
