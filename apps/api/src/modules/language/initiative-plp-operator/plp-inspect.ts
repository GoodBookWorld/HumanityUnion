/**
 * RESET 05B — current PLP snapshot inspect + resolve mode (read-only).
 */

import type {
  LocalizedPresentationUsability,
  LocalizedPresentationUsabilityReason,
  PublicPresentationNode,
} from "@hu/types";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import {
  findCurrentPublishedPresentation,
  getPublishedLocalizationPersistenceMode,
} from "../published-localized-presentation/persistence/repository.js";
import { resolvePublishedPresentation } from "../published-localized-presentation/resolve-published-presentation.js";
import { classifyUsableLocalizedPresentation } from "../published-localized-presentation/usability.js";

export type InitiativePlpInspect = {
  readonly PLP_PERSISTENCE_MODE: "MONGO" | "MEMORY" | "UNSET";
  readonly PLP_CURRENT_FOUND: boolean;
  readonly PLP_STATE: string | null;
  readonly PLP_CANONICAL_VERSION: string | null;
  readonly PLP_SCHEMA_VERSION: string | null;
  readonly EXISTING_PLP_USABILITY: LocalizedPresentationUsability | null;
  readonly EXISTING_PLP_USABILITY_REASON: LocalizedPresentationUsabilityReason | null;
  readonly REBUILD_REQUIRED: boolean;
  readonly RESOLVER_MODE: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK" | null;
  readonly RESOLVER_REASON: string | null;
};

export async function inspectInitiativePlpCurrent(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly liveCanonicalVersion: string | null;
  readonly canonicalPresentation?: PublicPresentationNode | null;
}): Promise<InitiativePlpInspect> {
  const mode = getPublishedLocalizationPersistenceMode();
  const persistenceMode =
    mode === "mongo" ? "MONGO" : mode === "memory" ? "MEMORY" : "UNSET";

  const current = await findCurrentPublishedPresentation({
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale,
  });

  const usability = classifyUsableLocalizedPresentation({
    locale: input.locale,
    liveCanonicalVersion: input.liveCanonicalVersion,
    liveLocalizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    canonicalPresentation: input.canonicalPresentation,
    snapshot: current,
  });

  let resolverMode: InitiativePlpInspect["RESOLVER_MODE"] = "CANONICAL_FALLBACK";
  let resolverReason: string | null =
    usability.resolveReasonCode ?? usability.reason;

  if (input.canonicalPresentation && input.liveCanonicalVersion) {
    const resolved = await resolvePublishedPresentation({
      entityType: input.entityType,
      entityId: input.entityId,
      locale: input.locale,
      liveCanonicalVersion: input.liveCanonicalVersion,
      canonicalPresentation: input.canonicalPresentation,
    });
    resolverMode = resolved.mode;
    resolverReason =
      resolved.mode === "PUBLISHED_LOCALIZED"
        ? null
        : (resolved.reasonCode ?? resolverReason);
  }

  return {
    PLP_PERSISTENCE_MODE: persistenceMode,
    PLP_CURRENT_FOUND: Boolean(current),
    PLP_STATE: current?.state ?? null,
    PLP_CANONICAL_VERSION: current?.identity.canonicalVersion ?? null,
    PLP_SCHEMA_VERSION: current?.identity.localizationSchemaVersion ?? null,
    EXISTING_PLP_USABILITY: usability.usability,
    EXISTING_PLP_USABILITY_REASON: usability.reason,
    REBUILD_REQUIRED: usability.rebuildRequired,
    RESOLVER_MODE: resolverMode,
    RESOLVER_REASON: resolverReason,
  };
}
