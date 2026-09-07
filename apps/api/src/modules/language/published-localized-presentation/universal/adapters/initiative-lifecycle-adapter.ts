/**
 * RESET 05 — Initiative/Lifecycle PLP domain adapter (second production adapter).
 * Initiative is the sole canonical civic root — both lifecycle profiles share this.
 */

import { createHash } from "node:crypto";

import type {
  PlpFieldPolicyMap,
  PlpLocalizableEntityContract,
  PublicPresentationNode,
  WorldInitiativeCardProjection,
} from "@hu/types";
import {
  INITIATIVE_CARD_FIELD_OWNERSHIP,
  INITIATIVE_PLP_ENTITY_TYPE,
  INITIATIVE_PLP_ENTITY_TYPES,
  PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
  controlledTerminologyValue,
  initiativePlpEntityId,
  protectedTechnical,
} from "@hu/types";

import type { PlpDomainAdapter } from "../domain-adapter-registry.js";

const CARD_POLICY: PlpFieldPolicyMap = { ...INITIATIVE_CARD_FIELD_OWNERSHIP };

export function buildCanonicalInitiativeCardPresentation(
  card: Pick<
    WorldInitiativeCardProjection,
    | "initiativeId"
    | "title"
    | "summary"
    | "activityArea"
    | "geographyLabel"
    | "countryCode"
    | "regionCode"
    | "communitySlug"
    | "publicInitiativeHref"
    | "publishedAt"
  >,
): PublicPresentationNode {
  return {
    initiativeId: protectedTechnical(card.initiativeId),
    title: card.title,
    summary: card.summary,
    activityArea: controlledTerminologyValue(card.activityArea),
    geographyLabel: protectedTechnical(card.geographyLabel),
    countryCode: card.countryCode
      ? protectedTechnical(card.countryCode)
      : null,
    regionCode: card.regionCode ? protectedTechnical(card.regionCode) : null,
    communitySlug: card.communitySlug
      ? protectedTechnical(card.communitySlug)
      : null,
    publicInitiativeHref: protectedTechnical(card.publicInitiativeHref),
    publishedAt: protectedTechnical(card.publishedAt),
  };
}

export function fingerprintInitiativePlpCanonicalVersion(
  presentation: PublicPresentationNode,
): string {
  return createHash("sha256")
    .update(JSON.stringify(presentation))
    .digest("hex")
    .slice(0, 32);
}

/** In-memory live source for unit tests / thin resolve (no Mongo required). */
const liveCardStore = new Map<string, WorldInitiativeCardProjection>();

export function resetInitiativePlpLiveStoreForTests(): void {
  liveCardStore.clear();
}

export function seedInitiativePlpLiveCardForTests(
  card: WorldInitiativeCardProjection,
): void {
  liveCardStore.set(card.initiativeId, structuredClone(card));
}

export const initiativeLifecyclePlpDomainAdapter: PlpDomainAdapter = {
  adapterId: "initiative_lifecycle",
  supportedEntityTypes: INITIATIVE_PLP_ENTITY_TYPES,
  /** Country rails use the same card projection identity as public listings. */
  usesConsumerIdentityAuthority: true,
  fingerprintCanonicalVersion: fingerprintInitiativePlpCanonicalVersion,
  fieldPolicyFor: () => CARD_POLICY,
  async resolveCanonicalEntity(input): Promise<PlpLocalizableEntityContract | null> {
    if (input.entityType !== INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE) {
      return null;
    }
    const card = liveCardStore.get(input.entityId);
    if (!card) {
      return null;
    }
    const presentation = buildCanonicalInitiativeCardPresentation(card);
    return {
      entityType: INITIATIVE_PLP_ENTITY_TYPE.INITIATIVE,
      entityId: initiativePlpEntityId(card.initiativeId),
      canonicalVersion: fingerprintInitiativePlpCanonicalVersion(presentation),
      localizationSchemaVersion: PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
      canonicalPresentation: presentation,
      fieldPolicy: CARD_POLICY,
      targetLocale: input.locale,
      contentRevision: 1,
    };
  },
};
