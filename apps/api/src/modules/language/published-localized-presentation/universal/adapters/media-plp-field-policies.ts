/**
 * Media PLP field ownership policies — machine eligibility source of truth.
 *
 * Kept free of live-source / adapter registration so operator materializers
 * can filter provider payload without broadening their import graph.
 */

import type { PlpFieldOwnershipClass, PlpFieldPolicyMap } from "@hu/types";
import {
  MEDIA_PLP_ENTITY_TYPE,
  PUBLIC_NEWS_FIELD_OWNERSHIP,
  type PublicNewsFieldOwnershipClass,
} from "@hu/types";

function mapPublicNewsOwnershipToPlp(
  ownership: PublicNewsFieldOwnershipClass,
): PlpFieldOwnershipClass {
  if (ownership === "PROTECTED_SOURCE_VALUE") {
    return "PROTECTED_CANONICAL";
  }
  return ownership;
}

export const MEDIA_PLP_PUBLIC_NEWS_FIELD_POLICY: PlpFieldPolicyMap =
  Object.fromEntries(
    Object.entries(PUBLIC_NEWS_FIELD_OWNERSHIP).map(([field, ownership]) => [
      field,
      mapPublicNewsOwnershipToPlp(ownership),
    ]),
  ) as PlpFieldPolicyMap;

export const MEDIA_PLP_TRUSTED_FIELD_POLICY: PlpFieldPolicyMap = {
  explanation: "MACHINE_CONTENT",
  name: "PROTECTED_CANONICAL",
  websiteUrl: "PROTECTED_CANONICAL",
};

export const MEDIA_PLP_PRINCIPLE_FIELD_POLICY: PlpFieldPolicyMap = {
  title: "MACHINE_CONTENT",
  description: "MACHINE_CONTENT",
  whyItMatters: "MACHINE_CONTENT",
};

export const MEDIA_PLP_FACT_CHECK_FIELD_POLICY: PlpFieldPolicyMap = {
  mission: "MACHINE_CONTENT",
  coverage: "MACHINE_CONTENT",
};

export const MEDIA_PLP_PROPAGANDA_FIELD_POLICY: PlpFieldPolicyMap = {
  focus: "MACHINE_CONTENT",
  explanation: "MACHINE_CONTENT",
};

export const MEDIA_PLP_EDITORIAL_FIELD_POLICY: PlpFieldPolicyMap = {
  overviewTitle: "MACHINE_CONTENT",
  overviewSummary: "MACHINE_CONTENT",
  "overviewPoints[*].id": "NON_LOCALIZABLE_DATA",
  "overviewPoints[*].heading": "MACHINE_CONTENT",
  "overviewPoints[*].body": "MACHINE_CONTENT",
  "faq[*].id": "NON_LOCALIZABLE_DATA",
  "faq[*].question": "MACHINE_CONTENT",
  "faq[*].answer": "MACHINE_CONTENT",
};

/** Resolve Media PLP field policy for a known Media entity type. */
export function resolveMediaPlpFieldPolicy(entityType: string): PlpFieldPolicyMap {
  switch (entityType) {
    case MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS:
      return MEDIA_PLP_PUBLIC_NEWS_FIELD_POLICY;
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED:
      return MEDIA_PLP_TRUSTED_FIELD_POLICY;
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE:
      return MEDIA_PLP_PRINCIPLE_FIELD_POLICY;
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK:
      return MEDIA_PLP_FACT_CHECK_FIELD_POLICY;
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA:
      return MEDIA_PLP_PROPAGANDA_FIELD_POLICY;
    case MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL:
      return MEDIA_PLP_EDITORIAL_FIELD_POLICY;
    default:
      return {};
  }
}
