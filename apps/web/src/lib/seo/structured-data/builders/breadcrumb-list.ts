import { absoluteStructuredDataUrl, resolveStructuredDataOrigin } from "../absolute-url";
import { assertRequiredJsonLdFields } from "../serialize-json-ld";
import type { BreadcrumbItemInput, JsonLdNode } from "../types";

/**
 * BreadcrumbList from real public routes only.
 * Returns null when origin is missing or fewer than two items remain after URL resolution.
 */
export function buildBreadcrumbListJsonLd(
  items: readonly BreadcrumbItemInput[],
  origin: string = resolveStructuredDataOrigin(),
): JsonLdNode | null {
  if (!origin || items.length === 0) {
    return null;
  }

  const elementList: JsonLdNode[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item?.name.trim() || !item.path.trim()) {
      continue;
    }
    const url = absoluteStructuredDataUrl(item.path, origin);
    if (!url) {
      return null;
    }
    elementList.push({
      "@type": "ListItem",
      position: elementList.length + 1,
      name: item.name.trim(),
      item: url,
    });
  }

  if (elementList.length < 2) {
    return null;
  }

  const node: JsonLdNode = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: elementList,
  };

  assertRequiredJsonLdFields(node, ["@type", "itemListElement"]);
  return node;
}
