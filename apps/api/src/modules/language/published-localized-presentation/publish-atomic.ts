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

import { publishAtomicPublishedPresentation } from "./persistence/repository.js";
import {
  validatePublishedBuildResult,
  type ValidatePublishedBuildInput,
} from "./validate-build-result.js";

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
};

export async function publishPublishedLocalizedPresentation(
  input: PublishPublishedLocalizedPresentationInput,
): Promise<PublishAtomicResult> {
  const localizationSchemaVersion =
    input.localizationSchemaVersion ?? PUBLISHED_LOCALIZATION_SCHEMA_VERSION;

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

  return {
    ok: true,
    outcome: result.idempotent ? "IDEMPOTENT" : "PUBLISHED",
    record: result.record,
    supersededSnapshotId: result.supersededSnapshotId,
  };
}
