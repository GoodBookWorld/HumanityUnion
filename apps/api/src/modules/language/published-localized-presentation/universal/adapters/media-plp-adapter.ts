/**
 * RESET 04 — Media domain adapter (first registered adapter).
 * Wraps existing Media PLP helpers; does not duplicate identity/version logic.
 */

import type {
  PlpFieldOwnershipClass,
  PlpFieldPolicyMap,
  PlpLocalizableEntityContract,
  PublicPresentationNode,
} from "@hu/types";
import {
  MEDIA_PLP_ENTITY_TYPE,
  MEDIA_PLP_ENTITY_TYPES,
  PUBLIC_NEWS_FIELD_OWNERSHIP,
  PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
  type PublicNewsFieldOwnershipClass,
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

function mapPublicNewsOwnershipToPlp(
  ownership: PublicNewsFieldOwnershipClass,
): PlpFieldOwnershipClass {
  if (ownership === "PROTECTED_SOURCE_VALUE") {
    return "PROTECTED_CANONICAL";
  }
  return ownership;
}

const PUBLIC_NEWS_POLICY: PlpFieldPolicyMap = Object.fromEntries(
  Object.entries(PUBLIC_NEWS_FIELD_OWNERSHIP).map(([field, ownership]) => [
    field,
    mapPublicNewsOwnershipToPlp(ownership),
  ]),
) as PlpFieldPolicyMap;

const TRUSTED_POLICY: PlpFieldPolicyMap = {
  explanation: "MACHINE_CONTENT",
  name: "PROTECTED_CANONICAL",
  websiteUrl: "PROTECTED_CANONICAL",
};

const PRINCIPLE_POLICY: PlpFieldPolicyMap = {
  title: "MACHINE_CONTENT",
  description: "MACHINE_CONTENT",
  whyItMatters: "MACHINE_CONTENT",
};

const FACT_CHECK_POLICY: PlpFieldPolicyMap = {
  mission: "MACHINE_CONTENT",
  coverage: "MACHINE_CONTENT",
};

const PROPAGANDA_POLICY: PlpFieldPolicyMap = {
  focus: "MACHINE_CONTENT",
  explanation: "MACHINE_CONTENT",
};

const EDITORIAL_POLICY: PlpFieldPolicyMap = {
  overviewTitle: "MACHINE_CONTENT",
  overviewSummary: "MACHINE_CONTENT",
  "overviewPoints[*].id": "NON_LOCALIZABLE_DATA",
  "overviewPoints[*].heading": "MACHINE_CONTENT",
  "overviewPoints[*].body": "MACHINE_CONTENT",
  "faq[*].id": "NON_LOCALIZABLE_DATA",
  "faq[*].question": "MACHINE_CONTENT",
  "faq[*].answer": "MACHINE_CONTENT",
};

function fieldPolicyFor(entityType: string): PlpFieldPolicyMap {
  switch (entityType) {
    case MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS:
      return PUBLIC_NEWS_POLICY;
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED:
      return TRUSTED_POLICY;
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE:
      return PRINCIPLE_POLICY;
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK:
      return FACT_CHECK_POLICY;
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA:
      return PROPAGANDA_POLICY;
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL:
      return EDITORIAL_POLICY;
    default:
      return {};
  }
}

// PUBLIC_NEWS_POLICY is derived from PUBLIC_NEWS_FIELD_OWNERSHIP (source of truth).
void PUBLIC_NEWS_FIELD_OWNERSHIP;

export const mediaPlpDomainAdapter: PlpDomainAdapter = {
  adapterId: "media_plp",
  supportedEntityTypes: MEDIA_PLP_ENTITY_TYPES,
  /** News rail MUST match /media consumer selection (03E.13). */
  usesConsumerIdentityAuthority: true,
  fingerprintCanonicalVersion(presentation: PublicPresentationNode): string {
    return fingerprintMediaPlpCanonicalVersion(presentation);
  },
  fieldPolicyFor,
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
      fieldPolicy: fieldPolicyFor(input.entityType),
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
