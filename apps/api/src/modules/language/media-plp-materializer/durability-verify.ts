/**
 * Reset 03B.1 — post-publish durable read-back verification.
 * Only report PUBLISHED when the durable current pointer confirms identity.
 */

import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import { findCurrentPublishedPresentation } from "../published-localized-presentation/persistence/repository.js";
import { assertPublishedLocalizationMongoPersistenceActive } from "../published-localized-presentation/persistence/repository.js";

export type DurabilityVerificationResult =
  | {
      readonly ok: true;
      readonly PLP_DURABILITY_VERIFIED: true;
    }
  | {
      readonly ok: false;
      readonly PLP_DURABILITY_VERIFIED: false;
      readonly reason: string;
    };

export async function verifyDurableMediaPlpCurrent(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly requireMongo?: boolean;
}): Promise<DurabilityVerificationResult> {
  if (input.requireMongo !== false) {
    assertPublishedLocalizationMongoPersistenceActive("post-publish durability read-back");
  }

  const current = await findCurrentPublishedPresentation({
    entityType: input.entityType,
    entityId: input.entityId,
    locale: input.locale,
  });

  if (!current) {
    return {
      ok: false,
      PLP_DURABILITY_VERIFIED: false,
      reason: "Durable current pointer missing after publish.",
    };
  }
  if (current.state !== "PUBLISHED") {
    return {
      ok: false,
      PLP_DURABILITY_VERIFIED: false,
      reason: `Durable current state is ${current.state}, expected PUBLISHED.`,
    };
  }
  if (current.identity.entityType !== input.entityType) {
    return {
      ok: false,
      PLP_DURABILITY_VERIFIED: false,
      reason: "Durable entityType mismatch.",
    };
  }
  if (current.identity.entityId !== input.entityId) {
    return {
      ok: false,
      PLP_DURABILITY_VERIFIED: false,
      reason: "Durable entityId mismatch.",
    };
  }
  if (String(current.identity.locale).toLowerCase() !== input.locale.toLowerCase()) {
    return {
      ok: false,
      PLP_DURABILITY_VERIFIED: false,
      reason: "Durable locale mismatch.",
    };
  }
  if (current.identity.canonicalVersion !== input.canonicalVersion) {
    return {
      ok: false,
      PLP_DURABILITY_VERIFIED: false,
      reason: "Durable canonicalVersion mismatch.",
    };
  }
  if (
    current.identity.localizationSchemaVersion !== PUBLISHED_LOCALIZATION_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      PLP_DURABILITY_VERIFIED: false,
      reason: "Durable localizationSchemaVersion mismatch.",
    };
  }

  return { ok: true, PLP_DURABILITY_VERIFIED: true };
}
