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
  isUsablePlpCanonicalPresentation,
} from "./canonical-trees.js";

export type TrustedMediaEditorialAuthority =
  | "trusted_media_row"
  | "trusted_media_catalog"
  | "missing";

export type TrustedMediaEditorialCanonical = {
  readonly sourceFound: boolean;
  readonly sourcePublic: boolean;
  readonly authority: TrustedMediaEditorialAuthority;
  /**
   * False when the row or catalog entry has no auto-translatable explanation.
   * That state is not a canonical version and is not a missing entity.
   */
  readonly canonicalUsable: boolean;
  readonly canonicalVersion: string | null;
  readonly canonicalPresentation: PublicPresentationNode | null;
  readonly resource: TrustedMediaResource | null;
};

function missing(): TrustedMediaEditorialCanonical {
  return {
    sourceFound: false,
    sourcePublic: false,
    authority: "missing",
    canonicalUsable: false,
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
  if (!isUsablePlpCanonicalPresentation(canonicalPresentation)) {
    return {
      sourceFound: true,
      sourcePublic,
      authority,
      canonicalUsable: false,
      canonicalVersion: null,
      canonicalPresentation: null,
      resource,
    };
  }
  return {
    sourceFound: true,
    sourcePublic,
    authority,
    canonicalUsable: true,
    canonicalVersion: fingerprintMediaPlpCanonicalVersion(canonicalPresentation),
    canonicalPresentation,
    resource,
  };
}

/** Fingerprint of a trusted explanation. Null when it has no auto-translatable text. */
export function trustedExplanationCanonicalVersion(
  explanation: string | null | undefined,
): string | null {
  const text = typeof explanation === "string" ? explanation.trim() : "";
  if (!text) {
    return null;
  }
  const presentation = asMediaPlpPresentationNode(
    buildCanonicalTrustedPresentation({
      id: "version",
      name: "version",
      logoLabel: "v",
      country: "International",
      categoryId: "international-wire-service",
      explanation: text,
      websiteUrl: "https://example.com/",
      sortOrder: 0,
    }),
  );
  if (!isUsablePlpCanonicalPresentation(presentation)) {
    return null;
  }
  return fingerprintMediaPlpCanonicalVersion(presentation);
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
