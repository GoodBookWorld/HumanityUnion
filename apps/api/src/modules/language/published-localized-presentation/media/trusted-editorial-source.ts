/**
 * F.3.17.1 — civic_media_trusted canonical authority.
 *
 * Resolves the platform-authored Trusted Media editorial card only.
 * A NEWS_SOURCE row that shares the publisher slug is never this entity.
 *
 * Preferred live source: TRUSTED_MEDIA row.
 * Bootstrap fallback: matching TRUSTED_MEDIA_RESOURCES entry.
 */

import type { PublicPresentationNode, TrustedMediaResource } from "@hu/types";

import { TRUSTED_MEDIA_RESOURCES } from "../../../civic-media-center/content/trusted-media.js";
import { toTrustedMediaResource } from "../../../media-resources/media-resource.projections.js";
import { getMediaResourceByIdentity } from "../../../media-resources/persistence/media-resource.repository.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalTrustedPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "./canonical-trees.js";

export type TrustedMediaEditorialAuthority =
  | "trusted_media_row"
  | "trusted_media_catalog"
  | "missing";

export type TrustedMediaEditorialCanonical = {
  readonly sourceFound: boolean;
  readonly sourcePublic: boolean;
  readonly authority: TrustedMediaEditorialAuthority;
  readonly canonicalVersion: string | null;
  readonly canonicalPresentation: PublicPresentationNode | null;
  readonly resource: TrustedMediaResource | null;
};

function missing(): TrustedMediaEditorialCanonical {
  return {
    sourceFound: false,
    sourcePublic: false,
    authority: "missing",
    canonicalVersion: null,
    canonicalPresentation: null,
    resource: null,
  };
}

function fromResource(
  resource: TrustedMediaResource,
  authority: Exclude<TrustedMediaEditorialAuthority, "missing">,
  sourcePublic: boolean,
): TrustedMediaEditorialCanonical {
  const canonicalPresentation = asMediaPlpPresentationNode(
    buildCanonicalTrustedPresentation(resource),
  );
  return {
    sourceFound: true,
    sourcePublic,
    authority,
    canonicalVersion: fingerprintMediaPlpCanonicalVersion(canonicalPresentation),
    canonicalPresentation,
    resource,
  };
}

export async function resolveTrustedMediaEditorialCanonical(
  entityId: string,
): Promise<TrustedMediaEditorialCanonical> {
  const id = entityId.trim();
  if (!id) {
    return missing();
  }

  const row = await getMediaResourceByIdentity({
    resourceType: "TRUSTED_MEDIA",
    id,
  });
  if (row) {
    const projected = toTrustedMediaResource(row);
    if (projected) {
      return fromResource(projected, "trusted_media_row", true);
    }
    return fromResource(
      {
        id: row.id,
        name: row.name,
        logoLabel: row.logoLabel || "?",
        country: row.secondaryText?.trim() || row.countryCode || "International",
        ...(row.countryCode ? { countryCode: row.countryCode } : {}),
        ...(row.logoUrl ? { logoUrl: row.logoUrl } : {}),
        categoryId:
          (row.categoryId as TrustedMediaResource["categoryId"] | null) ||
          "international-wire-service",
        explanation: row.description?.trim() || "",
        websiteUrl: row.websiteUrl,
        sortOrder: row.sortOrder,
      },
      "trusted_media_row",
      false,
    );
  }

  const catalog = TRUSTED_MEDIA_RESOURCES.find((resource) => resource.id === id);
  if (!catalog) {
    return missing();
  }
  return fromResource(catalog, "trusted_media_catalog", true);
}
