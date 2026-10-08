/**
 * Content Translation structured JSON response contract.
 *
 * Built from the translatable field keys of the object sent to the provider.
 * String properties only. WEB_UI span arrays and the Civic Media PLP
 * translations-array schema stay on their own owners.
 */

export type ContentTranslationStructuredFieldSchema = {
  readonly type: "string";
};

export type ContentTranslationStructuredResponseSchema = {
  readonly type: "object";
  readonly properties: Readonly<Record<string, ContentTranslationStructuredFieldSchema>>;
  readonly required: readonly string[];
  readonly propertyOrdering: readonly string[];
};

/**
 * Object schema for one structured CT request.
 * Returns null when the payload has no fields, so the caller omits responseSchema
 * and Gemini keeps the unconstrained contract for that empty request.
 */
export function contentTranslationStructuredResponseSchema(
  fields: Readonly<Record<string, string>>,
): ContentTranslationStructuredResponseSchema | null {
  const keys = Object.keys(fields).filter(
    (key) => typeof fields[key] === "string" && key.length > 0,
  );
  if (keys.length === 0) {
    return null;
  }
  const properties: Record<string, ContentTranslationStructuredFieldSchema> = {};
  for (const key of keys) {
    properties[key] = { type: "string" };
  }
  return {
    type: "object",
    properties,
    required: [...keys],
    propertyOrdering: [...keys],
  };
}
