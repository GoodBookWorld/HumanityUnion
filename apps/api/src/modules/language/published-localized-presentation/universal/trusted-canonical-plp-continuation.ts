/**
 * Wake PLP only when a trusted explanation fingerprint changes or becomes usable.
 * Does not rescan unaffected entities and does not call the provider.
 */

import { MEDIA_PLP_ENTITY_TYPE } from "@hu/types";

import { TRUSTED_MEDIA_RESOURCES } from "../../../civic-media-center/content/trusted-media.js";
import {
  resolveTrustedMediaEditorialCanonical,
  trustedExplanationCanonicalVersion,
} from "../media/trusted-editorial-source.js";
import { enqueuePlpBuildRequest } from "./build-request-queue.js";
import { resolvePlpAutoBuildLocales } from "./public-source-mutation-bridge.js";

export function trustedCanonicalVersionBeforeWrite(input: {
  readonly hadTrustedRow: boolean;
  readonly entityId: string;
  readonly description: string | null | undefined;
}): string | null {
  if (input.hadTrustedRow) {
    return trustedExplanationCanonicalVersion(input.description);
  }
  const catalog = TRUSTED_MEDIA_RESOURCES.find((resource) => resource.id === input.entityId);
  return trustedExplanationCanonicalVersion(catalog?.explanation);
}

export async function continueTrustedMediaPlpIfCanonicalChanged(input: {
  readonly entityId: string;
  readonly beforeVersion: string | null;
  readonly afterVersion: string | null;
}): Promise<void> {
  if (input.beforeVersion === input.afterVersion || input.afterVersion == null) {
    return;
  }
  const editorialVersion = input.afterVersion;
  const editorial = await resolveTrustedMediaEditorialCanonical(input.entityId);
  if (
    !editorial.canonicalUsable ||
    editorial.canonicalVersion !== editorialVersion ||
    !editorial.canonicalPresentation
  ) {
    return;
  }
  const locales = await resolvePlpAutoBuildLocales();
  for (const locale of locales) {
    await enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: input.entityId,
      locale,
      canonicalVersion: editorial.canonicalVersion,
      contentRevision: 1,
      trigger: "CANONICAL_CONTENT_UPDATED",
      canonicalPresentation: editorial.canonicalPresentation,
      reopenFailedSameVersion: true,
    });
  }
}
