import { absoluteStructuredDataUrl, resolveStructuredDataOrigin } from "../absolute-url";
import { assertRequiredJsonLdFields } from "../serialize-json-ld";
import type { JsonLdNode } from "../types";

export const HUMANITY_UNION_ORG_NAME = "Humanity Union";
export const HUMANITY_UNION_LOGO_PATH = "/brand/logo-512.png";

export function organizationId(origin: string): string {
  return `${origin}/#organization`;
}

export function websiteId(origin: string): string {
  return `${origin}/#website`;
}

export function buildOrganizationJsonLd(
  origin: string = resolveStructuredDataOrigin(),
): JsonLdNode | null {
  if (!origin) {
    return null;
  }

  const logo = absoluteStructuredDataUrl(HUMANITY_UNION_LOGO_PATH, origin);
  if (!logo) {
    return null;
  }

  const node: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId(origin),
    name: HUMANITY_UNION_ORG_NAME,
    url: origin,
    logo,
  };

  assertRequiredJsonLdFields(node, ["@type", "name", "url", "logo"]);
  return node;
}

export function buildWebSiteJsonLd(
  origin: string = resolveStructuredDataOrigin(),
): JsonLdNode | null {
  if (!origin) {
    return null;
  }

  const node: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId(origin),
    name: HUMANITY_UNION_ORG_NAME,
    url: origin,
    publisher: { "@id": organizationId(origin) },
  };

  assertRequiredJsonLdFields(node, ["@type", "name", "url"]);
  return node;
}

/** Root structured data graph: Organization + WebSite, or null when origin missing. */
export function buildRootStructuredData(
  origin: string = resolveStructuredDataOrigin(),
): JsonLdNode[] | null {
  const organization = buildOrganizationJsonLd(origin);
  const website = buildWebSiteJsonLd(origin);
  if (!organization || !website) {
    return null;
  }
  return [organization, website];
}

export function buildPublisherReference(
  origin: string = resolveStructuredDataOrigin(),
): JsonLdNode | null {
  if (!origin) {
    return null;
  }
  const logo = absoluteStructuredDataUrl(HUMANITY_UNION_LOGO_PATH, origin);
  if (!logo) {
    return null;
  }
  return {
    "@type": "Organization",
    name: HUMANITY_UNION_ORG_NAME,
    url: origin,
    logo: {
      "@type": "ImageObject",
      url: logo,
    },
  };
}
