import { absoluteStructuredDataUrl, resolveStructuredDataOrigin } from "../absolute-url";
import { assertRequiredJsonLdFields } from "../serialize-json-ld";
import type { JsonLdNode, ProfilePageJsonLdInput } from "../types";
import { buildBreadcrumbListJsonLd } from "./breadcrumb-list";

export function buildProfilePageJsonLd(
  input: ProfilePageJsonLdInput,
  origin: string = resolveStructuredDataOrigin(),
): JsonLdNode[] | null {
  if (!origin) {
    return null;
  }

  const url = absoluteStructuredDataUrl(input.canonicalPath, origin);
  if (!url || !input.name.trim()) {
    return null;
  }

  const person: JsonLdNode = {
    "@type": "Person",
    name: input.name.trim(),
    url,
  };

  const description = input.description?.trim();
  if (description) {
    person.description = description;
  }

  if (input.imageUrl?.trim()) {
    const image = absoluteStructuredDataUrl(input.imageUrl.trim(), origin);
    if (image) {
      person.image = image;
    }
  }

  if (input.organization?.trim()) {
    person.affiliation = {
      "@type": "Organization",
      name: input.organization.trim(),
    };
  }

  const sameAs = (input.sameAs ?? [])
    .map((entry) => entry.trim())
    .filter((entry) => /^https?:\/\//i.test(entry));
  if (sameAs.length > 0) {
    person.sameAs = sameAs;
  }

  assertRequiredJsonLdFields(person, ["@type", "name", "url"]);

  const profilePage: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: input.name.trim(),
    url,
    mainEntity: person,
  };

  if (description) {
    profilePage.description = description;
  }

  assertRequiredJsonLdFields(profilePage, ["@type", "name", "url", "mainEntity"]);

  const nodes: JsonLdNode[] = [profilePage];
  const breadcrumbs = buildBreadcrumbListJsonLd(
    [
      { name: "Home", path: "/" },
      { name: input.name.trim(), path: input.canonicalPath },
    ],
    origin,
  );
  if (breadcrumbs) {
    nodes.push(breadcrumbs);
  }

  return nodes;
}
