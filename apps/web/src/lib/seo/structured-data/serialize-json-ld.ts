import type { JsonLdNode } from "./types";

/**
 * Serialize JSON-LD for a `<script type="application/ld+json">` body.
 * Escapes `<` so user-generated text cannot break out of the script element.
 */
export function serializeJsonLd(data: JsonLdNode | readonly JsonLdNode[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function assertRequiredJsonLdFields(
  node: JsonLdNode,
  fields: readonly string[],
): void {
  for (const field of fields) {
    const value = node[field];
    if (value === undefined || value === null || value === "") {
      throw new Error(`Structured data missing required field: ${field}`);
    }
  }
}
