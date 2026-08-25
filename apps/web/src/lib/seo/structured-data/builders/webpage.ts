import { absoluteStructuredDataUrl, resolveStructuredDataOrigin } from "../absolute-url";
import { assertRequiredJsonLdFields } from "../serialize-json-ld";
import type { JsonLdNode, WebPageJsonLdInput } from "../types";
import { buildBreadcrumbListJsonLd } from "./breadcrumb-list";

export function buildWebPageJsonLd(
  input: WebPageJsonLdInput,
  origin: string = resolveStructuredDataOrigin(),
): JsonLdNode[] | null {
  if (!origin) {
    return null;
  }

  const url = absoluteStructuredDataUrl(input.canonicalPath, origin);
  if (!url || !input.name.trim()) {
    return null;
  }

  const node: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.name.trim(),
    url,
  };

  const description = input.description?.trim();
  if (description) {
    node.description = description;
  }

  if (input.imageUrl?.trim()) {
    const image = absoluteStructuredDataUrl(input.imageUrl.trim(), origin);
    if (image) {
      node.image = image;
    }
  }

  assertRequiredJsonLdFields(node, ["@type", "name", "url"]);

  const nodes: JsonLdNode[] = [node];
  if (input.breadcrumbs?.length) {
    const breadcrumbs = buildBreadcrumbListJsonLd(input.breadcrumbs, origin);
    if (breadcrumbs) {
      nodes.push(breadcrumbs);
    }
  }

  return nodes;
}
