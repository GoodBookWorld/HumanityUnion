import type { JsonLdNode } from "./types";
import { serializeJsonLd } from "./serialize-json-ld";

interface JsonLdScriptProps {
  data: JsonLdNode | readonly JsonLdNode[] | null | undefined;
}

/**
 * Safe JSON-LD script tag for App Router server components.
 * Returns null when there is nothing to emit (e.g. missing site origin).
 */
export function JsonLdScript({ data }: JsonLdScriptProps) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  return (
    <script
      type="application/ld+json"
      // Serialized via JSON.stringify with `<` escaped — not raw HTML concatenation.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
