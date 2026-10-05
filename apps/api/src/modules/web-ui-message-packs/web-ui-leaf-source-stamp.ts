/**
 * Legacy WEB_UI packs store one catalog hash and no per-leaf fingerprints.
 * When that hash still equals the current English catalog, every leaf's
 * English source is unchanged and can be stamped without provider work.
 * A hash mismatch must not be stamped: the old translations are not proof
 * of the new English values.
 */

import {
  buildWebUiSourceFingerprintsByPath,
  hashWebUiEnglishFlatMap,
  loadPublicWebUiEnglishCorpus,
} from "./web-ui-draft-builder.js";
import { readWebUiPackSourceHash } from "./web-ui-leaf-reuse.js";
import {
  getPublishedWebUiMessagePackByLocale,
  writePublishedWebUiSourceFingerprints,
} from "./web-ui-message-pack.repository.js";

export type WebUiLeafSourceStampReason =
  | "stamped"
  | "already_current"
  | "no_published_pack"
  | "hash_mismatch"
  | "hash_absent";

export type WebUiLeafSourceStampResult = {
  readonly wrote: boolean;
  readonly reason: WebUiLeafSourceStampReason;
};

function requiredFingerprintsMatch(
  existing: Readonly<Record<string, string>> | null | undefined,
  desired: Readonly<Record<string, string>>,
): boolean {
  const current = existing ?? {};
  return Object.keys(desired).every((pathKey) => current[pathKey] === desired[pathKey]);
}

/**
 * Idempotent. A second call after a successful stamp performs no write.
 * Does not change localized values, revision, or activation generation.
 */
export async function stampWebUiLeafSourceFingerprintsIfCatalogUnchanged(
  locale: string,
  now: () => string = () => new Date().toISOString(),
): Promise<WebUiLeafSourceStampResult> {
  const published = await getPublishedWebUiMessagePackByLocale(locale);
  if (!published) {
    return { wrote: false, reason: "no_published_pack" };
  }
  const { flat, requiredPaths } = loadPublicWebUiEnglishCorpus();
  const currentHash = hashWebUiEnglishFlatMap(flat);
  const recordedHash = readWebUiPackSourceHash(published.sourceNote);
  if (recordedHash == null) {
    return { wrote: false, reason: "hash_absent" };
  }
  if (recordedHash !== currentHash) {
    return { wrote: false, reason: "hash_mismatch" };
  }
  const desired = buildWebUiSourceFingerprintsByPath(flat, requiredPaths);
  if (requiredFingerprintsMatch(published.sourceFingerprintsByPath, desired)) {
    return { wrote: false, reason: "already_current" };
  }
  await writePublishedWebUiSourceFingerprints({
    locale: published.locale,
    sourceFingerprintsByPath: desired,
    updatedAt: now(),
  });
  return { wrote: true, reason: "stamped" };
}
