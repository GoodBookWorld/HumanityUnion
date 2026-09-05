/**
 * Reset 03B — inspect current PLP pointer (metadata only).
 */

import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import { findCurrentPublishedPresentation } from "../published-localized-presentation/persistence/repository.js";
import { markMaterializerPlpLookup } from "./counters.js";

export type MediaPlpMaterializerPlpInspect = {
  readonly PLP_CURRENT_FOUND: boolean;
  readonly PLP_STATE: string | null;
  readonly PLP_CANONICAL_VERSION: string | null;
  readonly PLP_SCHEMA_VERSION: string | null;
  readonly PLP_CONTENT_REVISION: number | null;
  readonly PLP_MATCHES_CURRENT_SOURCE: boolean;
};

export async function inspectMediaPlpCurrent(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string | null;
}): Promise<MediaPlpMaterializerPlpInspect> {
  markMaterializerPlpLookup();
  const current = await findCurrentPublishedPresentation({
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale,
  });
  if (!current) {
    return {
      PLP_CURRENT_FOUND: false,
      PLP_STATE: null,
      PLP_CANONICAL_VERSION: null,
      PLP_SCHEMA_VERSION: null,
      PLP_CONTENT_REVISION: null,
      PLP_MATCHES_CURRENT_SOURCE: false,
    };
  }
  const matches =
    Boolean(input.canonicalVersion) &&
    current.state === "PUBLISHED" &&
    current.identity.canonicalVersion === input.canonicalVersion &&
    current.identity.localizationSchemaVersion === PUBLISHED_LOCALIZATION_SCHEMA_VERSION;
  return {
    PLP_CURRENT_FOUND: true,
    PLP_STATE: current.state,
    PLP_CANONICAL_VERSION: current.identity.canonicalVersion,
    PLP_SCHEMA_VERSION: String(current.identity.localizationSchemaVersion),
    PLP_CONTENT_REVISION: current.contentRevision,
    PLP_MATCHES_CURRENT_SOURCE: matches,
  };
}
