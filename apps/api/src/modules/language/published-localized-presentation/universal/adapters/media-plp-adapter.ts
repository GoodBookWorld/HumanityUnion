/**
 * RESET 04 — Media domain adapter (first registered adapter).
 * Wraps existing Media PLP helpers; does not duplicate identity/version logic.
 */

import type {
  PlpLocalizableEntityContract,
  PublicPresentationNode,
} from "@hu/types";
import {
  MEDIA_PLP_ENTITY_TYPES,
  PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
} from "@hu/types";

import type { PlpDomainAdapter } from "../domain-adapter-registry.js";
import {
  fingerprintMediaPlpCanonicalVersion,
  buildCanonicalPublicNewsPresentation,
  buildCanonicalTrustedPresentation,
  buildCanonicalPrinciplePresentation,
  buildCanonicalFactCheckPresentation,
  buildCanonicalPropagandaPresentation,
  buildCanonicalEditorialPresentation,
  asMediaPlpPresentationNode,
} from "../../media/canonical-trees.js";
import { loadMediaPlpLiveCanonicalSource } from "../../media/live-source.js";
import { resolveMediaPlpFieldPolicy } from "./media-plp-field-policies.js";

export const mediaPlpDomainAdapter: PlpDomainAdapter = {
  adapterId: "media_plp",
  supportedEntityTypes: MEDIA_PLP_ENTITY_TYPES,
  /** News rail MUST match /media consumer selection (03E.13). */
  usesConsumerIdentityAuthority: true,
  fingerprintCanonicalVersion(presentation: PublicPresentationNode): string {
    return fingerprintMediaPlpCanonicalVersion(presentation);
  },
  fieldPolicyFor: resolveMediaPlpFieldPolicy,
  async resolveCanonicalEntity(input): Promise<PlpLocalizableEntityContract | null> {
    const live = await loadMediaPlpLiveCanonicalSource({
      entityType: input.entityType as never,
      entityId: input.entityId,
    });
    if (!live.SOURCE_FOUND || !live.canonicalPresentation || !live.CANONICAL_VERSION) {
      return null;
    }
    return {
      entityType: input.entityType,
      entityId: input.entityId,
      canonicalVersion: live.CANONICAL_VERSION,
      localizationSchemaVersion: PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
      canonicalPresentation: live.canonicalPresentation,
      fieldPolicy: resolveMediaPlpFieldPolicy(input.entityType),
      targetLocale: input.locale,
      contentRevision: 1,
    };
  },
};

export {
  buildCanonicalPublicNewsPresentation,
  buildCanonicalTrustedPresentation,
  buildCanonicalPrinciplePresentation,
  buildCanonicalFactCheckPresentation,
  buildCanonicalPropagandaPresentation,
  buildCanonicalEditorialPresentation,
  asMediaPlpPresentationNode,
};
