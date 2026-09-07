/**
 * Reset 02 — atomic publish contract (validate then CAS publish).
 */

import { randomUUID } from "node:crypto";

import type {
  PublishAtomicResult,
  PublishedLocalizedPresentationRecord,
  PublicPresentationNode,
  LocalizedNodeProvenance,
  PublishedLocalizedPresentationSeo,
  PublishedLocalizationSchemaVersion,
} from "@hu/types";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import { evaluateLocalizationContentIntegrity } from "./content-integrity.js";
import { evaluateLocalizationStructuralIntegrity } from "./structural-integrity.js";
import { publishAtomicPublishedPresentation } from "./persistence/repository.js";
import {
  validatePublishedBuildResult,
  type ValidatePublishedBuildInput,
} from "./validate-build-result.js";
import { invalidateMediaPlpResolveCacheForEntity } from "./resolve-cache.js";
import { resolveFieldPolicyForEntityType } from "./universal/resolve-field-policy.js";
import type { PlpFieldPolicyMap } from "@hu/types";

export type PublishPublishedLocalizedPresentationInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly canonicalVersion: string;
  readonly contentRevision: number;
  readonly localizationSchemaVersion?: PublishedLocalizationSchemaVersion;
  readonly canonicalPresentation: PublicPresentationNode;
  readonly localizedCandidate: PublicPresentationNode;
  readonly provenance: readonly LocalizedNodeProvenance[];
  readonly seo?: PublishedLocalizedPresentationSeo;
  readonly snapshotId?: string;
  readonly fieldPolicy?: PlpFieldPolicyMap;
};

export async function publishPublishedLocalizedPresentation(
  input: PublishPublishedLocalizedPresentationInput,
): Promise<PublishAtomicResult> {
  const localizationSchemaVersion =
    input.localizationSchemaVersion ?? PUBLISHED_LOCALIZATION_SCHEMA_VERSION;
  const fieldPolicy =
    input.fieldPolicy ?? resolveFieldPolicyForEntityType(input.entityType);

  const validationInput: ValidatePublishedBuildInput = {
    canonicalPresentation: input.canonicalPresentation,
    localizedCandidate: input.localizedCandidate,
    provenance: input.provenance,
    canonicalVersion: input.canonicalVersion,
    buildTargetCanonicalVersion: input.canonicalVersion,
    localizationSchemaVersion,
    locale: input.locale,
    entityType: input.entityType,
    entityId: input.entityId,
    fieldPolicy,
  };

  const validation = validatePublishedBuildResult(validationInput);
  if (validation.status === "NOT_READY") {
    return {
      ok: false,
      outcome: "NOT_READY",
      reasonCodes: validation.reasonCodes,
      missingPaths: validation.missingPaths,
    };
  }

  const now = new Date().toISOString();
  const contentIntegrity = evaluateLocalizationContentIntegrity({
    locale: input.locale,
    canonicalPresentation: input.canonicalPresentation,
    localizedPresentation: input.localizedCandidate,
    fieldPolicy,
    evaluatedAt: now,
  });
  const structuralIntegrity = evaluateLocalizationStructuralIntegrity({
    locale: input.locale,
    canonicalPresentation: input.canonicalPresentation,
    localizedPresentation: input.localizedCandidate,
    fieldPolicy,
    evaluatedAt: now,
  });
  // Validation already required PASSED (or NOT_APPLICABLE_EN). Persist attestation.
  if (String(input.locale).toLowerCase() !== "en") {
    if (contentIntegrity.status !== "PASSED") {
      return {
        ok: false,
        outcome: "NOT_READY",
        reasonCodes: [
          "LOCALIZATION_CONTENT_INTEGRITY_FAILED",
          ...contentIntegrity.reasonCodes,
        ],
      };
    }
    if (structuralIntegrity.status !== "PASSED") {
      return {
        ok: false,
        outcome: "NOT_READY",
        reasonCodes: [
          "LOCALIZATION_STRUCTURAL_INTEGRITY_FAILED",
          ...structuralIntegrity.reasonCodes,
        ],
      };
    }
  }

  const candidate: PublishedLocalizedPresentationRecord = {
    snapshotId: input.snapshotId ?? randomUUID(),
    identity: {
      entityType: input.entityType,
      entityId: input.entityId,
      locale: input.locale,
      canonicalVersion: input.canonicalVersion,
      localizationSchemaVersion,
    },
    state: "BUILDING", // persistence publish path flips to PUBLISHED atomically
    contentRevision: input.contentRevision,
    presentation: input.localizedCandidate,
    provenance: input.provenance,
    seo: input.seo,
    contentIntegrity,
    structuralIntegrity,
    createdAt: now,
    updatedAt: now,
  };

  const result = await publishAtomicPublishedPresentation({ candidate });
  if (!result.ok) {
    if (result.reason === "STALE_REVISION") {
      return {
        ok: false,
        outcome: "STALE_REVISION",
        reasonCodes: ["STALE_REVISION"],
      };
    }
    return {
      ok: false,
      outcome: "PERSISTENCE_ERROR",
      reasonCodes: ["PERSISTENCE_ERROR"],
    };
  }

  // Reset 03D — drop stale resolve cache entries for this entity after publish.
  invalidateMediaPlpResolveCacheForEntity({
    entityType: input.entityType,
    entityId: input.entityId,
  });

  return {
    ok: true,
    outcome: result.idempotent ? "IDEMPOTENT" : "PUBLISHED",
    record: result.record,
    supersededSnapshotId: result.supersededSnapshotId,
  };
}
